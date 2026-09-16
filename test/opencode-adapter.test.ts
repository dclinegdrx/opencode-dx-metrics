import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

import {
  OpenCodeReportError,
  OpenCodeStatsAdapter,
  TESTED_OPENCODE_VERSION,
  type OpenCodeAdapterDependencies,
} from "../src/opencode-adapter.js";

const endpoint = { url: "http://127.0.0.1:4096" };

function dependencies(
  overrides: Partial<OpenCodeAdapterDependencies> = {},
): OpenCodeAdapterDependencies {
  return {
    discover: vi.fn().mockResolvedValue(endpoint),
    connect: vi.fn().mockReturnValue({
      status: vi.fn().mockResolvedValue({ version: TESTED_OPENCODE_VERSION }),
      stats: vi.fn().mockRejectedValue(new Error("synthetic failure")),
    }),
    ...overrides,
  };
}

describe("OpenCodeStatsAdapter", () => {
  it("requests aggregate-only statistics for the explicit day boundary", async () => {
    const contents = await readFile(
      new URL("./fixtures/opencode-session-stats.json", import.meta.url),
      "utf8",
    );
    const response = (JSON.parse(contents) as { data: unknown }).data;
    const stats = vi.fn().mockResolvedValue(response);
    const adapter = new OpenCodeStatsAdapter(
      dependencies({
        connect: () => ({
          status: vi
            .fn()
            .mockResolvedValue({ version: TESTED_OPENCODE_VERSION }),
          stats,
        }),
      }),
    );
    await expect(
      adapter.report("2026-09-16", "Etc/UTC"),
    ).resolves.toMatchObject({ active: true, timezone: "Etc/UTC" });
    expect(stats).toHaveBeenCalledWith(
      {
        from: Date.parse("2026-09-16T00:00:00.000Z"),
        to: Date.parse("2026-09-17T00:00:00.000Z"),
        timezone: "Etc/UTC",
        tools: "summary",
      },
      expect.any(AbortSignal),
    );
  });

  it("reports an unavailable service without inventing zero usage", async () => {
    const adapter = new OpenCodeStatsAdapter(
      dependencies({ discover: vi.fn().mockResolvedValue(undefined) }),
    );
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toThrow(
      /No healthy local OpenCode service/,
    );
  });

  it("refuses a discovered non-loopback endpoint", async () => {
    const connect = vi.fn();
    const adapter = new OpenCodeStatsAdapter(
      dependencies({
        discover: vi.fn().mockResolvedValue({ url: "https://example.invalid" }),
        connect,
      }),
    );
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toThrow(
      /not a local loopback endpoint/,
    );
    expect(connect).not.toHaveBeenCalled();
  });

  it("rejects an untested service version before requesting statistics", async () => {
    const stats = vi.fn();
    const adapter = new OpenCodeStatsAdapter(
      dependencies({
        connect: () => ({
          status: vi.fn().mockResolvedValue({ version: "2.0.6" }),
          stats,
        }),
      }),
    );
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toThrow(
      /Unsupported local OpenCode version/,
    );
    expect(stats).not.toHaveBeenCalled();
  });

  it("turns transport failures into actionable, sanitized errors", async () => {
    const adapter = new OpenCodeStatsAdapter(dependencies());
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toEqual(
      expect.objectContaining<Partial<OpenCodeReportError>>({
        message: expect.not.stringContaining(
          "synthetic failure",
        ) as unknown as string,
      }),
    );
  });

  it("bounds service discovery", async () => {
    const adapter = new OpenCodeStatsAdapter(
      dependencies({ discover: () => new Promise(() => undefined) }),
      10,
    );
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toThrow(
      /No healthy local OpenCode service/,
    );
  });

  it("bounds statistics requests", async () => {
    const adapter = new OpenCodeStatsAdapter(
      dependencies({
        connect: () => ({
          status: vi
            .fn()
            .mockResolvedValue({ version: TESTED_OPENCODE_VERSION }),
          stats: (_input, signal) =>
            new Promise((_resolve, reject) => {
              signal.addEventListener("abort", () =>
                reject(new Error("request aborted")),
              );
            }),
        }),
      }),
      10,
    );
    await expect(adapter.report("2026-09-16", "Etc/UTC")).rejects.toThrow(
      /timed out after 10 ms/,
    );
  });
});

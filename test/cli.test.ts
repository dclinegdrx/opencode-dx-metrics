import { afterEach, describe, expect, it, vi } from "vitest";

import type { DailySummary } from "../src/contracts.js";
import { run } from "../src/cli.js";

const summary: DailySummary = {
  date: "2026-09-16",
  timezone: "Etc/UTC",
  active: false,
  sessions: 0,
  prompts: 0,
  completedSteps: 0,
  subagents: 0,
  tokens: { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
  providerModels: [],
  estimatedCostUsd: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("report CLI", () => {
  it("renders only the allowlisted DX payload", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const adapter = { report: vi.fn().mockResolvedValue(summary) };
    const result = await run(
      [
        "report",
        "--date",
        summary.date,
        "--timezone",
        summary.timezone,
        "--dry-run",
      ],
      adapter as never,
      { stdout, stderr },
      { DX_EMAIL: "pilot.user@example.invalid" },
    );
    expect(result).toBe(0);
    expect(JSON.parse(stdout.mock.calls[0]?.[0] as string)).toMatchObject({
      data: [
        {
          email: "pilot.user@example.invalid",
          tool: "opencode-pilot",
          is_active: false,
        },
      ],
    });
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("local dry-run only"),
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("requires an explicit pilot identity without querying OpenCode", async () => {
    const stderr = vi.fn();
    const adapter = { report: vi.fn() };
    const result = await run(
      [
        "report",
        "--date",
        summary.date,
        "--timezone",
        summary.timezone,
        "--dry-run",
      ],
      adapter as never,
      { stdout: vi.fn(), stderr },
      {},
    );

    expect(result).toBe(2);
    expect(adapter.report).not.toHaveBeenCalled();
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("DX_EMAIL is required"),
    );
  });

  it("checks local prerequisites and credential presence without exposing secrets", async () => {
    const stdout = vi.fn();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const adapter = { report: vi.fn().mockResolvedValue(summary) };
    const result = await run(
      ["doctor", "--date", summary.date, "--timezone", summary.timezone],
      adapter as never,
      { stdout, stderr: vi.fn() },
      {
        DX_EMAIL: "pilot.user@example.invalid",
        DX_API_URL: "https://dx-secret-host.invalid/api",
        DX_API_TOKEN: "secret-token-value",
      },
    );

    expect(result).toBe(0);
    expect(adapter.report).toHaveBeenCalledWith(summary.date, summary.timezone);
    const output = stdout.mock.calls[0]?.[0] as string;
    expect(JSON.parse(output)).toMatchObject({
      local_ready: true,
      identity: "pilot.user@example.invalid",
      date: summary.date,
      timezone: summary.timezone,
      opencode: { reachable: true, compatible: true },
      export_credentials: {
        endpoint_configured: true,
        token_configured: true,
        required_for_dry_run: false,
      },
    });
    expect(output).not.toContain("dx-secret-host");
    expect(output).not.toContain("secret-token-value");
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    ["missing date", ["report", "--timezone", "Etc/UTC"]],
    ["missing timezone", ["report", "--date", "2026-09-16"]],
    [
      "unknown option",
      [
        "report",
        "--date",
        "2026-09-16",
        "--timezone",
        "Etc/UTC",
        "--email",
        "person@example.invalid",
      ],
    ],
  ])("rejects %s", async (_name, args) => {
    const stderr = vi.fn();
    const result = await run(args, {} as never, { stdout: vi.fn(), stderr });
    expect(result).toBe(2);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining("Usage:"));
  });

  it("does not echo invalid argument values", async () => {
    const stderr = vi.fn();
    const sensitiveLookingValue = "invalid-secret-looking-value";
    const result = await run(
      ["report", "--date", sensitiveLookingValue, "--timezone", "Etc/UTC"],
      {} as never,
      { stdout: vi.fn(), stderr },
    );
    expect(result).toBe(2);
    expect(stderr.mock.calls.flat().join("\n")).not.toContain(
      sensitiveLookingValue,
    );
  });
});

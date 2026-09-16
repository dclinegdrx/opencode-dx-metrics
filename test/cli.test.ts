import { describe, expect, it, vi } from "vitest";

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

describe("report CLI", () => {
  it("renders only the aggregate daily summary", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
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
    );
    expect(result).toBe(0);
    expect(JSON.parse(stdout.mock.calls[0]?.[0] as string)).toEqual(summary);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("local dry-run only"),
    );
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

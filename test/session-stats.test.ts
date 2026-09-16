import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { dateRange } from "../src/date-range.js";
import {
  parseSessionStats,
  StatsCompatibilityError,
} from "../src/session-stats.js";

const request = {
  date: "2026-09-16",
  timezone: "Etc/UTC",
  range: dateRange("2026-09-16", "Etc/UTC"),
};

async function fixture(): Promise<Record<string, unknown>> {
  const contents = await readFile(
    new URL("./fixtures/opencode-session-stats.json", import.meta.url),
    "utf8",
  );
  return (JSON.parse(contents) as { data: Record<string, unknown> }).data;
}

describe("parseSessionStats", () => {
  it("parses aggregate tokens, cache usage, providers, and tool outcomes", async () => {
    const summary = parseSessionStats(await fixture(), request);
    expect(summary).toMatchObject({
      date: request.date,
      timezone: request.timezone,
      active: true,
      sessions: 3,
      prompts: 5,
      completedSteps: 7,
      tokens: {
        input: 2400,
        output: 900,
        reasoning: 120,
        cacheRead: 750,
        cacheWrite: 180,
      },
      toolOutcomes: { calls: 9, succeeded: 8, failed: 1, unfinished: 0 },
    });
    expect(summary.providerModels).toHaveLength(2);
  });

  it.each([
    [1, 0, true],
    [0, 1, true],
    [0, 0, false],
  ])(
    "uses prompts=%i and completed steps=%i for active=%s",
    async (prompts, steps, active) => {
      const response = await fixture();
      response.prompts = prompts;
      response.steps = steps;
      expect(parseSessionStats(response, request).active).toBe(active);
    },
  );

  it("keeps an empty launched session inactive", async () => {
    const response = await fixture();
    Object.assign(response, {
      sessions: 1,
      prompts: 0,
      steps: 0,
      subagents: 0,
      tokens: {
        input: 0,
        output: 0,
        reasoning: 0,
        cache: { read: 0, write: 0 },
      },
      cost: 0,
      tools: { mode: "none" },
      activeDays: 0,
      streak: 0,
      activity: [],
      models: [],
    });
    expect(parseSessionStats(response, request)).toMatchObject({
      active: false,
      sessions: 1,
      prompts: 0,
      completedSteps: 0,
      providerModels: [],
    });
  });

  it("groups duplicate provider/model usage", async () => {
    const response = await fixture();
    const models = response.models as unknown[];
    models.push(structuredClone(models[0]));
    const anthropic = parseSessionStats(response, request).providerModels[0];
    expect(anthropic).toMatchObject({
      provider: "anthropic",
      completedSteps: 8,
      estimatedCostUsd: 0.104,
      tokens: { input: 2800, cacheRead: 1200 },
    });
  });

  it.each([
    [
      "negative total",
      (value: Record<string, unknown>) => (value.prompts = -1),
    ],
    [
      "fractional total",
      (value: Record<string, unknown>) => (value.steps = 1.5),
    ],
    [
      "unsafe integer total",
      (value: Record<string, unknown>) =>
        (value.steps = Number.MAX_SAFE_INTEGER + 1),
    ],
    [
      "non-finite cost",
      (value: Record<string, unknown>) => (value.cost = Number.NaN),
    ],
    ["missing field", (value: Record<string, unknown>) => delete value.tokens],
    [
      "unknown field",
      (value: Record<string, unknown>) => (value.rawSessions = []),
    ],
    [
      "wrong range",
      (value: Record<string, unknown>) =>
        ((value.range as Record<string, unknown>).to = 0),
    ],
    [
      "detailed tools",
      (value: Record<string, unknown>) =>
        (value.tools = { mode: "detail", totals: {}, usage: [] }),
    ],
    [
      "inconsistent tool totals",
      (value: Record<string, unknown>) =>
        (value.tools = {
          mode: "summary",
          totals: { calls: 1, succeeded: 1, failed: 1, unfinished: 0 },
        }),
    ],
    [
      "overflowing grouped total",
      (value: Record<string, unknown>) => {
        const models = value.models as Array<Record<string, unknown>>;
        const duplicate = structuredClone(models[0]);
        (models[0] as Record<string, unknown>).steps = Number.MAX_SAFE_INTEGER;
        if (duplicate !== undefined) {
          duplicate.steps = 1;
          models.push(duplicate);
        }
      },
    ],
  ])("rejects %s", async (_name, mutate) => {
    const response = await fixture();
    mutate(response);
    expect(() => parseSessionStats(response, request)).toThrow(
      StatsCompatibilityError,
    );
  });

  it("does not repeat an unknown field name in compatibility errors", async () => {
    const response = await fixture();
    response["sensitive-looking-field"] = "value";
    let message = "";
    try {
      parseSessionStats(response, request);
    } catch (error) {
      expect(error).toBeInstanceOf(StatsCompatibilityError);
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain("sensitive-looking-field");
  });
});

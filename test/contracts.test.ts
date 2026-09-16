import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { DailySummary, DxDailyMetric } from "../src/contracts.js";
import { PILOT_TOOL } from "../src/contracts.js";

async function loadFixture<T>(name: string): Promise<T> {
  const fixture = await readFile(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(fixture) as T;
}

describe("synthetic contract fixtures", () => {
  it("provides aggregate OpenCode statistics for later parser tests", async () => {
    const fixture = await loadFixture<{
      data: {
        sessions: number;
        prompts: number;
        steps: number;
        models: unknown[];
      };
    }>("opencode-session-stats.json");

    expect(fixture.data).toMatchObject({
      sessions: 3,
      prompts: 5,
      steps: 7,
    });
    expect(fixture.data.models).toHaveLength(2);
  });

  it("matches the typed internal daily summary", async () => {
    const summary = await loadFixture<DailySummary>("daily-summary.json");

    expect(summary.active).toBe(true);
    expect(summary.tokens.cacheRead).toBe(750);
    expect(summary.providerModels.map(({ provider }) => provider)).toEqual([
      "anthropic",
      "openai",
    ]);
  });

  it("matches the intended fixed-tool DX payload", async () => {
    const payload = await loadFixture<{ data: DxDailyMetric[] }>(
      "dx-payload.json",
    );

    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.tool).toBe(PILOT_TOOL);
    expect(payload.data[0]).not.toHaveProperty("spend_cents");
  });
});

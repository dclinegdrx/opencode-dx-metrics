import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import type { DailySummary, DxDailyMetric } from "../src/contracts.js";
import {
  buildDxPayload,
  DxPayloadError,
  renderDxPayload,
  validatePilotEmail,
} from "../src/dx-payload.js";

async function loadFixture<T>(name: string): Promise<T> {
  const fixture = await readFile(
    new URL(`./fixtures/${name}`, import.meta.url),
    "utf8",
  );
  return JSON.parse(fixture) as T;
}

describe("DX payload serializer", () => {
  it("renders the deterministic, fixed-tool fixture without estimated cost", async () => {
    const summary = await loadFixture<DailySummary>("daily-summary.json");
    summary.providerModels.reverse();
    const expected = await loadFixture<{ data: DxDailyMetric[] }>(
      "dx-payload.json",
    );

    const rendered = renderDxPayload(summary, "pilot.user@example.invalid");

    expect(rendered).toBe(JSON.stringify(expected, null, 2));
    expect(rendered).not.toContain("spend_cents");
    expect(rendered).not.toContain("estimatedCostUsd");
  });

  it("maps inactive status and cache tokens", async () => {
    const summary = await loadFixture<DailySummary>("daily-summary.json");
    summary.active = false;
    summary.tokens.cacheRead = 41;
    summary.tokens.cacheWrite = 17;

    const record = buildDxPayload(summary, "pilot.user@example.invalid")
      .data[0];

    expect(record).toMatchObject({
      is_active: false,
      cache_read_tokens: 41,
      cache_write_tokens: 17,
      tool: "opencode-pilot",
    });
  });

  it("omits absent optional aggregate tool outcomes", async () => {
    const summary = await loadFixture<DailySummary>("daily-summary.json");
    delete summary.toolOutcomes;

    const [record] = buildDxPayload(summary, "pilot.user@example.invalid").data;

    expect(record).toBeDefined();
    if (record === undefined) throw new Error("Expected one DX metric record.");
    expect(record.metrics).not.toHaveProperty("tool_outcomes");
  });

  it("constructs only allowlisted fields from a source containing prohibited data", async () => {
    const summary = (await loadFixture<DailySummary>(
      "daily-summary.json",
    )) as DailySummary & Record<string, unknown>;
    summary.sessionId = "raw-session-identifier";
    summary.prompt = "prohibited prompt text";
    summary.path = "/prohibited/source/path";
    summary.secret = "secret-value";
    summary.rawEvent = { detail: "prohibited raw event" };
    summary.unknown = undefined;
    Object.assign(summary.providerModels[0] as object, {
      requestId: "raw-request-identifier",
      toolName: "prohibited-tool-name",
      unknownStat: 999,
    });

    const rendered = renderDxPayload(summary, "pilot.user@example.invalid");

    const parsed = JSON.parse(rendered) as { data: [Record<string, unknown>] };
    expect(parsed.data[0]).not.toHaveProperty("sessionId");
    expect(parsed.data[0]).not.toHaveProperty("prompt");
    expect(parsed.data[0]).not.toHaveProperty("path");
    expect(parsed.data[0]).not.toHaveProperty("secret");
    expect(parsed.data[0]).not.toHaveProperty("unknown");
    expect(parsed.data[0]).not.toHaveProperty("rawEvent");
    expect(
      (parsed.data[0].metrics as { providers: Record<string, unknown>[] })
        .providers[0],
    ).not.toHaveProperty("requestId");
    expect(
      (parsed.data[0].metrics as { providers: Record<string, unknown>[] })
        .providers[0],
    ).not.toHaveProperty("toolName");
    expect(
      (parsed.data[0].metrics as { providers: Record<string, unknown>[] })
        .providers[0],
    ).not.toHaveProperty("unknownStat");
    for (const prohibitedValue of [
      "raw-session-identifier",
      "prohibited prompt text",
      "/prohibited/source/path",
      "secret-value",
      "prohibited raw event",
      "prohibited-tool-name",
      "undefined",
    ]) {
      expect(rendered).not.toContain(prohibitedValue);
    }
    expect(Object.keys(parsed)).toEqual(["data"]);
  });

  it.each(["", "pilot-user", "pilot user@example.invalid", "@example.invalid"])(
    "rejects invalid pilot identity %j",
    (email) => {
      expect(() => validatePilotEmail(email)).toThrow(DxPayloadError);
    },
  );

  it("rejects invalid aggregate counts before rendering", async () => {
    const summary = await loadFixture<DailySummary>("daily-summary.json");
    summary.tokens.input = -1;

    expect(() => buildDxPayload(summary, "pilot.user@example.invalid")).toThrow(
      "tokens.input must be a nonnegative safe integer",
    );
  });
});

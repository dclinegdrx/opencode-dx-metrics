import type {
  AggregateToolOutcomes,
  DailySummary,
  ProviderModelUsage,
  TokenTotals,
} from "./contracts.js";
import type { DateRange } from "./date-range.js";

export class StatsCompatibilityError extends Error {
  override readonly name = "StatsCompatibilityError";
}

export function parseSessionStats(
  response: unknown,
  request: { date: string; timezone: string; range: DateRange },
): DailySummary {
  const root = object(response, "response");
  exactKeys(
    root,
    [
      "range",
      "sessions",
      "subagents",
      "prompts",
      "steps",
      "tokens",
      "cost",
      "tools",
      "activeDays",
      "streak",
      "activity",
      "models",
    ],
    "response",
  );

  const range = object(root.range, "response.range");
  exactKeys(range, ["from", "to"], "response.range");
  const from = count(range.from, "response.range.from");
  const to = count(range.to, "response.range.to");
  if (from !== request.range.from || to !== request.range.to) {
    incompatible(
      "response.range",
      "does not match the requested date boundary",
    );
  }

  const sessions = count(root.sessions, "response.sessions");
  const subagents = count(root.subagents, "response.subagents");
  const prompts = count(root.prompts, "response.prompts");
  const completedSteps = count(root.steps, "response.steps");
  const tokens = tokenTotals(root.tokens, "response.tokens");
  const estimatedCostUsd = cost(root.cost, "response.cost");
  count(root.activeDays, "response.activeDays");
  count(root.streak, "response.streak");
  activity(root.activity);
  const providerModels = groupModels(root.models);
  const toolOutcomes = tools(root.tools);

  return {
    date: request.date,
    timezone: request.timezone,
    active: prompts > 0 || completedSteps > 0,
    sessions,
    prompts,
    completedSteps,
    subagents,
    tokens,
    providerModels,
    estimatedCostUsd,
    ...(toolOutcomes === undefined ? {} : { toolOutcomes }),
  };
}

function groupModels(value: unknown): ProviderModelUsage[] {
  if (!Array.isArray(value))
    incompatible("response.models", "must be an array");
  const grouped = new Map<string, ProviderModelUsage>();

  value.forEach((item, index) => {
    const path = `response.models[${index}]`;
    const entry = object(item, path);
    exactKeys(entry, ["model", "steps", "tokens", "cost"], path);
    const modelRef = object(entry.model, `${path}.model`);
    exactKeys(modelRef, ["id", "providerID", "variant"], `${path}.model`, true);
    const model = nonemptyString(modelRef.id, `${path}.model.id`);
    const provider = nonemptyString(
      modelRef.providerID,
      `${path}.model.providerID`,
    );
    if (modelRef.variant !== undefined) {
      nonemptyString(modelRef.variant, `${path}.model.variant`);
    }
    const usage: ProviderModelUsage = {
      provider,
      model,
      completedSteps: count(entry.steps, `${path}.steps`),
      tokens: tokenTotals(entry.tokens, `${path}.tokens`),
      estimatedCostUsd: cost(entry.cost, `${path}.cost`),
    };
    const key = `${provider}\u0000${model}`;
    const existing = grouped.get(key);
    if (existing === undefined) {
      grouped.set(key, usage);
      return;
    }
    existing.completedSteps = addCounts(
      existing.completedSteps,
      usage.completedSteps,
      `${path}.steps`,
    );
    existing.tokens = addTokens(existing.tokens, usage.tokens);
    existing.estimatedCostUsd = addCosts(
      existing.estimatedCostUsd ?? 0,
      usage.estimatedCostUsd ?? 0,
      `${path}.cost`,
    );
  });

  return [...grouped.values()].sort(
    (left, right) =>
      left.provider.localeCompare(right.provider) ||
      left.model.localeCompare(right.model),
  );
}

function activity(value: unknown): void {
  if (!Array.isArray(value))
    incompatible("response.activity", "must be an array");
  value.forEach((item, index) => {
    const path = `response.activity[${index}]`;
    const entry = object(item, path);
    exactKeys(entry, ["date", "steps"], path);
    nonemptyString(entry.date, `${path}.date`);
    count(entry.steps, `${path}.steps`);
  });
}

function tools(value: unknown): AggregateToolOutcomes | undefined {
  const entry = object(value, "response.tools");
  const mode = nonemptyString(entry.mode, "response.tools.mode");
  if (mode === "none") {
    exactKeys(entry, ["mode"], "response.tools");
    return undefined;
  }
  if (mode !== "summary") {
    incompatible("response.tools.mode", "must be none or summary");
  }
  exactKeys(entry, ["mode", "totals"], "response.tools");
  const totals = object(entry.totals, "response.tools.totals");
  exactKeys(
    totals,
    ["calls", "succeeded", "failed", "unfinished"],
    "response.tools.totals",
  );
  const result = {
    calls: count(totals.calls, "response.tools.totals.calls"),
    succeeded: count(totals.succeeded, "response.tools.totals.succeeded"),
    failed: count(totals.failed, "response.tools.totals.failed"),
    unfinished: count(totals.unfinished, "response.tools.totals.unfinished"),
  };
  const outcomes = addCounts(
    addCounts(result.succeeded, result.failed, "response.tools.totals"),
    result.unfinished,
    "response.tools.totals",
  );
  if (outcomes !== result.calls) {
    incompatible(
      "response.tools.totals",
      "outcomes must add up to the call total",
    );
  }
  return result;
}

function tokenTotals(value: unknown, path: string): TokenTotals {
  const tokens = object(value, path);
  exactKeys(tokens, ["input", "output", "reasoning", "cache"], path);
  const cache = object(tokens.cache, `${path}.cache`);
  exactKeys(cache, ["read", "write"], `${path}.cache`);
  return {
    input: count(tokens.input, `${path}.input`),
    output: count(tokens.output, `${path}.output`),
    reasoning: count(tokens.reasoning, `${path}.reasoning`),
    cacheRead: count(cache.read, `${path}.cache.read`),
    cacheWrite: count(cache.write, `${path}.cache.write`),
  };
}

function addTokens(left: TokenTotals, right: TokenTotals): TokenTotals {
  return {
    input: addCounts(left.input, right.input, "response.models.tokens.input"),
    output: addCounts(
      left.output,
      right.output,
      "response.models.tokens.output",
    ),
    reasoning: addCounts(
      left.reasoning,
      right.reasoning,
      "response.models.tokens.reasoning",
    ),
    cacheRead: addCounts(
      left.cacheRead,
      right.cacheRead,
      "response.models.tokens.cache.read",
    ),
    cacheWrite: addCounts(
      left.cacheWrite,
      right.cacheWrite,
      "response.models.tokens.cache.write",
    ),
  };
}

function addCounts(left: number, right: number, path: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    incompatible(path, "produces a total outside the safe integer range");
  }
  return result;
}

function addCosts(left: number, right: number, path: string): number {
  const result = left + right;
  if (!Number.isFinite(result)) {
    incompatible(path, "produces a non-finite cost total");
  }
  return result;
}

function object(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    incompatible(path, "must be an object");
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  optional = false,
): void {
  const actual = Object.keys(value);
  const unexpected = actual.find((key) => !allowed.includes(key));
  if (unexpected !== undefined)
    incompatible(path, "contains unsupported fields");
  if (!optional) {
    const missing = allowed.find((key) => !(key in value));
    if (missing !== undefined)
      incompatible(`${path}.${missing}`, "is required");
  } else {
    for (const required of ["id", "providerID"]) {
      if (!(required in value))
        incompatible(`${path}.${required}`, "is required");
    }
  }
}

function count(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    incompatible(path, "must be a nonnegative safe integer");
  }
  return value;
}

function cost(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    incompatible(path, "must be a nonnegative finite number");
  }
  return value;
}

function nonemptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    incompatible(path, "must be a nonempty string");
  }
  return value;
}

function incompatible(path: string, reason: string): never {
  throw new StatsCompatibilityError(
    `OpenCode session statistics are incompatible: ${path} ${reason}.`,
  );
}

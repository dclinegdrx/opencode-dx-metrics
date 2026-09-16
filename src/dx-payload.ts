import {
  type DailySummary,
  type DxDailyMetric,
  PILOT_TOOL,
} from "./contracts.js";
import { validateDate, validateTimezone } from "./date-range.js";

export interface DxPushAllPayload {
  data: DxDailyMetric[];
}

export class DxPayloadError extends Error {
  override readonly name = "DxPayloadError";
}

export function validatePilotEmail(email: string): void {
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    containsControlCharacter(email)
  ) {
    throw new DxPayloadError(
      "DX_EMAIL must be a syntactically valid email address.",
    );
  }
}

/** Construct a new object so no unrecognized source field can cross the boundary. */
export function buildDxPayload(
  summary: DailySummary,
  email: string,
): DxPushAllPayload {
  validatePilotEmail(email);
  validateDate(summary.date);
  validateTimezone(summary.timezone);
  if (typeof summary.active !== "boolean") {
    invalid("active", "must be a boolean");
  }

  const providers = summary.providerModels
    .map((usage, index) => {
      const path = `providerModels[${index}]`;
      return {
        provider: label(usage.provider, `${path}.provider`),
        model: label(usage.model, `${path}.model`),
        completed_steps: count(usage.completedSteps, `${path}.completedSteps`),
        input_tokens: count(usage.tokens.input, `${path}.tokens.input`),
        output_tokens: count(usage.tokens.output, `${path}.tokens.output`),
        reasoning_tokens: count(
          usage.tokens.reasoning,
          `${path}.tokens.reasoning`,
        ),
        cache_read_tokens: count(
          usage.tokens.cacheRead,
          `${path}.tokens.cacheRead`,
        ),
        cache_write_tokens: count(
          usage.tokens.cacheWrite,
          `${path}.tokens.cacheWrite`,
        ),
      };
    })
    .sort(
      (left, right) =>
        left.provider.localeCompare(right.provider) ||
        left.model.localeCompare(right.model),
    );

  const toolOutcomes = summary.toolOutcomes;
  const record: DxDailyMetric = {
    email,
    date: summary.date,
    is_active: summary.active,
    tool: PILOT_TOOL,
    input_tokens: count(summary.tokens.input, "tokens.input"),
    output_tokens: count(summary.tokens.output, "tokens.output"),
    cache_read_tokens: count(summary.tokens.cacheRead, "tokens.cacheRead"),
    cache_write_tokens: count(summary.tokens.cacheWrite, "tokens.cacheWrite"),
    metrics: {
      sessions: count(summary.sessions, "sessions"),
      prompts: count(summary.prompts, "prompts"),
      completed_steps: count(summary.completedSteps, "completedSteps"),
      subagents: count(summary.subagents, "subagents"),
      reasoning_tokens: count(summary.tokens.reasoning, "tokens.reasoning"),
      providers,
      ...(toolOutcomes === undefined
        ? {}
        : {
            tool_outcomes: {
              calls: count(toolOutcomes.calls, "toolOutcomes.calls"),
              succeeded: count(
                toolOutcomes.succeeded,
                "toolOutcomes.succeeded",
              ),
              failed: count(toolOutcomes.failed, "toolOutcomes.failed"),
              unfinished: count(
                toolOutcomes.unfinished,
                "toolOutcomes.unfinished",
              ),
            },
          }),
    },
  };

  return { data: [record] };
}

export function renderDxPayload(summary: DailySummary, email: string): string {
  return JSON.stringify(buildDxPayload(summary, email), null, 2);
}

function count(value: number, path: string): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    invalid(path, "must be a nonnegative safe integer");
  }
  return value;
}

function label(value: string, path: string): string {
  if (
    typeof value !== "string" ||
    value.trim() === "" ||
    containsControlCharacter(value)
  ) {
    invalid(
      path,
      "must be a nonempty aggregate label without control characters",
    );
  }
  return value;
}

function containsControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  });
}

function invalid(path: string, reason: string): never {
  throw new DxPayloadError(`Cannot construct DX payload: ${path} ${reason}.`);
}

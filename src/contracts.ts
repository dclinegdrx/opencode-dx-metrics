/** Aggregate-only usage data that may cross the prototype's serialization boundary. */
export interface TokenTotals {
  input: number;
  output: number;
  reasoning: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface AggregateToolOutcomes {
  calls: number;
  succeeded: number;
  failed: number;
  unfinished: number;
}

export interface ProviderModelUsage {
  provider: string;
  model: string;
  completedSteps: number;
  tokens: TokenTotals;
  estimatedCostUsd?: number;
}

/** Internal, aggregate summary for one explicit calendar date and timezone. */
export interface DailySummary {
  date: string;
  timezone: string;
  active: boolean;
  sessions: number;
  prompts: number;
  completedSteps: number;
  subagents: number;
  tokens: TokenTotals;
  providerModels: ProviderModelUsage[];
  estimatedCostUsd?: number;
  toolOutcomes?: AggregateToolOutcomes;
}

export const PILOT_TOOL = "opencode-pilot" as const;

export interface DxMetrics {
  sessions: number;
  prompts: number;
  completed_steps: number;
  subagents: number;
  reasoning_tokens: number;
  providers: Array<{
    provider: string;
    model: string;
    completed_steps: number;
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens: number;
    cache_read_tokens: number;
    cache_write_tokens: number;
  }>;
  tool_outcomes?: AggregateToolOutcomes;
}

/** Intended allowlisted record for DX aiToolMetrics.pushAll. */
export interface DxDailyMetric {
  email: string;
  date: string;
  is_active: boolean;
  tool: typeof PILOT_TOOL;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_write_tokens: number;
  spend_cents?: number;
  metrics: DxMetrics;
}

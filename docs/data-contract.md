# OpenCode Daily Aggregate Data Contract

**Status:** Prototype contract  
**Last reviewed:** 2026-09-16  
**Maintainer:** Prototype owner

## Purpose

This contract defines the aggregate data allowed inside the prototype and the smaller allowlist intended for DX. The TypeScript declarations live in [`src/contracts.ts`](../src/contracts.ts). The OpenCode adapter parses untrusted local statistics into the internal summary, and [`src/dx-payload.ts`](../src/dx-payload.ts) constructs a new outbound object from the allowlist without passing through arbitrary source fields.

## Grain and Identity

Each summary covers one explicit `YYYY-MM-DD` calendar date in one explicit IANA timezone. Host timezone is not an implicit default.

Each intended DX record covers one configured email, date, and tool. The pilot tool is fixed:

```text
tool = opencode-pilot
```

The email must be supplied explicitly through pilot configuration. Git username and email are prohibited identity sources.

## Active-day Rule

`active` and DX `is_active` are true when the selected day contains at least one user prompt or at least one completed model step. Merely launching OpenCode, creating an empty session, or leaving an incomplete response does not make a day active.

A supported, successfully queried day with no activity may produce a zero-valued inactive summary. A transport, parsing, or compatibility error must not be converted into such a summary.

## Internal Daily Summary

| Field              | Type                        | Meaning                                                                                |
| ------------------ | --------------------------- | -------------------------------------------------------------------------------------- |
| `date`             | string                      | Requested calendar date in `YYYY-MM-DD` form.                                          |
| `timezone`         | string                      | Explicit IANA timezone used for the date boundary.                                     |
| `active`           | boolean                     | Result of the active-day rule.                                                         |
| `sessions`         | nonnegative integer         | Aggregate sessions intersecting the selected range, subject to OpenCode API semantics. |
| `prompts`          | nonnegative integer         | Aggregate user prompts.                                                                |
| `completedSteps`   | nonnegative integer         | Aggregate completed model steps.                                                       |
| `subagents`        | nonnegative integer         | Aggregate subagent sessions/activity as defined by the tested API version.             |
| `tokens`           | `TokenTotals`               | Input, output, reasoning, cache-read, and cache-write totals.                          |
| `providerModels`   | array                       | Aggregate usage grouped by provider and model.                                         |
| `estimatedCostUsd` | optional nonnegative number | OpenCode-calculated estimate retained locally with provenance; not billing truth.      |
| `toolOutcomes`     | optional object             | Aggregate calls, succeeded, failed, and unfinished counts only.                        |

Every provider/model item permits `provider`, `model`, `completedSteps`, token totals, and optional local estimated cost. It must not carry request, session, message, or account identifiers.

## Intended DX Mapping

The request envelope is `{ "data": [record] }`. GoodRx implementation evidence documents `POST /api/aiToolMetrics.pushAll` with bearer authentication; endpoint and credential configuration remain untracked and are not needed for dry-run work.

### Top-level outbound allowlist

| DX field             | Source                        | Rule                                                                                                                |
| -------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `email`              | explicit pilot configuration  | Required; never inferred from Git.                                                                                  |
| `date`               | `DailySummary.date`           | Required.                                                                                                           |
| `is_active`          | `DailySummary.active`         | Required.                                                                                                           |
| `tool`               | constant                      | Always `opencode-pilot`.                                                                                            |
| `input_tokens`       | `tokens.input`                | Nonnegative aggregate.                                                                                              |
| `output_tokens`      | `tokens.output`               | Nonnegative aggregate.                                                                                              |
| `cache_read_tokens`  | `tokens.cacheRead`            | Nonnegative aggregate.                                                                                              |
| `cache_write_tokens` | `tokens.cacheWrite`           | Nonnegative aggregate.                                                                                              |
| `spend_cents`        | approved estimate policy only | Omitted by default. If approved, use integer cents and include estimate provenance/version in allowlisted metadata. |
| `metrics`            | allowlisted aggregates below  | Required object; no unknown keys.                                                                                   |

### `metrics` allowlist

- `sessions`
- `prompts`
- `completed_steps`
- `subagents`
- `reasoning_tokens`
- `providers`, where each element contains only `provider`, `model`, `completed_steps`, `input_tokens`, `output_tokens`, `reasoning_tokens`, `cache_read_tokens`, and `cache_write_tokens`
- optional `tool_outcomes`, containing only `calls`, `succeeded`, `failed`, and `unfinished`
- optional estimate provenance/version only if a later approved cost policy defines exact field names

The serializer constructs a new object from these fields. It does not pass through an OpenCode response or arbitrary metadata object. Provider/model groups are sorted by provider then model so equivalent summaries render deterministically.

## Cost Policy

OpenCode's calculated USD cost may not reflect negotiated prices, a gateway's pricing, or subscription-backed usage. `estimatedCostUsd` therefore remains local and optional. `spend_cents` must be absent unless all of the following are recorded:

1. the cost source and currency/units are verified;
2. DX confirms how it presents and aggregates the value;
3. reviewers approve an estimate label and provenance/version fields;
4. conversion to integer cents has a documented rounding rule.

## Prohibited Data

The internal summary, rendered report, DX payload, logs, fixtures, and checked-in evidence must not include:

- prompts, assistant text, reasoning text, source code, diffs, or file contents;
- file paths, repository names/URLs, project IDs, branch names, or working directories;
- session, message, request, trace, source-row, device, or account identifiers;
- tool names, arguments, input, output, per-call duration, or raw tool events;
- environment values, configuration contents, tokens, API keys, authorization headers, cookies, or service registration credentials;
- raw OpenCode API responses, raw DX responses, raw database rows, or copied production exports;
- Git identity or any identity inferred from local repository configuration;
- per-session, per-prompt, per-request, or event-level timestamps;
- arbitrary/unknown metadata, unrecognized statistics, undefined values, or fields outside the allowlists above;
- real employee email addresses or personal data in fixtures and documentation.

Provider and model identifiers are permitted only as aggregate grouping labels. Aggregate tool outcomes are optional, but tool names are prohibited even if OpenCode can provide detailed tool statistics.

## Validation Rules

The runtime parser rejects malformed dates, invalid timezones, negative/non-finite/fractional counts, non-finite costs, unknown response shapes, and unsupported OpenCode versions. The outbound serializer revalidates its date, timezone, identity, labels, and counts. Tests prove prohibited, undefined, and unknown source fields cannot enter JSON output. `spend_cents` is not implemented because no estimate policy is approved.

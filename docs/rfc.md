# RFC: Opt-in OpenCode-to-DX Metrics Pilot

**Status:** Draft for Justin Ross and AI Enablement review  
**Decision owners:** Justin Ross and AI Enablement, with DX contract input  
**Last reviewed:** 2026-09-16  
**Maintainer:** Prototype owner

## Decision Request

Approve a limited, opt-in pilot in which one volunteer reviews and manually submits one sanitized OpenCode daily aggregate to DX under the temporary tool name `opencode-pilot`. Approval is not a production rollout, a device-management deployment, or a mandate to adopt or continue using OpenCode.

Before any submission, DX reviewers must confirm the test identity, credential handling, reporting timezone, tool visibility, and duplicate/correction behavior listed in the [DX decision log](dx-validation.md#decision-log). A blocker on any of those items keeps the prototype in dry-run mode.

## Problem

OpenCode can route work to several model providers, but existing vendor connectors do not show aggregate OpenCode-harness activity by underlying provider and model. This leaves a gap when assessing prototype adoption and estimated model usage. It also complicates cost review because OpenCode's calculated cost may differ from contracted billing, gateway pricing, or subscription-backed use.

DX already accepts bespoke AI-tool daily aggregates. A small prototype can test whether a sanitized OpenCode record reaches the intended DX reporting tables without collecting prompts, source data, or session-level details.

## Goals

- Produce one daily summary from OpenCode's aggregate statistics for an explicit date and timezone.
- Break down tokens and completed steps by provider and model while keeping the DX tool identity fixed as `opencode-pilot`.
- Let a pilot owner inspect the exact payload before network activity.
- Verify identity matching, token/cache preservation, source-to-normalized lineage, and report visibility with one controlled submission.
- Gather enough evidence to decide whether an opt-in pilot should continue and what a production design would require.

## Non-goals

- Broad rollout, scheduled collection, automatic replay, or background telemetry.
- An OpenCode plugin or work on OpenCode's interactive request path.
- Authoritative provider spend or replacement of provider billing records.
- Summing OpenCode harness data with vendor-connector data.
- Policy enforcement, model limits, or a requirement to use OpenCode.
- Initial Bedrock or LiteLLM validation; those remain follow-up coverage targets.

## Proposed Design

```text
OpenCode local background service
  -> experimental GET /api/experimental/session/stats
  -> validate and aggregate one date in an explicit timezone
  -> sanitize through a strict allowlist
  -> report --dry-run (default path)
  -> explicit export (one approved user/date after review)
  -> DX POST /api/aiToolMetrics.pushAll
```

The CLI will use OpenCode's supported V2 client and local service discovery rather than reading its database. Service calls will have bounded timeouts, and an unavailable or incompatible experimental endpoint will fail with a nonzero exit instead of inventing zero usage. The standalone CLI keeps the submission boundary replaceable by a centrally authenticated relay if the pilot proceeds.

## Data Boundary

The [data contract](data-contract.md) allows daily counts, token/cache totals, aggregate provider/model usage, and optional aggregate tool-call outcomes. An active day has at least one user prompt or completed model step. Launching OpenCode alone is inactive.

The pilot requires an explicitly configured reporting email. It does not infer identity from Git. Cost remains absent from DX payloads unless OpenCode's cost source, units, and presentation have been validated and an estimate policy has been approved.

The serializer must reject or omit every value outside the allowlist, including session identifiers, prompts, paths, tool details, source code, raw events, and configuration secrets.

## Harness and Provider Overlap Policy

`tool: "opencode-pilot"` means the OpenCode harness generated the record. Provider and model values describe the aggregate model calls behind that harness; they do not change the tool identity.

OpenAI/Codex activity can appear both in this OpenCode record and in DX's existing Codex connector data. Reports may compare those sources, but they must not add them together as organization-wide vendor usage or spend unless DX approves a deduplication or report-filter policy. The prototype does not attempt record-level matching because its privacy boundary excludes session identifiers.

## Pilot Scope and Sequence

1. Build and test local dry-run aggregation with synthetic fixtures.
2. Produce redacted local evidence for at least one direct Anthropic-backed session and one OpenAI/Codex-backed session.
3. Review the deterministic DX payload and run configuration preflight checks.
4. Resolve every submission prerequisite in the decision log.
5. Submit one record for one approved identity and date, once.
6. Validate bespoke-to-normalized lineage and report visibility using aggregate evidence only.

The pilot stops at dry-run if the OpenCode contract is incompatible, identity cannot be approved, secrets cannot be handled safely, or DX cannot explain duplicate/correction behavior well enough for a one-time submission.

## Acceptance Criteria

- The local report shows Anthropic and OpenAI/Codex aggregate provider/model usage for tested sessions and handles a no-usage day correctly.
- Invalid dates, malformed statistics, timeouts, and an unavailable OpenCode service fail clearly without affecting normal OpenCode work.
- A reviewer can inspect a deterministic allowlisted payload containing no prohibited data or cost by default.
- The approved pilot submission, if unblocked, preserves identity, active status, and token/cache totals through the documented DX lineage.
- Results distinguish measured behavior from assumptions and retain the overlap warning.

## Alternatives Considered

### Use provider connectors only

Provider connectors remain authoritative for provider-level billing, but they do not answer which work passed through the OpenCode harness or provide one comparable aggregate across its configured providers.

### Read the OpenCode database directly

Rejected because it couples the prototype to private storage and expands access to session-level data. The supported local service/client boundary is narrower and version-detectable.

### Build an OpenCode plugin first

Rejected for the prototype because export work on the interactive path increases operational risk and makes disabling the experiment harder. A manual CLI is easier to inspect and stop.

### Build the production relay now

Deferred until DX ingestion, identity, timezone, visibility, and duplicate semantics are verified. A future relay is still the preferred broad-rollout submission boundary because it can centralize credentials, rate limits, retries, and monitoring.

## Risks and Controls

| Risk                              | Prototype control                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| Double counting Codex/OpenAI      | Keep `opencode-pilot` separate and prohibit additive vendor-spend reporting.                     |
| Experimental OpenCode API changes | Pin the tested version, validate the complete response shape, and fail closed.                   |
| Sensitive data leakage            | Aggregate-only adapter, strict serializer allowlist, synthetic fixtures, and privacy inspection. |
| Duplicate DX rows                 | One manual submission; no retry or lookback until DX documents semantics.                        |
| Incorrect cost                    | Omit `spend_cents` by default and label local cost as an estimate.                               |
| Identity mismatch                 | Require explicit identity and preflight the approved volunteer before export.                    |
| OpenCode interference             | Read-only local calls with bounded timeouts; no database or session mutation.                    |

## Future Constraints and Enforcement

Usage limits, model policy, automated controls, and mandate enforcement are outside this RFC. If the pilot supports broader work, a separate decision must cover a centrally authenticated GoodRx relay, managed identity/configuration, durable delivery, retry safety, retention, notification/opt-out, compatibility monitoring, and a disable path.

## Open Decisions

The current facts, validation queries, and unresolved questions are maintained in [docs/dx-validation.md](dx-validation.md). No export work begins until that document records approved answers for all Phase 4 prerequisites.

# OpenCode-to-DX Metrics Prototype and RFC Plan

**Status:** Planning

## Overview

Build a private, opt-in prototype that reads aggregate usage from a local OpenCode V2.5 installation and, on an explicit manual command, can publish one sanitized daily aggregate to DX's `aiToolMetrics.pushAll` API. The prototype will use `opencode-pilot` as its DX tool identity until the pilot is approved and DX behavior is verified.

The primary outcome is cost and usage visibility by underlying provider/model for activity performed through the OpenCode harness. The same data may support adoption reporting, but it must not be presented as an additive replacement for authoritative provider billing data. In particular, OpenCode records for Codex/OpenAI can overlap DX's existing Codex connector records.

The planned architecture is deliberately small and reversible:

```text
OpenCode V2.5 local service / experimental session-stats API
                         |
                         v
  TypeScript CLI: validate -> aggregate -> sanitize -> render payload
                         |
                         +-- `report --dry-run` (default prototype path)
                         |
                         v
       explicit `export` command (one approved pilot user/day only)
                         |
                         v
               DX aiToolMetrics.pushAll API
                         |
                         v
bespoke_ai_tool_daily_metrics -> ai_tool_daily_metrics -> DX reporting
```

The first prototype is a manually invoked CLI, not an OpenCode plugin, daemon, scheduled job, device-management rollout, or production telemetry service. A future managed relay is the preferred broad-rollout design, so the submission boundary must remain replaceable.

## Intended Base Branch / Comparison Reference

`main` in `dclinegdrx/opencode-dx-metrics`. At plan creation the repository is intentionally empty and `main` has no commit history, so the first implementation commit establishes the baseline.

## Important Assumptions and Constraints

- Scope is OpenCode V2.5, available on 2026-09-16. Its session-stats API is experimental; the CLI must detect unavailable or incompatible API behavior and fail safely.
- The required minimum local demonstration is one direct Anthropic-backed session and one OpenAI/Codex-backed session. Bedrock and LiteLLM are explicit follow-up coverage targets, not initial gates.
- Prototype records represent the **OpenCode harness** and use `tool: "opencode-pilot"`; provider and model are aggregate breakdowns in `metrics`, not alternate tool identities.
- An active day means at least one user prompt or completed model step. Launching OpenCode alone is not activity.
- Tool-call outcome totals are optional prototype metrics. Do not collect tool names, arguments, outputs, paths, or raw event payloads.
- The pilot requires explicit `DX_EMAIL`-style identity configuration. Do not infer a reporting identity from Git configuration.
- Initial spend is optional. Omit `spend_cents` rather than reporting a misleading value until OpenCode's calculated cost, pricing assumptions, and DX presentation are validated.
- Treat the private repository as public-safe: never commit DX tokens, employee data, session IDs, raw OpenCode statistics, prompts, source code, repository paths, or copied production DX exports. Use synthetic fixtures and redacted evidence.
- Existing DX evidence establishes that `bespoke_ai_tool_daily_metrics` records can normalize into `ai_tool_daily_metrics`, but DX's duplicate, correction, tool-registration, timezone, and credential semantics remain unverified.

## Risks and Design Attention Areas

- **Double counting:** Codex/OpenAI activity from OpenCode can also appear through DX's vendor connector. Keep harness and vendor metrics distinct in both the RFC and pilot reporting.
- **Experimental API compatibility:** Pin and record the tested OpenCode version, validate response shape at runtime, and make API incompatibility an actionable error rather than silently emitting partial data.
- **Daily-boundary correctness:** Do not assume local-machine timezone equals DX reporting timezone. The prototype must declare the selected timezone in output and defer canonical policy to the DX decision log.
- **Retries and idempotency:** Do not implement automatic replay, rolling lookback, or a durable queue until DX confirms upsert/correction behavior. The manual prototype must avoid accidental duplicate submissions.
- **Authentication:** A Data Cloud bearer token is sensitive. Keep it in an untracked environment variable or approved local secret store for the controlled test only; never log it. A centrally authenticated GoodRx relay is a production rollout prerequisite.
- **Cost accuracy:** OpenCode calculated cost may not match contracted provider billing, gateway pricing, or subscription-backed use. Clearly label any exported cost as an estimate and exclude it until accepted.
- **Data minimization:** The serializer is the enforcement point. It must allow only declared aggregate fields and reject/omit unknown or sensitive values before rendering or sending a payload.
- **User matching:** DX may not resolve every supplied email to a DX user. Preflight identity validation and document unmatched-email behavior as a pilot result.
- **Operational non-interference:** All local service calls need bounded timeouts; a failure must not block or alter normal OpenCode usage.

## Phase 1: Establish the prototype contract and reviewable RFC baseline

**Status: COMPLETE**

### Goal

The repository has a reproducible TypeScript project foundation and a concise RFC draft that asks Justin Ross and AI Enablement to approve a limited, opt-in pilot. The scope, data boundary, validation evidence, and unresolved DX decisions are visible before any real data is exported.

### Implementation

- Initialize the repository's minimal Node/TypeScript tooling using current OpenCode-compatible versions and repository-standard scripts. Add only necessary development dependencies and an appropriate `.gitignore` for Node artifacts, local configuration, and generated pilot output.
- Create a `README.md` describing prototype status, local-only/manual operation, explicit non-goals, privacy boundary, and links to the RFC and validation artifacts.
- Add `docs/rfc.md` for Justin and AI Enablement. Include the observability/cost-reporting gap, goals and non-goals, proposed CLI architecture, decision request, provider/harness overlap policy, pilot scope, acceptance criteria, alternatives considered, and future constraints/enforcement as a non-goal.
- Add `docs/data-contract.md` defining the typed daily summary and intended DX mapping. Specify `opencode-pilot`, the active-day rule, explicit identity, optional `spend_cents`, permitted aggregate provider/model metrics, and every prohibited category of data.
- Add `docs/dx-validation.md` with sanitized existing lineage evidence (`bespoke_ai_tool_daily_metrics` to `ai_tool_daily_metrics`), the validation SQL queries, expected observations, and an explicit decision log for unresolved DX questions: idempotency, correction path, canonical timezone, bespoke tool registration/visibility, spend behavior, and approved authentication.
- Add `docs/prototype-test-plan.md` covering direct Anthropic and Codex/OpenAI sessions, cache usage when available, zero-usage days, API incompatibility, mismatched identity, unavailable DX, repeated export attempts, and privacy inspection.
- Add synthetic, clearly fictional fixtures under `test/fixtures/` for OpenCode statistics and DX payloads. Do not commit real user or session data.

### Verification

- Run the repository's install, typecheck, lint, formatting, and test commands once they are introduced; document the exact commands in the README.
- Review all committed examples and fixtures for tokens, employee emails, session IDs, paths, prompts, source code, and copied DX result data.
- Confirm the RFC's requested decision is limited to an opt-in pilot, not a production rollout or a mandate to continue using OpenCode.
- Confirm the RFC clearly distinguishes OpenCode harness data from provider/vendor usage and says Codex totals may overlap.

### Completion Criteria

- The repository can be installed and validated from a clean checkout using documented commands.
- A reviewer can understand the proposed data flow, pilot boundaries, and unresolved DX contract questions without conversation history.
- The data contract contains an explicit allowlist of outbound fields and a prohibited-data list.
- Synthetic fixtures support later implementation without exposing GoodRx data.

## Phase 2: Produce validated local OpenCode daily summaries without network access

**Status: COMPLETE**

### Goal

The CLI can explicitly query OpenCode V2.5 through its supported local service/client discovery path, aggregate a requested date into a typed internal daily summary, and report meaningful diagnostics. It makes no outbound DX request and does not read OpenCode databases directly.

### Implementation

- Implement a small CLI with a read-only command such as `report --date YYYY-MM-DD --dry-run`; default to no network capability.
- Use the supported OpenCode client/service mechanism to locate the local service, then query the experimental session-stats endpoint. Encapsulate OpenCode transport and response parsing behind a dedicated adapter so an API version change remains localized.
- Define typed internal models for token totals, calculated cost, sessions, prompts, steps, subagents, aggregate provider/model usage, and optional aggregate tool-call outcomes.
- Validate the requested date format and reporting timezone. Make timezone selection explicit through configuration/flag and print it in diagnostics; do not silently depend on host defaults.
- Detect unavailable service, connection timeout, unsupported response version/shape, and malformed totals. Return a nonzero exit with actionable guidance, and never invent zero data in place of an error.
- Implement the active-day rule from prompts or completed model steps, with tests covering sessions with no completed responses.
- Keep logs and rendered reports aggregate-only. Never print raw sessions, prompts, paths, tool payloads, or configuration secrets.
- Add unit tests using the synthetic fixtures, including token/cache aggregation, provider/model grouping, active/inactive decisions, zero-usage output, malformed response rejection, and OpenCode-service failure handling.

### Verification

- Run the full repository quality suite and targeted CLI unit tests.
- On a developer machine with OpenCode V2.5, run the dry-run command for a known usage date and a known no-usage date; save only redacted aggregate output outside version control if needed for review.
- Execute the minimum manual coverage: one direct Anthropic-backed session and one OpenAI/Codex-backed session, then verify both are represented in aggregate provider/model output.
- Confirm that OpenCode being stopped, unavailable, or incompatible produces a bounded failure and does not affect a separate normal OpenCode session.

### Completion Criteria

- The CLI produces a typed, sanitized local daily summary for supported OpenCode V2.5 data without network access.
- Minimum Anthropic and Codex/OpenAI evidence is documented in redacted form in `docs/dx-validation.md`.
- The command rejects invalid dates, incompatible statistics, and unavailable OpenCode service clearly rather than emitting misleading telemetry.
- Automated tests cover the aggregation and privacy-sensitive output boundary.

## Phase 3: Render and validate a DX-compatible pilot payload in dry-run mode

**Status: NOT STARTED**

### Goal

The CLI deterministically converts a local daily summary into a data-minimized `aiToolMetrics.pushAll` payload for `opencode-pilot`, validates it before any network activity, and provides a `doctor` preflight command. No DX credentials or calls are required to complete this phase.

### Implementation

- Implement a DX payload serializer that maps the internal summary to documented fields: `email`, `date`, `is_active`, `tool`, input/output/cache token fields, optional `spend_cents`, and an allowlisted aggregate `metrics` object.
- Require explicit pilot email configuration. Validate that it is syntactically valid and display the chosen identity in dry-run output. Do not read Git identity as a fallback.
- Keep `tool` fixed as `opencode-pilot` in prototype configuration; do not use `opencode` until DX registration and reporting behavior are approved.
- Omit `spend_cents` by default. Add a clearly opt-in estimate policy only if the cost source and units are verified, with estimate provenance/version included in aggregate metadata.
- Implement a `doctor` command that checks required local configuration, OpenCode reachability/version, date/timezone settings, and whether export credentials are configured without exposing secret values.
- Establish a strict payload allowlist and tests asserting that prohibited fields, undefined values, raw IDs, and unknown stats cannot enter JSON output.
- Add stable JSON formatting or machine-readable output suitable for review and snapshot tests. Document sample payloads using fictional addresses and values only.

### Verification

- Run unit and snapshot tests for payload construction, optional cost omission, cache-token mapping, active-day mapping, identity validation, and secret redaction.
- Run `doctor` and `report --dry-run` against a local V2.5 service using configured fictional/test identity where practical; inspect the exact emitted JSON before proceeding.
- Compare the aggregate token and session values in dry-run output against the corresponding OpenCode session-stats totals for the same date.
- Verify that dry-run execution performs no DNS/HTTP request to DX and that output does not include forbidden content.

### Completion Criteria

- A reviewer can inspect one deterministic, sanitized `opencode-pilot` payload before any data leaves the device.
- Every outbound field has a documented mapping and test coverage.
- Cost remains absent unless an explicit validated estimate policy is selected.
- `doctor` identifies missing configuration or incompatible local prerequisites before an export is attempted.

## Phase 4: Validate DX ingestion with one controlled, explicit pilot submission

**Status: NOT STARTED**

### Goal

With Justin/DX approval and a controlled volunteer identity, the CLI submits exactly one reviewed pilot aggregate to DX and produces evidence that DX preserves and normalizes it into reporting data.

### Implementation

- Do not begin this phase until the RFC decision log records an approved test identity, approved credential handling, test tool registration expectation, reporting timezone, and DX guidance on duplicate/correction behavior.
- Add an explicit `export --date YYYY-MM-DD` command that requires confirmation or a deliberate noninteractive acknowledgement flag. It must render/validate the payload before submission and use `aiToolMetrics.pushAll` with bounded HTTP timeout.
- Obtain the DX endpoint and bearer token only from untracked environment variables or an approved local secret mechanism. Redact authorization headers and secrets from all errors and logs.
- Restrict initial export behavior to a one-record, one-user, one-date request; do not add background scheduling, automatic retry, queueing, lookback, or bulk export while idempotency remains unknown.
- Capture structured, sanitized request metadata (date, tool, field-presence/count summaries, response status/request correlation if safe) for the validation document without storing the bearer token or source content.
- Update `docs/dx-validation.md` with the sanitized submission timestamp, payload totals, DX response outcome, identity matching result, and lineage-query findings.
- Run the approved lineage query using `source_table_uuid` to verify `opencode-pilot` data flows from `bespoke_ai_tool_daily_metrics` to `ai_tool_daily_metrics`; record only redacted/aggregate evidence in the repository.

### Verification

- First run the exact export command in dry-run mode and have the pilot owner review its payload.
- Submit once only after approval; verify the API response is successful and no secret appears in local output.
- In DX Data Studio, confirm the bespoke source row exists, its normalized daily row references the source UUID, `is_active` and all submitted token/cache fields are preserved, and the supplied email resolves as expected.
- Confirm whether `opencode-pilot` is visible in the intended AI Cost Management and/or Data Studio view; log any DX configuration dependency.
- Attempt no duplicate submission unless DX explicitly provides safe idempotency/correction semantics. If a duplicate behavior test is approved, perform it with a separately agreed test date and document the outcome.

### Completion Criteria

- One reviewed `opencode-pilot` record has an auditable, redacted end-to-end result or a precisely documented DX blocker.
- The source-to-normalized DX lineage, identity resolution, active flag, and token/cache preservation are verified.
- The RFC decision log records the actual DX answers for duplicate/correction behavior, visibility, timezone, credentials, and cost treatment, or explicitly identifies each unresolved blocker.
- The prototype remains manual and safe to rerun without automatic repeat exports.

## Phase 5: Complete the RFC recommendation and define the productionization decision

**Status: NOT STARTED**

### Goal

Justin and AI Enablement receive a decision-ready RFC grounded in the prototype evidence, including a bounded recommendation for an opt-in pilot and a clear separation between validated behavior and future work.

### Implementation

- Update `docs/rfc.md` with measured, redacted prototype outcomes for direct Anthropic and Codex/OpenAI activity; state whether estimated cost was included or intentionally omitted.
- Finalize the reporting policy: OpenCode is the harness identity, provider/model information remains an aggregate breakdown, and Codex/OpenAI vendor data must not be summed with OpenCode data for organization-wide vendor spend without an approved deduplication rule.
- Record approved/unapproved next steps for Bedrock and LiteLLM coverage, provider-specific reporting, and future policy/limit enforcement. Do not implement controls in this repository phase.
- Document the recommended production architecture: centrally authenticated GoodRx relay, device-managed configuration and identity approach (to be evaluated with IT/Jamf/Kolide/Okta owners), rate limiting, authenticated submission, local durable queue, retry/backoff, and monitored ingestion health.
- Add a short operational and privacy checklist for the future rollout: secret ownership/rotation, opt-in/notification, retention, logging policy, support owner, DX dashboard ownership, compatibility versioning, and rollback/disable mechanism.
- Update README status and links so reviewers can find the final RFC, data contract, DX validation evidence, and test plan.

### Verification

- Review the RFC with Justin/AI Enablement against the exact decision request: approve a limited, opt-in OpenCode-to-DX pilot or identify blockers.
- Verify every technical claim in the RFC is linked to a documented test, DX evidence, or explicitly labeled assumption.
- Verify the recommendation does not claim authoritative provider billing accuracy, native DX/OpenCode support, or automatic duplicate-safe export unless those facts were proven.
- Rerun the repository quality suite and dry-run commands after the final documentation changes.

### Completion Criteria

- The RFC contains a clear pilot recommendation, acceptance criteria, reporting caveats, and named decisions required before wider rollout.
- All prototype claims are evidenced or explicitly bounded as assumptions.
- The repository gives a future implementation owner an actionable productionization path without treating it as already approved.
- Justin and AI Enablement can approve, defer, or reject the pilot from the RFC without requiring private source data.

## Final Integration and End-to-End Verification

After all phases are complete, perform and document the following before calling the prototype ready for review:

1. From a clean checkout, install dependencies and run formatting, linting, typechecking, and the complete test suite using documented repository commands.
2. Run `doctor` against OpenCode V2.5 and verify an unavailable/incompatible service fails safely.
3. Run `report --date <known-anthropic-and-codex-date> --dry-run`; inspect aggregate-only output for correct totals, declared timezone, explicit identity, `opencode-pilot`, correct active status, and no sensitive content.
4. Compare dry-run totals with OpenCode's local aggregate statistics for the same date. Confirm direct Anthropic and Codex/OpenAI model/provider presence.
5. With explicit approval, perform one controlled DX submission and validate the bespoke-to-normalized lineage, DX identity matching, and intended report visibility.
6. Reconfirm that Codex vendor records and OpenCode harness records are not added together in cost reporting without a documented deduplication/report-filter policy.
7. Review the Git diff and repository history for secrets, real employee data, session identifiers, raw DX exports, or accidentally generated output before sharing the private repository.

## Rollout, Migration, and Rollback Considerations

- There is no migration and no user rollout in this prototype. It is opt-in, one user/day at a time, and manually invoked.
- The immediate rollback is to stop running the CLI and remove/unregister the `opencode-pilot` tool in DX according to DX guidance. Do not delete DX data without an approved retention/correction process.
- A broader rollout requires a separate approved plan for a GoodRx-managed relay and credentials, managed user identity/configuration, duplicate-safe replay semantics, rate limits, telemetry/alerting, opt-out/disable controls, and ownership.
- A future OpenCode plugin may improve ergonomics, but it must be evaluated only after the standalone CLI proves the contract; it must not put network/export work on OpenCode's interactive request path.

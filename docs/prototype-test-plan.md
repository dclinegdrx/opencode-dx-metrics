# OpenCode-to-DX Prototype Test Plan

**Status:** Phase 3 automated payload coverage implemented; manual matrix remains open
**Last reviewed:** 2026-09-16  
**Maintainer:** Prototype owner

## Test Rules

- Use synthetic fixtures in automated tests.
- Keep any local manual evidence aggregate and redacted.
- Never commit a real email, credential, session identifier, raw API response, prompt, path, source fragment, tool detail, or copied DX row.
- A failed or incompatible OpenCode query is an error, not a zero-usage day.
- Do not submit to DX until every Phase 4 prerequisite in the [decision log](dx-validation.md#decision-log) is approved.

## Automated Coverage

### Contract and parser

- Accept the supported synthetic OpenCode session-stats shape.
- Aggregate input, output, reasoning, cache-read, and cache-write tokens.
- Group completed steps and tokens by provider/model.
- Reject missing, negative, fractional, non-finite, or incompatible totals.
- Reject unknown/incompatible API structure with an actionable error.

### Active and inactive days

- Mark a day active when prompts are positive and completed steps are zero.
- Mark a day active when completed steps are positive and prompts are zero.
- Mark a successfully queried day inactive when both are zero.
- Keep a launched/empty session and an incomplete response inactive.

### Output privacy and payload

- Emit only aggregate report fields.
- Require an explicit syntactically valid pilot email; do not read Git identity.
- Keep `tool` fixed to `opencode-pilot`.
- Omit `spend_cents` by default.
- Verify deterministic JSON and the exact outbound allowlist.
- Attempt to inject session IDs, paths, prompt text, tool names/details, raw events, unknown stats, undefined values, and secret-like configuration; assert none can enter output.
- Assert dry-run mode has no DX DNS/HTTP capability.

The Phase 3 automated suite exercises identity validation, deterministic fixture matching, cache and active-state mapping, cost omission, secret redaction, and attempts to inject prohibited/unknown source fields. `report --dry-run` and `doctor` contain no DX transport; live export failure scenarios remain Phase 4 work.

### Failure handling

- Bound local service discovery and API calls with timeouts.
- Cover stopped/unavailable service, connection refusal, timeout, incompatible version, malformed JSON, and malformed statistics.
- Cover unavailable DX, timeout, non-success response, and redaction of endpoint authorization details once export exists.
- Verify failures return nonzero and do not mutate or block an independent OpenCode session.

## Manual Local Matrix

| Scenario                 | Procedure                                                                                                                          | Expected result                                                                                          | Evidence allowed                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Direct Anthropic         | Complete at least one direct Anthropic-backed prompt/response, then query the known date.                                          | Anthropic provider/model group and aggregate totals appear; day is active.                               | Date/timezone, labels, counts/totals only.  |
| OpenAI/Codex             | Complete at least one OpenAI/Codex-backed prompt/response, then query the known date.                                              | OpenAI/Codex group appears and output carries the vendor-overlap warning.                                | Date/timezone, labels, counts/totals only.  |
| Cache usage              | Use a session/date that reports cache reads or writes when available.                                                              | Cache fields map to the matching aggregate fields without being folded into input/output.                | Aggregate cache totals only.                |
| Zero-usage day           | Query a known date with no prompts or completed steps while the service is healthy.                                                | Valid zero totals and inactive status; explicit timezone remains visible.                                | Date/timezone and zero summary.             |
| Empty/incomplete session | Launch OpenCode or create a session without a completed response.                                                                  | No false active day.                                                                                     | Active flag and aggregate counts only.      |
| API incompatibility      | Run against an unsupported/mocked response shape.                                                                                  | Bounded nonzero failure explains version/shape incompatibility and emits no summary.                     | Sanitized error category/version only.      |
| OpenCode unavailable     | Stop or isolate the local service for the check.                                                                                   | Bounded nonzero failure; a separate normal session remains unaffected after restoration.                 | Sanitized error category and elapsed bound. |
| Mismatched identity      | Use only an approved test identity scenario after DX guidance.                                                                     | `doctor` or DX validation reports matched/unmatched without leaking identity.                            | Match status and count only.                |
| DX unavailable           | Against an approved mock or controlled failure, attempt explicit export.                                                           | No automatic retry; secret is redacted; command fails nonzero.                                           | Status/error class, field-presence summary. |
| Repeated export          | Before network activity, repeat dry-run and compare deterministic output. Do not repeat a live export without written DX approval. | Dry runs match; live repetition is blocked or deliberately acknowledged according to approved semantics. | Hash/count summary, no payload identity.    |
| Privacy inspection       | Inspect stdout/stderr, generated files, and network request body.                                                                  | Only allowlisted aggregates appear; no prohibited category is present.                                   | Completed checklist.                        |

## Controlled DX Validation

1. Run `doctor` and the exact export path in dry-run mode.
2. Have the approved pilot owner inspect date, timezone, identity, tool, active status, token/cache totals, metrics keys, and absent cost.
3. Confirm approval and the decision-log prerequisites.
4. Submit one record for one user/date once; do not automatically retry.
5. Run the redacted lineage and identity queries in [docs/dx-validation.md](dx-validation.md).
6. Confirm intended report visibility and document any configuration dependency.

If the request outcome is ambiguous, stop. Do not resubmit until DX determines whether the first request wrote data and provides a safe correction/idempotency path.

## Privacy Review Checklist

- [ ] Fixtures use only fictional models/values and `example.invalid` identities.
- [ ] No token, authorization header, cookie, endpoint secret, or environment value appears.
- [ ] No employee identity or Git-derived identity appears.
- [ ] No session/message/request/source UUID appears.
- [ ] No prompt, source code, diff, path, repository detail, or tool detail appears.
- [ ] No raw OpenCode or DX payload/response from a real run is stored.
- [ ] Cost is omitted from DX output unless an approved estimate policy is documented.
- [ ] Codex/OpenAI overlap is stated wherever results could be interpreted additively.

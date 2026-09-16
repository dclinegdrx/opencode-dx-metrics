# DX Validation Evidence and Decision Log

**Status:** Contract research only; no pilot record submitted  
**Last reviewed:** 2026-09-16  
**Maintainer:** Prototype owner with DX reviewers

## Evidence Handling

Record only aggregate, redacted observations here. Do not paste production rows, employee emails, bearer tokens, request bodies for real users, source UUID values, raw OpenCode responses, or raw DX responses.

## Existing Sanitized Evidence

GoodRx's existing `tech-metrics-connectors` implementation documents this producer path:

```text
vendor aggregate
  -> internal metric grouped by email/date/tool
  -> POST /api/aiToolMetrics.pushAll with { "data": [...] }
  -> bespoke_ai_tool_daily_metrics-shaped data
```

The mapper and synthetic fixture document these record fields: `email`, `date`, `tool`, `is_active`, `input_tokens`, `output_tokens`, `cache_read_tokens`, `cache_write_tokens`, optional `spend_cents`, and `metrics`. Existing internal reporting evidence also indicates that bespoke records normalize into `ai_tool_daily_metrics` and can be correlated through `source_table_uuid`; the exact lineage semantics still require pilot validation.

This is lineage evidence, not evidence that `opencode-pilot` is registered, visible, duplicate-safe, or accepted for a particular identity.

## Sources

- GoodRx `tech-metrics-connectors`: `internal/egress/dx/config.go`, `publisher.go`, and `mapper.go`
- GoodRx `tech-metrics-connectors`: `tests/fixtures/dx_payloads/ai_tool_metrics_push_all.json`
- GoodRx `tech-metrics-connectors`: `docs/vendor-metrics-mvp.md`
- Internal “Existing DX Schema Reference: AI Adoption And Tool Usage” (reverse-engineered and incomplete, not an official DX contract)
- OpenCode V2 API reference and OpenAPI schema for `GET /api/experimental/session/stats`

Consult the live source before export because internal and experimental contracts can change.

## Validation Queries

The following templates intentionally use placeholders and return only fields needed for validation. A DX reviewer must confirm schema names and access before execution.

### 1. Locate the approved bespoke pilot row

```sql
SELECT
  date,
  tool,
  is_active,
  input_tokens,
  output_tokens,
  cache_read_tokens,
  cache_write_tokens,
  spend_cents,
  source_table_uuid
FROM bespoke_ai_tool_daily_metrics
WHERE date = DATE '<APPROVED_TEST_DATE>'
  AND email = '<APPROVED_TEST_EMAIL>'
  AND tool = 'opencode-pilot';
```

Expected observation after one approved submission: exactly one source row with the reviewed active flag and token/cache totals. `spend_cents` should be null/absent while cost export is disabled. Record only a redacted aggregate comparison, never the email or UUID.

### 2. Verify source-to-normalized lineage

```sql
SELECT
  normalized.date,
  normalized.is_active,
  normalized.input_tokens,
  normalized.output_tokens,
  normalized.cache_read_tokens,
  normalized.cache_write_tokens,
  normalized.source_table_uuid
FROM ai_tool_daily_metrics AS normalized
JOIN bespoke_ai_tool_daily_metrics AS source
  ON normalized.source_table_uuid = source.source_table_uuid
WHERE source.date = DATE '<APPROVED_TEST_DATE>'
  AND source.email = '<APPROVED_TEST_EMAIL>'
  AND source.tool = 'opencode-pilot';
```

Expected observation: the normalized row points to the source row and preserves the reviewed date, active status, and token/cache totals. If actual schemas place `source_table_uuid` differently, update the query only after a DX reviewer confirms the relationship.

### 3. Check identity resolution without publishing identity

```sql
SELECT
  CASE WHEN normalized.dx_user_id IS NULL THEN 'unmatched' ELSE 'matched' END AS identity_status,
  COUNT(*) AS row_count
FROM ai_tool_daily_metrics AS normalized
JOIN bespoke_ai_tool_daily_metrics AS source
  ON normalized.source_table_uuid = source.source_table_uuid
WHERE source.date = DATE '<APPROVED_TEST_DATE>'
  AND source.email = '<APPROVED_TEST_EMAIL>'
  AND source.tool = 'opencode-pilot'
GROUP BY 1;
```

Expected observation: one aggregate `matched` result for the approved volunteer. Document a mismatch as a blocker without recording the address.

## Local OpenCode Coverage Evidence

Phase 2 local checks used the tested OpenCode 2.0.5 service and the CLI's aggregate-only output. No raw response or identifying data was retained.

| Coverage                        | Status   | Evidence                                                                                                                                                                        |
| ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direct Anthropic-backed session | Pending  | The available active date contained only gateway-backed model groups; a direct Anthropic session still needs a redacted run.                                                    |
| OpenAI/Codex-backed session     | Pending  | The available active date contained only gateway-backed model groups; a direct OpenAI/Codex session still needs a redacted run. Codex totals may overlap DX's vendor connector. |
| Known no-usage date             | Verified | Explicit `Etc/UTC` query returned inactive status, zero sessions/prompts/steps/tokens, and no provider/model groups.                                                            |

## Pilot Submission Record

No submission has occurred. Phase 4 may add a sanitized timestamp, date, tool, field-presence/count summary, response status, safe correlation value if approved, identity-match result, and aggregate lineage findings.

## Decision Log

`Open` means the available evidence is insufficient for export approval.

| Decision                                 | Current evidence                                                                                                                        | Status / required answer                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Duplicate and idempotency behavior       | Existing connector docs warn that rerunning a window can create duplicate downstream records; endpoint deduplication is not guaranteed. | **Open:** Does DX append, reject, or deduplicate an identical email/date/tool record?                           |
| Correction path                          | Current publisher code treats a successful response as published and has no correction workflow.                                        | **Open:** What approved operation corrects or removes an erroneous pilot row?                                   |
| Canonical reporting timezone             | Existing GoodRx producers use UTC windows, but that does not prove DX's canonical policy.                                               | **Open:** Approve an IANA timezone for pilot dates and confirm downstream conversion behavior.                  |
| Bespoke tool registration and visibility | Bespoke records can feed broader AI-tool reporting, but `opencode-pilot` registration and report propagation are undocumented.          | **Open:** Who registers the tool, where should it appear, and what delay/configuration applies?                 |
| Spend behavior                           | DX accepts `spend_cents`; cross-tool values are not necessarily comparable.                                                             | **Open:** Confirm display/aggregation and estimate policy. Prototype default: omit.                             |
| Approved authentication                  | Existing clients use a Data Cloud bearer token from secret configuration.                                                               | **Open:** Approve endpoint, credential owner/source, scope, rotation, and local handling for the one-time test. |
| Test identity and unmatched email        | Reporting joins may retain unmatched raw email, but API and later-resolution behavior are unclear.                                      | **Open:** Approve one volunteer identity and define expected rejection/storage/resolution behavior.             |
| Source lineage                           | Internal evidence names `source_table_uuid`; exact schema/cardinality are not formally documented.                                      | **Open:** DX reviewer confirms the live join and expected one-to-one/one-to-many result.                        |

Phase 4 must not begin until the test identity, authentication, timezone, registration/visibility, and duplicate/correction rows contain approved answers rather than assumptions.

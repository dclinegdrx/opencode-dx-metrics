# OpenCode DX Metrics Prototype

A private, opt-in prototype for reviewing aggregate OpenCode V2 usage and testing one controlled daily submission to DX.

**Status:** Prototype contract and RFC baseline; no working CLI or DX export yet  
**Last reviewed:** 2026-09-16  
**Maintainer:** Prototype owner, with AI Enablement and DX reviewers

## Safety Boundary

This repository is treated as public-safe even though the pilot is private. It may contain aggregate counts and fictional examples. It must not contain:

- DX credentials or authorization headers;
- employee identities, real email addresses, or Git-derived identity;
- session, message, request, or source-row identifiers;
- prompts, source code, paths, tool names, tool arguments, or tool output;
- raw OpenCode statistics, raw DX responses, or copied production query results.

The serializer planned for Phase 3 is the outbound enforcement point. Until that code and its tests exist, fixtures show the intended allowlist but do not provide a security control.

## Scope

The prototype is designed to:

1. read aggregate statistics from the supported local OpenCode V2 service API;
2. produce a sanitized daily report for an explicit date and timezone;
3. render a proposed DX `aiToolMetrics.pushAll` record with the fixed identity `opencode-pilot`;
4. after approval, submit one reviewed user/date record manually.

OpenCode is the harness identity. Provider and model names are aggregate breakdowns, so OpenCode records must remain distinct from authoritative vendor billing. OpenAI/Codex use through OpenCode may overlap DX's existing Codex connector records and must not be summed without an approved deduplication rule.

## Non-goals

This prototype does not implement a plugin, daemon, schedule, automatic retry, durable queue, broad device rollout, policy enforcement, usage limits, authoritative provider billing, or production telemetry service. Running it is not a requirement to adopt or continue using OpenCode.

## Local Development

### Prerequisites

- Node.js 20.19 or newer (`.nvmrc` records the version used for this baseline)
- npm 10 or newer
- OpenCode V2 is needed only for later local integration phases

### Install and validate

From a clean checkout:

```sh
npm ci
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Use `npm run format` to apply repository formatting. The current tests validate the synthetic contract fixtures; CLI behavior arrives in later phases.

## Configuration

No runtime configuration is consumed yet. Later phases will require explicit reporting identity and timezone settings. The controlled export phase will read its DX endpoint and bearer token only from untracked environment variables or another approved local secret source. Git identity is never a fallback.

## Design and Review Documents

- [RFC draft](docs/rfc.md)
- [Data contract and outbound allowlist](docs/data-contract.md)
- [DX evidence and decision log](docs/dx-validation.md)
- [Prototype test plan](docs/prototype-test-plan.md)
- [Implementation plan](docs/plans/2026-09-16-opencode-dx-prototype-and-rfc.md)

The JSON files under `test/fixtures/` are synthetic. The models, values, and `example.invalid` identity are fictional and are not evidence of actual usage or a successful DX submission.

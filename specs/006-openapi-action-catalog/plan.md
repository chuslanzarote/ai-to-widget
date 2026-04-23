# Implementation Plan: OpenAPI-Driven Action Catalog and Client-Side Execution

**Branch**: `006-openapi-action-catalog` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-openapi-action-catalog/spec.md`

## Summary

Feature 003 defined the tool-use contract end to end (backend emits
`ActionIntent[]`; widget executes client-side with same-origin
credentials) and Feature 005 shipped the reviewer path that turns a
rendered project into a runnable demo — but the wire that connects a
host's OpenAPI document to the runtime tool catalog was never drawn.
Two concrete gaps cause this:

1. **The render context has no `tools` slot.** `RenderContext` at
   `packages/scripts/src/render-backend.ts:68-75` exposes `projectName`,
   `embeddingModel`, `anthropicModel`, `generatedAt`, `defaultLocale`,
   and `briefSummary` — but no `tools`. The Handlebars template at
   `packages/backend/src/tools.ts.hbs:23-27` is already shaped to
   receive `{{#if tools}} {{{toolsJson}}} {{else}} [] {{/if}}`, but the
   `else` branch always wins because nothing threads tool data in. The
   committed `demo/atw-aurelia/backend/src/tools.ts` renders with
   `RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`.
2. **The build step never parses `action-manifest.md` into descriptors.**
   `parse-openapi.ts` exists and ingests documents into `ParsedOpenAPI`,
   and `action-manifest.md` is hand-authored today in
   `demo/atw-aurelia/.atw/artifacts/`, but the orchestrator's RENDER step
   (`orchestrator.ts:572-607`) never reads the manifest, classifies
   operations against the ingested OpenAPI, or emits an executor catalog
   the widget can interpret.

The fix is a five-part feature inside the existing pipeline step order
(INIT → SCHEMA → **API → CLASSIFY → RENDER (extended)** → BUNDLE → IMAGE
→ COMPOSE → SCAN) with no new ecosystems:

- **Ingestion (`/atw.api`).** New CLI subcommand that consumes an
  OpenAPI 3.0 document (local path or URL), validates with the existing
  `parseOpenAPI()` (already rejects Swagger 2.0 with
  `Swagger20DetectedError`, already handles local `$ref`s via
  `SwaggerParser.bundle`), detects duplicate `operationId`s, and commits
  the document under `.atw/artifacts/openapi.json` alongside a content
  hash in `.atw/state/input-hashes.json`. The pinned snapshot is the
  single source of truth for every downstream step (FR-020).
- **Classification (deterministic heuristic + Opus narrowing).** New
  `classify-actions.ts` reads the ingested OpenAPI, applies a
  deterministic heuristic pass (admin-path prefix, non-cookie security
  scheme, missing request-body schema, destructive-on-unowned-resource
  signals from the existing `destructive-detection.ts` and
  `admin-detection.ts` in `packages/scripts/src/lib/`), then runs a
  single Opus review that can only *narrow* the heuristic's selection
  (never inject an operation not present in the document — FR-004
  anchored-generation check). Output: `action-manifest.md` with an
  included list, an excluded list with reasons, and the model-snapshot
  record used to produce the file (FR-018).
- **Render context gains `tools`.** Extend `RenderContext` with a
  `tools: RuntimeToolDescriptor[]` field. New `parse-action-manifest.ts`
  reads `action-manifest.md` and produces the descriptor list; the
  orchestrator threads it into `renderBackend()`; `tools.ts.hbs` fills
  in via `{{{toolsJson}}}`. Every shopper-facing write defaults to
  `is_action: true, confirmation_required: true` (FR-011).
- **Executors catalog.** New `render-executors.ts` emits
  `.atw/artifacts/action-executors.json` — a declarative JSON catalog
  with per-action `{method, pathTemplate, substitution, headers,
  credentialMode: "same-origin-cookies", responseHandling}` entries.
  JSON, not code — no `eval`, `new Function`, or dynamic `import` ever
  touches it (FR-009, SC-006). Cross-origin detection happens here at
  build time (FR-016): if the OpenAPI `servers[0].url` origin differs
  from the Builder-configured widget origin, a build-time warning is
  emitted naming each offending action.
- **Widget loads the catalog and renders it through a fixed
  interpreter.** `packages/widget/src/action-executors.ts` (NEW) loads
  the catalog at init, the existing `executeAction()` in
  `api-client-action.ts` is refactored to resolve the intent against
  the catalog (not the in-memory `intent.http` shape), a 15-second
  `AbortController` timeout is wired (FR-021), `credentials: 'include'`
  continues to be supplied by the existing `buildHostApiRequest()` in
  `auth.ts`, and every host-response string that surfaces in the
  confirmation card is HTML-escaped at render time (FR-009a) — Preact
  already escapes children by default in `action-card.tsx`, so the
  invariant is preserved structurally rather than added.

Scope stays inside the existing monorepo workspaces: `@atw/scripts`
gains the ingestion / classification / render-executors code,
`@atw/backend` gets a RenderContext.tools field in the template,
`@atw/widget` gains the catalog loader and the 15-second abort. No new
runtime dependencies, no new ecosystems.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 20 (existing `@atw/scripts`,
`@atw/backend`, `@atw/widget` workspaces).
**Primary Dependencies**: `@apidevtools/swagger-parser` (already wired
in `parse-openapi.ts`, handles 3.0/3.1 detection, `$ref` bundling, and
exposes `validate` for duplicate `operationId` detection), `js-yaml`
(already loaded dynamically for YAML OpenAPI), Handlebars (render
template engine, already in `@atw/scripts`), Zod (validates
`ActionManifest` and `ActionExecutorsCatalog` shapes, already in
`@atw/scripts/src/lib/types.ts`), `@anthropic-ai/sdk` (Opus
classification review, already in `@atw/backend`). No new runtime
dependencies.
**Storage**: N/A in the runtime sense — the feature operates on files
on disk: `.atw/artifacts/openapi.json` (ingested document),
`.atw/artifacts/action-manifest.md` (classified catalog),
`.atw/artifacts/action-executors.json` (declarative catalog),
`.atw/state/input-hashes.json` (determinism ledger). The runtime
Postgres+pgvector database is unchanged.
**Testing**: Vitest (existing harness). New contract tests:
- `parse-openapi.duplicate-operation-id.contract.test.ts` — rejection.
- `classify-actions.heuristic.unit.test.ts` — admin-prefix, non-cookie
  security, missing schema exclusions.
- `classify-actions.anchored.contract.test.ts` — reject fabricated
  descriptors whose `(operationId, path, method)` does not trace back.
- `render-tools-ts.contract.test.ts` — tools.ts ends non-empty when the
  manifest has included actions.
- `render-executors.contract.test.ts` — catalog shape + same-origin
  credential mode + cross-origin detection.
- `render-executors.determinism.integration.test.ts` — re-run byte
  identical.
- `widget-executor-engine.contract.test.ts` — the fixed interpreter
  refuses catalog entries that look like code; 15-second abort fires;
  HTML-escape assertion for host-response fields (SC-006 static check).
- `credentials-sovereignty.integration.test.ts` — zero shopper headers
  reach the chat backend during an end-to-end action round-trip.

**Target Platform**: Node 20 CLI for `/atw.api`, `/atw.build`; final
artifacts run under Docker Compose (unchanged from Features 002/005);
widget runs in modern browsers (ES2020+ targeted by the existing widget
bundle).
**Project Type**: Monorepo feature spanning three existing workspaces
(`@atw/scripts`, `@atw/backend`, `@atw/widget`). No new package.
**Performance Goals**:
- `/atw.api` ingestion completes in < 5 s for a typical host OpenAPI
  (Medusa `/store/*` is ~200 operations, ~400 KB JSON).
- Classification (heuristic + one Opus review) completes in < 30 s
  wall-clock.
- Render step emits `action-executors.json` in < 1 s on top of the
  existing render envelope; a re-run on unchanged inputs is byte
  identical and 0 ms in the write path (action: "unchanged").
- Widget executor fetch has a fixed 15 s abort ceiling (FR-021).
**Constraints**:
- **Principle I (red line).** No code path may forward the shopper's
  `Cookie`, `Authorization`, `Set-Cookie`, or any `X-*-Token|Auth|
  Session` header from the widget to the chat backend; no catalog field
  can carry a credential the backend minted. Enforced by
  `buildBackendHeaders()` structural strip (already shipping in
  `packages/widget/src/auth.ts:buildBackendHeaders`) and by the
  existing `credential-strip` Fastify hook that the `/v1/chat` endpoint
  already mounts unconditionally.
- **Principle V (red line).** Every descriptor in the manifest cites
  `(operationId, path, method)` present in the pinned OpenAPI; the
  classification step rejects fabricated descriptors before writing the
  manifest (FR-004).
- **Principle VIII (red line).** Byte-identical re-runs on the same
  ingested OpenAPI + same `action-manifest.md` + same shared-lib
  snapshot. The manifest carries the model-snapshot id used for
  classification (FR-018); changes in that line document *why* the
  next run produces different output.
- **FR-009 / SC-006.** The widget's execution engine is a single fixed
  code path. Zero `eval`, `new Function`, dynamic `import` of
  catalog-referenced code. Verifiable by static grep over the committed
  widget source.
- **FR-009a.** Every host-response string rendered in the confirmation
  card is HTML-escaped at render time; no Markdown, HTML, or autolink
  interpretation on host content.
- **FR-015a.** No automatic retry on any failure mode. Every non-2xx
  or network-level failure surfaces to the shopper through the
  confirmation card exactly once.
- **FR-021.** Fixed 15 s `AbortController`-based timeout on every
  widget-issued action `fetch`. Not configurable in v1.

**Scale/Scope**:
- New files: `packages/scripts/src/atw-api.ts` (CLI entry for
  `/atw.api`), `packages/scripts/src/classify-actions.ts`,
  `packages/scripts/src/parse-action-manifest.ts`,
  `packages/scripts/src/render-executors.ts`,
  `packages/scripts/src/lib/action-manifest-types.ts` (shared Zod
  schema), `packages/widget/src/action-executors.ts` (catalog loader +
  interpreter).
- Modified files: `packages/scripts/src/render-backend.ts`
  (RenderContext.tools field, `toolsJson` handlebars binding),
  `packages/scripts/src/orchestrator.ts` (new API and CLASSIFY steps +
  thread tools into render context + emit executors catalog),
  `packages/scripts/src/write-manifest.ts` (extend input-hashes with
  openapi + action-manifest + model-snapshot),
  `packages/backend/src/tools.ts.hbs` (already ready; minor touch-up if
  any),
  `packages/widget/src/api-client-action.ts` (resolve intent against
  catalog; 15 s abort; no-retry gate),
  `packages/widget/src/init.ts` (catalog fetch on widget boot),
  `packages/widget/src/config.ts` (add `actionExecutorsUrl` config
  field),
  `packages/widget/src/action-card.tsx` (explicit text-only rendering
  assertion — already safe in Preact by default).
- Committed demo snapshot:
  `demo/atw-aurelia/.atw/artifacts/openapi.json` (Medusa `/store/*`
  document pinned),
  `demo/atw-aurelia/.atw/artifacts/action-manifest.md` (regenerated by
  the new CLASSIFY step; hand-authored today so this is effectively a
  rewrite to match the new schema),
  `demo/atw-aurelia/.atw/artifacts/action-executors.json` (NEW), and
  the committed `demo/atw-aurelia/backend/src/tools.ts` ends non-empty.

Expected diff: ~800 lines of source + ~1200 lines of tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against all ten principles. Red lines (I, V, VIII) MUST pass
unconditionally.

| # | Principle | Assessment |
|---|-----------|------------|
| I | User Data Sovereignty (red line) | **PASS — directly enforces.** Widget issues action fetches with `credentials: 'include'` via the existing `buildHostApiRequest()` cookie mode; `buildBackendHeaders()` already strips `Authorization` and `Cookie` from any headers destined for the chat backend; the `/v1/chat` endpoint already mounts the unconditional `credential-strip` hook. No catalog field may contain a credential the backend minted — enforced by the executor interpreter's fixed header allowlist (content-type and Builder-declared non-credential metadata only). The contract test `credentials-sovereignty.integration.test.ts` asserts zero shopper headers reach the chat backend during a full action round-trip. |
| V | Anchored Generation (red line) | **PASS — directly enforces.** Every descriptor in `action-manifest.md` cites `(operationId, path, method)` present in the pinned OpenAPI. The classification step rejects any descriptor whose triple does not resolve to a real operation before the manifest is written (FR-004, exit non-zero, named in the diagnostic). Opus's role is narrowing the heuristic's selection, never inventing operations. The anchored-generation contract test exercises the reject path. |
| VIII | Reproducibility (red line) | **PASS.** Byte-identical re-runs on the same ingested OpenAPI + same `action-manifest.md` + same shared-lib snapshot produce byte-identical `tools.ts` and `action-executors.json`. The model-snapshot id the manifest carries (FR-018) documents when classification output changes because Opus changed rather than because inputs did — the determinism contract applies to the render step, not to the upstream Opus step, and this split is explicit in the spec edge cases. The `render-executors.determinism.integration.test.ts` asserts a re-run is a no-op. |
| IV | Human-in-the-Loop | **PASS.** `action-manifest.md` is the Builder-owner's audit and curation surface: they can flip `confirmation_required`, remove an included action, or promote an excluded one, and the next run honours the edit (FR-017). No action executes on the host without an explicit shopper confirmation through the card (FR-011, SC-007). The Opus review step is bounded: it can only narrow the heuristic's selection, never expand it. |
| X | Narrative-Aware Engineering | **PASS — directly enables the demo's action beat.** The reviewer demo's canonical beat ("add Midnight Roast 1kg whole bean to my cart") depends on this feature: without it, `tools.ts` is empty and Opus emits no `tool_use`. With it, the three-minute video has a functional action moment. Sunday's video-recording allocation is not jeopardised; the feature is scoped to the existing pipeline step structure. |
| II | Markdown as Source of Truth | **PASS.** `action-manifest.md` is markdown, reviewable, diff-friendly. `action-executors.json` is JSON — explicitly allowed by the constitution for hierarchical structured data that markdown lists cannot represent naturally (the substitution mapping and response-handling directives are one such case). `openapi.json` is the pinned snapshot, committed as JSON for the same reason. No hidden state. |
| III | Idempotent and Interruptible | **PASS.** `/atw.api` re-ingests deterministically; `/atw.build` reads the committed manifest and emits byte-identical outputs; every write goes through the same `created`/`unchanged`/`rewritten` action taxonomy as Feature 005's render path, including backups via `--backup`. The Builder can stop after `/atw.api` and return later to run CLASSIFY and BUILD; the manifest records the model-snapshot id so a later run on a newer Opus surfaces the drift transparently. |
| VI | Composable Deterministic Primitives | **PASS — structurally.** Ingestion (`parse-openapi.ts`), heuristic classification (`classify-actions.ts` deterministic pass), manifest parsing (`parse-action-manifest.ts`), tool-descriptor rendering (`render-backend.ts`), and executor catalog rendering (`render-executors.ts`) are five pure deterministic functions. The one Opus call lives inside `classify-actions.ts` and is sandboxed: its output can only *remove* heuristic-selected operations, never add them. The deterministic vs agentic split is sharp and auditable. |
| VII | Single-Ecosystem Simplicity | **PASS.** TypeScript on Node 20 + Handlebars + Preact + Anthropic SDK + Zod. All already in the workspace. No new framework, no new datastore, no new orchestration layer. |
| IX | Opus as a Tool, Not a Crutch | **PASS.** Exactly one Opus call is added by this feature (the classification review in `classify-actions.ts`), justified because endpoint classification is a semantic judgment call over 100+ operations that a regex cannot reliably make. The heuristic pass handles the deterministic filters first so Opus sees only a pre-narrowed set. Tool-descriptor shape, URL templating, HTML escaping, and executor catalog emission are all deterministic — no Opus in the hot path. |

**All gates pass. No red-line violations. No lower-priority violations
needing justification. Complexity Tracking section is empty.**

### Post-Design Re-evaluation (after Phase 1 artefacts)

Re-checked after `research.md`, `data-model.md`, and the six contracts
were written. No Phase 1 artefact introduced a violation or changed the
status of any gate:

- **Principle I remains a structural invariant.** The executor-catalog
  schema (`contracts/action-executors.schema.md §3.5`) Zod-refines
  headers to reject every credential-class name
  (`Authorization`/`Cookie`/`Set-Cookie`/`X-*-Token|Auth|Session`)
  before the catalog is written; substitution values are restricted to
  `/^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/` (single slice + property
  lookup, no expressions); and the widget interpreter
  (`contracts/widget-executor-engine.md`) inherits the existing
  `buildHostApiRequest()` cookie mode rather than templating anything
  the backend could have minted.
- **Principle V remains a build-time gate.** The classifier contract
  (`contracts/classifier-contract.md §3`) makes the post-Opus
  anchored-generation check explicit: any `operationId` Opus returned
  that was not in the Stage-1 candidate-included list aborts the run
  with `ANCHORED_GENERATION_VIOLATION` *before* the manifest is
  written. The manifest parser (`contracts/action-manifest.schema.md
  §9`) re-verifies every `source` triple against the pinned
  OpenAPI on load.
- **Principle VIII remains an output-level invariant.** Every write
  path (openapi.json, action-manifest.md, action-executors.json,
  tools.ts) has an explicit canonicalisation clause — stable key
  ordering, 2-space indent, trailing newline, no unnecessary Unicode
  escapes. Re-run determinism is asserted by
  `render-executors.determinism.integration.test.ts` and the render
  context extension's test outline
  (`contracts/render-tools-context.md §9`).
- **Principle IX (Opus as a Tool)** stays intact: only one Opus call
  was designed in (Stage-2 classification narrowing). The manifest
  parser, executor catalog renderer, widget interpreter, and every
  determinism check are pure deterministic code.
- **Principle VI (Composable Deterministic Primitives)** is
  structurally reinforced by splitting the feature across five pure
  functions in `@atw/scripts` plus one widget interpreter — each
  testable in isolation, each emitting a stable artefact.

No red-line gates flipped. No new violations. Complexity Tracking
section remains empty.

## Project Structure

### Documentation (this feature)

```text
specs/006-openapi-action-catalog/
├── plan.md                 # This file (/speckit.plan output)
├── research.md             # Phase 0 — design decisions, rejected alternatives
├── data-model.md           # Phase 1 — manifest schema, executors catalog schema, render-context extension
├── quickstart.md           # Phase 1 — reviewer walkthrough + builder walkthrough
├── contracts/              # Phase 1 output
│   ├── atw-api-command.md              # /atw.api CLI shape, exit codes, validation rules
│   ├── classifier-contract.md          # heuristic + Opus-review, anchored-generation rejection
│   ├── action-manifest.schema.md       # markdown structure + model-snapshot record
│   ├── action-executors.schema.md      # declarative JSON shape + credential mode invariant
│   ├── render-tools-context.md         # RenderContext.tools extension + tools.ts.hbs binding
│   └── widget-executor-engine.md       # fixed interpreter, 15 s abort, HTML escape, no-retry
├── spec.md                 # Already present (/speckit.specify output)
├── checklists/
│   └── requirements.md     # Already present (all green)
└── tasks.md                # NOT created here — /speckit.tasks output
```

### Source Code (repository root)

```text
packages/
├── scripts/                                              # MODIFIED + NEW
│   ├── src/
│   │   ├── parse-openapi.ts                             # UNCHANGED — already ingests + validates
│   │   ├── atw-api.ts                                   # NEW — /atw.api CLI (accept --source, commit openapi.json)
│   │   ├── classify-actions.ts                          # NEW — deterministic heuristic + Opus narrowing
│   │   ├── parse-action-manifest.ts                     # NEW — md → ActionManifest (Zod-validated)
│   │   ├── render-executors.ts                          # NEW — ActionManifest → action-executors.json
│   │   ├── render-backend.ts                            # MODIFIED — add `tools` field to RenderContext + wire toolsJson
│   │   ├── orchestrator.ts                              # MODIFIED — add API + CLASSIFY steps, thread tools into render
│   │   ├── write-manifest.ts                            # MODIFIED — extend input-hashes (openapi, action-manifest, model-snapshot)
│   │   └── lib/
│   │       ├── action-manifest-types.ts                 # NEW — Zod schema for ActionManifest
│   │       ├── action-executors-types.ts                # NEW — Zod schema for ActionExecutorsCatalog
│   │       ├── admin-detection.ts                       # UNCHANGED — consumed by heuristic
│   │       └── destructive-detection.ts                 # UNCHANGED — consumed by heuristic
│   └── test/
│       ├── atw-api.contract.test.ts                     # NEW — ingestion, duplicate operationId, swagger 2.0 rejection
│       ├── classify-actions.heuristic.unit.test.ts      # NEW
│       ├── classify-actions.anchored.contract.test.ts   # NEW — FR-004
│       ├── parse-action-manifest.unit.test.ts           # NEW
│       ├── render-tools-ts.contract.test.ts             # NEW — tools.ts non-empty when manifest has actions
│       ├── render-executors.contract.test.ts            # NEW — shape + same-origin + cross-origin warning
│       ├── render-executors.determinism.integration.test.ts  # NEW — re-run byte-identical
│       └── orchestrator.openapi-round-trip.integration.test.ts  # NEW — /atw.api → /atw.build end-to-end
│
├── backend/                                              # MODIFIED (minimal)
│   ├── src/
│   │   └── tools.ts.hbs                                 # ALREADY ready; may need `toolsJson` helper registration
│   └── test/                                            # (unchanged; existing chat-endpoint tests continue to pass)
│
└── widget/                                               # MODIFIED + NEW
    ├── src/
    │   ├── init.ts                                      # MODIFIED — fetch action-executors.json at boot
    │   ├── config.ts                                    # MODIFIED — add actionExecutorsUrl
    │   ├── action-executors.ts                          # NEW — catalog loader + fixed interpreter
    │   ├── api-client-action.ts                         # MODIFIED — resolve via catalog, 15 s abort, no-retry
    │   ├── action-card.tsx                              # MODIFIED (minimal) — explicit text-only render audit; Preact already escapes
    │   └── auth.ts                                      # UNCHANGED — buildHostApiRequest + buildBackendHeaders
    └── test/
        ├── action-executors.unit.test.ts                # NEW — URL template substitution, missing variable, cross-origin refusal
        ├── action-executors.abort.unit.test.ts          # NEW — FR-021 15 s timeout
        ├── action-executors.no-retry.unit.test.ts       # NEW — FR-015a
        ├── action-card.html-escape.unit.test.ts         # NEW — FR-009a, SC-006
        └── action-card.interpreter-safety.contract.test.ts  # NEW — SC-006 static-check (no eval / new Function / dynamic import)

demo/
└── atw-aurelia/
    └── .atw/
        ├── artifacts/
        │   ├── openapi.json                             # NEW — committed Medusa /store/* pinned snapshot
        │   ├── action-manifest.md                       # REGENERATED — matches new schema (model-snapshot + anchored)
        │   └── action-executors.json                    # NEW — declarative catalog
        └── state/
            └── input-hashes.json                        # EXTENDED — openapi + action-manifest hashes

tests/                                                    # UNCHANGED harness
└── integration/
    ├── credentials-sovereignty.integration.test.ts      # NEW — Principle I structural proof end-to-end
    └── reviewer-demo-action.integration.test.ts         # NEW — SC-001 add-to-cart round-trip assertion
```

**Structure Decision**: Monorepo feature spanning the three existing
workspaces. `@atw/scripts` grows the ingestion / classification / render
pipeline for action data; `@atw/backend` stays source-of-truth for the
runtime templates and only gains a new render-context field it already
anticipates; `@atw/widget` grows a declarative-catalog interpreter that
the existing `executeAction()` now resolves intents against. The
Medusa `/store/*` OpenAPI becomes the canonical committed fixture; the
reviewer demo's action beat is unblocked on first run without any
bespoke glue code per action (FR-001 through FR-021).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.

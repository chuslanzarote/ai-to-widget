# Implementation Plan: Build Pipeline (Feature 002)

**Branch**: `002-build-pipeline` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/002-build-pipeline/spec.md`;
upstream context in `constitution.md`, `PRD.md`,
`specs/001-setup-flow/plan.md`, `specs/001-setup-flow/post-impl-notes.md`,
`examples/aurelia-completed/`, and the installer-shipped commands under
`commands/`.

## Summary

Deliver the AI to Widget **build** half of the product: the single
`/atw.build` slash command and the auxiliary TypeScript scripts it
orchestrates to convert the five Feature 001 markdown artifacts into a
running local backend. The pipeline stands up a pinned `pgvector/pgvector:pg16`
container, imports the Builder's SQL dump into a quarantined `client_ref`
schema, runs anchored Opus 4.7 enrichment over each indexable entity (with
`source_hash`-gated resumability), computes deterministic local embeddings
via `@xenova/transformers`, upserts into `atw_documents`, renders backend
TypeScript from Handlebars templates, compiles the widget bundle with
esbuild, and builds a multi-stage `atw_backend:latest` Docker image. The
implementation language is **TypeScript on Node.js ≥ 20**, slotting into
the existing npm-workspaces monorepo alongside the two Feature 001
packages. No Python, no new ecosystems. Every Opus call lives inside the
markdown-driven `/atw.build` conversation; every deterministic step
(parser, assembler, validator, renderer, image builder) is an independently
invocable auxiliary script under `packages/scripts/`. The pipeline is
deterministic, resumable, and anchored — same inputs yield byte-identical
backend TypeScript and widget bundles, a killed run resumes where it died
with zero duplicate Opus spend, and every enriched fact cites a source
column.

## Technical Context

**Language/Version**: TypeScript 5.4+, Node.js ≥ 20 LTS (unchanged from
Feature 001; the monorepo root already enforces `engines.node >=20`).

**Primary Dependencies** (new in this feature, added to existing
`@atw/scripts` workspace):

- `@anthropic-ai/sdk` — Opus 4.7 calls with streaming, usage reporting,
  and typed 429/5xx handling. First SDK dependency in the repo; Feature 001
  deferred all LLM calls to the markdown conversation layer.
- `@xenova/transformers` — ONNX-based embedding inference in pure Node
  (Principle VII — no Python sidecar). Uses a 384-dim multilingual
  `bge-small-multilingual-v1.5` model pinned by SHA.
- `pg` — Postgres driver for migrations, `client_ref` import, and
  `atw_documents` upsert.
- `handlebars` — Template rendering for backend TypeScript files under
  `packages/backend/src/*.hbs`.
- `esbuild` — Widget bundle compilation into single-file IIFE
  (`dist/widget.js`) and CSS (`dist/widget.css`).
- `dockerode` — Docker daemon control from Node for container start/stop,
  image build, and reachability probes. No shelling out.
- `p-limit` — Concurrency semaphore for bounded parallel Opus calls
  (default 10, configurable via `--concurrency`).
- Re-use from Feature 001: `commander`, `chalk`, `fs-extra`,
  `write-file-atomic`, `zod`, `gray-matter`, `unified`/`remark-parse`,
  `vitest`.

**Storage**:

- Postgres 16 + pgvector 0.7 in a local Docker container named
  `atw_postgres`, pinned to `pgvector/pgvector:pg16`, data persisted in a
  named Docker volume (`atw_postgres_data`).
- New tables: `atw_migrations` (idempotent migration log), `atw_documents`
  (one row per enriched indexable entity, unique on
  `(entity_type, entity_id)`, HNSW index on the 384-dim `embedding`
  column). All AI to Widget tables live outside `client_ref`.
- `client_ref` schema holds the Builder's imported SQL dump, restricted
  to tables classified as primary or related in `schema-map.md`. PII
  columns are filtered at import time; PII-classified tables are skipped
  entirely.
- `.atw/state/build-manifest.json` — post-build log of every run
  (`build_id`, timings, counts, failures, `opus_cost_usd`,
  `input_hashes`). Read by the next run to short-circuit "nothing to do".
- `.atw/state/input-hashes.json` (already owned by Feature 001) — gains
  hashes for the SQL dump and `build-plan.md` on top of the existing
  artifact hashes.
- Cached embedding model under `~/.cache/atw/models/` (XDG-style
  cross-platform cache dir via `env-paths`). Re-used across builds;
  pre-baked into the `atw_backend:latest` image during the final build
  step so runtime containers start without a download.

**Testing**: `vitest` (continuing Feature 001 conventions) across three
tiers:

1. `packages/scripts/test/**/*.unit.test.ts` — pure-function unit tests
   for assemblers, validators, renderers, hashers, manifest writers.
2. `packages/scripts/test/**/*.contract.test.ts` — CLI-shape contract
   tests for each new auxiliary script (stdin/stdout/exit-code).
3. `tests/integration/**/*.test.ts` — end-to-end tests using a disposable
   Postgres container spun up in `beforeAll` via `testcontainers`, with
   Anthropic calls stubbed against a local mock server that replays
   fixture responses. One "real Opus" smoke test is opt-in behind an
   env-var guard (`ATW_E2E_REAL_OPUS=1`) and only runs on the reference
   fixture.
4. A dedicated **resumability** integration test kills the build mid-enrichment,
   restarts, and asserts the post-build manifest records zero duplicate
   Opus spend (SC-015).

**Target Platform**: unchanged from Feature 001 — macOS, Linux, and
WSL2-on-Windows. All three require Docker Desktop or Docker Engine and
Claude Code. The CI matrix from Feature 001 extends to this feature with
the addition of a Postgres-ready job for integration tests.

**Project Type**: continuation of the Feature 001 **npm-workspaces
monorepo**. Two new workspace packages are introduced:

- `packages/backend` — the generated backend's source templates (`.hbs`)
  and runtime TypeScript (this feature only renders from the templates
  into the Builder's project tree under `backend/src/`; the runtime HTTP
  handler lives here because Feature 003 will consume it).
- `packages/widget` — the widget source TypeScript (empty shell for this
  feature; Feature 003 authors the UI). This feature ships the esbuild
  plumbing and an assumption-safe path that emits `dist/widget.js` as a
  no-op bundle when the source is empty.

No new ecosystems. No Turborepo / Nx. `packages/scripts` absorbs every
new auxiliary script.

**Performance Goals** (directly from spec success criteria, pinned to the
reference CI runner — GitHub Actions `ubuntu-latest`, 4-core / 16 GB
RAM / SSD):

- SC-012: fresh build of the Aurelia fixture (~342 entities) finishes in
  < 20 minutes wall-clock.
- SC-013: re-run with no changes completes in < 30 s and issues zero
  Opus calls.
- SC-015: interrupted-then-resumed build total Opus spend within 5 % of
  a single uninterrupted run.
- SC-019: fresh build on the small fixture (< 50 entities) finishes in
  < 5 minutes.

**Constraints**:

- Network access: Anthropic API only (enrichment), embedding model
  registry on first-run only (model download), local Docker daemon, local
  Postgres container. Zero telemetry, no other outbound hosts (FR-084).
- The backend Docker image MUST NOT contain `ANTHROPIC_API_KEY` or any
  other secret (FR-077). Secrets reach the runtime via env-var injection
  from `docker-compose.yml`, which in turn sources from the Builder's
  shell environment.
- Principle I: no DSN acceptance, ever. SQL dumps remain the sole
  ingress for client data.
- Principle V: every enriched `fact.claim` MUST cite a `source` field
  that exists in the assembled JSON input; violations fail validation.
- All writes to `backend/src/*.ts`, `dist/widget.*`,
  `build-manifest.json`, and the cached model are atomic (write-tmp +
  fsync + rename) for Windows correctness.

**Scale/Scope**: reference fixture is Aurelia on Medusa — ~342
indexable entities across four entity types (product, variant,
collection, region), plus ~120 API operations already classified by
Feature 001. Large-schema fallback (> 1000 entities) is in scope for
future work but not V1; the enrichment pipeline is structured so it
will extend to chunked prompts without reshaping.

## Constitution Check

*GATE: MUST pass before Phase 0. Re-checked after Phase 1 design.*

### Red-line principles (I, V, VIII) — MUST pass unconditionally

| # | Principle | Plan compliance |
|---|---|---|
| I | **User Data Sovereignty** | **PASS.** FR-060 categorically bans DSN acceptance in this feature too — the only ingress is the SQL dump the Builder generated manually in Feature 001. `client_ref` schema quarantines imported data; PII-flagged tables and columns are filtered at import (FR-059) and excluded from the assembled Opus input (FR-068). The post-build compliance scan (FR-088, SC-018) uses a case-insensitive whitespace-normalized substring match to catch any PII leak that slipped past per-field exclusion. No end-user credential material ever reaches the backend (Feature 003 contract, carried forward). |
| V | **Anchored Generation** | **PASS.** The enrichment prompt template embeds Principle V's anchoring rules verbatim (FR-066). The enrichment validator (FR-067) rejects any Opus response where a `fact.claim` lacks a non-empty `source` or references a field not present in the assembled JSON input, retries once with a sharpened prompt, and flags + skips on second failure. `source_hash` SHA-256 is computed over `assembled_input + prompt_version` so a prompt change invalidates stale enrichments and forces re-anchoring. `examples/aurelia-completed/` ships pre-validated fixtures so the validator's behavior is testable end-to-end. |
| VIII | **Reproducibility** | **PASS.** Every image tag is pinned: `pgvector/pgvector:pg16`, Node 20 LTS base, embedding model pinned by SHA. Two consecutive builds on unchanged inputs produce byte-identical `backend/src/*.ts` and `dist/widget.*` (FR-076, SC-016) — enforced by a dedicated integration test. Embedding computation is deterministic on the same platform (FR-063). The CI matrix from Feature 001 (macOS / Linux / Windows-WSL2, Node 20) extends to this feature, with Postgres spun up via `testcontainers` for integration runs. |

### Defaults (II, III, IV, VI, VII, IX, X)

| # | Principle | Plan compliance |
|---|---|---|
| II | Markdown as Source of Truth | Every decision the pipeline consumes lives in the five Feature 001 markdown artifacts. The build manifest JSON is *derivative* (a log, not a decision), and the only structured state files are hashes and the manifest — both recomputable from inputs and runs. No decision lives in a Postgres table or binary blob. |
| III | Idempotent & Interruptible | `source_hash` gates re-enrichment (FR-065). `atw_migrations` table gates re-migration. Template rendering is skip-if-byte-identical (FR-074). Docker image rebuild is a no-op when layers are cached and inputs unchanged. Ctrl+C policy (FR-083) lets in-flight Opus responses finish validation before exit, so no half-written rows linger. SC-013 asserts the 30-second no-op target. |
| IV | Human-in-the-Loop | `/atw.build` presents a plan summary (entity count, cost estimate, duration estimate, container port, output paths) and halts until the Builder confirms (FR-054). `--dry-run` (FR-056) prints the summary and exits without touching anything — a safety pressure valve. `--force` is scoped narrowly (re-enrichment only; no DB / volume / cache destruction per Clarifications Q2). |
| VI | Composable Deterministic Primitives | Twelve new auxiliary scripts (enumerated in `contracts/scripts.md`), one responsibility each. Opus is invoked from the markdown `/atw.build` command via the SDK-wrapper script, not from deep inside the pipeline. Validators, assemblers, renderers, and image builders are all independently invocable, typed, and unit-tested. |
| VII | Single-Ecosystem Simplicity | TypeScript + Node 20 end to end. Embeddings via `@xenova/transformers` (ONNX, pure JS) — no Python. One Postgres container handles relational + vector workloads via pgvector. Docker Compose orchestrates. No Turborepo / Nx. |
| IX | Opus as a Tool | Opus is invoked only for enrichment (semantic interpretation over anchored input). SQL parsing (Feature 001), embedding, migration, `client_ref` import, template rendering, image build, manifest writing — all deterministic. Rough count: 1 Opus call per indexable entity on first build, 0 on clean re-runs, 0 on `--force --dry-run`. Cost estimate surfaces from `build-plan.md` and lands within ±20 % of actual (SC-017). |
| X | Narrative-Aware Engineering | The build flow — plan summary, live progress, anchored enrichment with visible provenance, fast re-runs — is demo material. The 30-second no-op re-run is a single hero shot for the video ("now watch it do nothing, the right way"). Incremental rebuild and resumability stories both survive compression to three minutes. |

**Complexity Tracking**: empty. No principle is violated.

### Post-design re-check (after Phase 1 artifacts)

Re-evaluated after `research.md`, `data-model.md`, `contracts/*.md`,
and `quickstart.md` were written (see each file's final paragraph for
its principle-by-principle notes):

- **Red lines (I, V, VIII)**: unchanged — still PASS. The validator
  contract in `contracts/enrichment.md` codifies Principle V's
  rejection criteria; the data-model's `source_hash` column binds it
  to persistence; the quickstart re-proves Principle VIII on the
  Aurelia fixture.
- **II**: `build-manifest.json` is derivative state, not a decision
  log. `atw_documents` holds enrichment *output* (anchored to markdown
  artifacts), not any new decision. Principle II is upheld.
- **VI**: twelve scripts, each with a one-sentence contract in
  `contracts/scripts.md`. No script does two jobs.
- **VII**: every new dependency chosen in `research.md` is pure
  JavaScript/TypeScript. `@xenova/transformers` is the only ONNX
  runtime; it ships precompiled binaries for all three target
  platforms, so no native builds at `npm install` time.

Plan is gate-clean for `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/002-build-pipeline/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions for the pipeline
├── data-model.md        # Phase 1 output — DB schema, document shape, manifest shape
├── quickstart.md        # Phase 1 output — Builder-facing build-to-demo path
├── contracts/           # Phase 1 output
│   ├── slash-command.md     # /atw.build input, flags, output, failure modes
│   ├── scripts.md           # CLI contract for each new auxiliary script
│   ├── enrichment.md        # Opus prompt, response schema, validator rules
│   └── manifest.md          # build-manifest.json schema (versioned)
├── checklists/
│   └── requirements.md  # spec quality checklist (already generated)
└── tasks.md             # Phase 2 output (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
ai-to-widget/
├── package.json                      # npm workspaces root (unchanged structure)
├── packages/
│   ├── installer/                    # (unchanged — Feature 001 owns this)
│   ├── scripts/                      # (extended)
│   │   ├── src/
│   │   │   ├── (Feature 001 scripts, unchanged)
│   │   │   ├── start-postgres.ts           # spin up atw_postgres container (idempotent)
│   │   │   ├── apply-migrations.ts         # run migrations via atw_migrations
│   │   │   ├── import-dump.ts              # SQL dump → client_ref (filtered)
│   │   │   ├── assemble-entity-input.ts    # client_ref row → structured JSON for Opus
│   │   │   ├── enrich-entity.ts            # Opus call + response validation
│   │   │   ├── embed-text.ts               # @xenova/transformers wrapper
│   │   │   ├── upsert-document.ts          # atw_documents upsert + source_hash check
│   │   │   ├── render-backend.ts           # handlebars → backend/src/*.ts (atomic)
│   │   │   ├── compile-widget.ts           # esbuild → dist/widget.js + dist/widget.css
│   │   │   ├── build-backend-image.ts      # multi-stage docker build via dockerode
│   │   │   ├── compose-activate.ts         # uncomment ATW block in docker-compose.yml
│   │   │   ├── write-manifest.ts           # .atw/state/build-manifest.json atomic write
│   │   │   ├── scan-pii-leaks.ts           # post-build compliance scan (FR-088)
│   │   │   ├── migrations/                 # SQL migration files (checked-in)
│   │   │   │   ├── 001_init.sql                # CREATE EXTENSION vector; client_ref; etc.
│   │   │   │   ├── 002_atw_documents.sql       # atw_documents + indexes
│   │   │   │   └── 003_hnsw_index.sql          # HNSW index creation
│   │   │   └── lib/
│   │   │       ├── anthropic-client.ts     # SDK wrapper with 429/5xx backoff
│   │   │       ├── enrichment-validator.ts # Principle V rejection logic
│   │   │       ├── source-hash.ts          # SHA-256(assembled_input + prompt_version)
│   │   │       ├── concurrency.ts          # p-limit semaphore with auto-reduce
│   │   │       ├── pg-client.ts            # Postgres pool helper
│   │   │       ├── docker-client.ts        # dockerode wrapper with reachability probe
│   │   │       ├── embeddings.ts           # model loader + deterministic inference
│   │   │       └── atomic.ts               # (existing — reused)
│   │   ├── test/
│   │   │   ├── assemble-entity-input.unit.test.ts
│   │   │   ├── enrichment-validator.unit.test.ts
│   │   │   ├── source-hash.unit.test.ts
│   │   │   ├── scan-pii-leaks.unit.test.ts
│   │   │   ├── render-backend.unit.test.ts
│   │   │   ├── concurrency.unit.test.ts
│   │   │   └── *.contract.test.ts          # one per script (CLI shape)
│   │   ├── bin/                            # one shim per new script (atw-*.js)
│   │   └── package.json                    # (adds the new deps listed above)
│   ├── backend/                            # NEW — generated backend source + templates
│   │   ├── src/
│   │   │   ├── index.ts.hbs                # HTTP entry template
│   │   │   ├── retrieval.ts.hbs            # pgvector query + re-ranking
│   │   │   ├── tools.ts.hbs                # action-manifest → typed tool calls
│   │   │   ├── prompts.ts.hbs              # system prompt rendered from brief.md
│   │   │   └── config.ts.hbs               # runtime config from build-plan.md
│   │   ├── Dockerfile                      # multi-stage (builder + runtime)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── widget/                             # NEW — widget source (F003 will populate)
│       ├── src/
│       │   └── .gitkeep                    # empty shell, no-op bundle for F002
│       ├── esbuild.config.ts               # config consumed by compile-widget.ts
│       ├── package.json
│       └── tsconfig.json
├── commands/                         # (extended)
│   ├── atw.init.md                   # (existing)
│   ├── atw.brief.md
│   ├── atw.schema.md
│   ├── atw.api.md
│   ├── atw.plan.md
│   └── atw.build.md                  # NEW — /atw.build command definition
├── templates/                        # (unchanged — Feature 001 installer inputs)
├── tests/
│   ├── integration/                  # (extended)
│   │   ├── build-full-flow.test.ts          # end-to-end on Aurelia fixture
│   │   ├── build-resumability.test.ts       # SC-015 — kill & resume
│   │   ├── build-incremental.test.ts        # SC-013 — no-op on unchanged inputs
│   │   ├── build-determinism.test.ts        # SC-016 — byte-identical artifacts
│   │   ├── build-pii-scan.test.ts           # SC-018 — compliance scan
│   │   ├── build-docker-down.test.ts        # FR-086 — clean halt
│   │   ├── build-auth-failure.test.ts       # FR-085 — auth halt
│   │   └── build-force-flag.test.ts         # Clarifications Q2 — --force scope
│   └── fixtures/
│       ├── aurelia/                        # (extended)
│       │   ├── schema.sql                  # (existing, F001)
│       │   ├── schema-with-data.sql        # (existing, F001)
│       │   ├── openapi.json                # (existing, F001)
│       │   └── opus-responses/             # recorded fixtures for mock server
│       │       ├── product/*.json
│       │       ├── variant/*.json
│       │       ├── collection/*.json
│       │       └── region/*.json
│       └── small-project/                  # NEW — < 50 entities for SC-019
│           ├── schema.sql
│           ├── schema-with-data.sql
│           └── openapi.json
└── examples/
    └── aurelia-completed/                  # (existing — F001 fixture parity)
```

**Structure Decision**: adopted. The existing `packages/installer` and
`packages/scripts` workspaces persist unchanged; `packages/scripts` gains
twelve new scripts and their supporting `lib/` modules. Two new
workspaces — `packages/backend` and `packages/widget` — are introduced
now so the build pipeline has somewhere to render into and compile from.
`packages/widget` ships empty for Feature 002 (compiled as a no-op
bundle when `src/` has no TypeScript entry); Feature 003 will author the
UI. The `migrations/` directory sits inside `packages/scripts/src/` so
migrations are versioned alongside the code that applies them. Integration
tests live under repo-root `tests/integration/` to continue Feature 001's
convention and so they can exercise the full package graph together.

## Complexity Tracking

> No violations. No justification required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | —          | —                                   |

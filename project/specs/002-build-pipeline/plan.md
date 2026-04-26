# Implementation Plan: Build Pipeline (Feature 002)

**Branch**: `002-build-pipeline` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-build-pipeline/spec.md`

## Summary

The Build Pipeline executes the single `/atw.build` slash command, turning
the markdown artifacts produced by Feature 001 into a running local
backend: it boots a pinned Postgres+pgvector container, applies idempotent
migrations, replays the Builder's SQL dump into a PII-filtered `client_ref`
schema, calls Opus 4.7 once per indexable entity under a structurally
enforced anchored-generation prompt, computes 384-dim embeddings locally
via `@xenova/transformers`, upserts each row into `atw_documents`, renders
`backend/src/*.ts` from Handlebars templates, bundles `dist/widget.{js,css}`
via esbuild, and builds `atw_backend:latest` via `dockerode`. Every input
is hashed so re-runs short-circuit in < 30 s when nothing has changed, a
SIGINT boundary lets in-flight Opus calls complete before ordered
shutdown, and a compliance scan guarantees no PII value from `client_ref`
leaked into `atw_documents` before the manifest is atomically written.

The technical approach composes small, independently unit-testable
auxiliary scripts (`packages/scripts/src/*`) behind a thin markdown slash
command (`commands/atw.build.md`), honoring Principle VI (Composable
Deterministic Primitives): agentic work is confined to Opus enrichment;
every other phase is typed, deterministic, and retryable.

## Technical Context

**Language/Version**: TypeScript 5.4 on Node.js 20 LTS (pinned via
`.nvmrc`).
**Primary Dependencies**:
- `@anthropic-ai/sdk` — Opus 4.7 enrichment calls.
- `@xenova/transformers` — local 384-dim embeddings (`bge-small-multilingual-v1.5`).
- `pg` — Postgres driver for `client_ref` + `atw_documents`.
- `handlebars` — backend template rendering.
- `esbuild` — widget IIFE bundling.
- `dockerode` — Docker daemon control (Postgres lifecycle + image build).
- `p-limit` — bounded Opus concurrency.
- `zod` — manifest + contract validation.
- `vitest` + `testcontainers` — unit / contract / integration tests.
**Storage**:
- Postgres 16 via pinned image `pgvector/pgvector:pg16` on host port 5433 (override `--postgres-port`).
- Two schemas: `client_ref` (Builder-imported, PII-filtered) and `public` (ATW-owned: `atw_migrations`, `atw_documents`).
- `build-manifest.json` atomically written to `.atw/state/`.
**Testing**: `vitest` with three tiers (unit / contract / integration).
Integration uses disposable Postgres via `testcontainers` and a mock
Anthropic server; opt-in `ATW_E2E_REAL_OPUS=1` runs against live Opus for
release smoke tests.
**Target Platform**: Local developer workstations (macOS, Linux, WSL2)
with Docker Desktop ≥ 24 and Claude Code installed. CI: GitHub Actions
`ubuntu-latest` (4-core / 16 GB / SSD) is the reference hardware per
Clarifications Q3.
**Project Type**: CLI + backend monorepo extending Feature 001's existing
npm workspaces layout.
**Performance Goals**: 342-entity Aurelia fixture completes end-to-end in
14–18 minutes on the reference runner (SC-012); re-run with unchanged
inputs < 30 seconds (SC-013); SIGINT + resume preserves ≥ 95 % of cost
(SC-015).
**Constraints**:
- Concurrency capped at 10 Opus calls (auto-reduces to 3 on sustained 429s
  per FR-070).
- Estimated vs actual cost variance ≤ 20 % on the Aurelia fixture (SC-017).
- Anchored Generation (Principle V, red line): validator rejects any
  fact whose `source` string does not appear in the flattened assembled
  input JSON; one sharpening retry then flag-and-skip.
- User Data Sovereignty (Principle I, red line): no DSN accepted, no
  end-user credentials handled, PII-flagged columns excluded at import.
- Reproducibility (Principle VIII, red line): Postgres image digest,
  embedding model version, Node version, and prompt template version
  captured in manifest.
**Scale/Scope**: Aurelia fixture = 342 entities (182 product, 112 variant,
28 collection, 20 region). Upper bound for hackathon demo: ~1000
entities. Auxiliary scripts: 13 new CLI entry points under
`packages/scripts/src/` + `packages/scripts/bin/`.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still passing.*

| # | Principle | Status | Anchor |
|---|---|---|---|
| I | User Data Sovereignty (red line) | PASS | No DSN input; `client_ref` imports exclude PII-flagged tables/columns at source (`contracts/scripts.md#atw-import-dump`); `ANTHROPIC_API_KEY` never baked into the backend image (FR-077); backend image runs without any end-user auth material. Post-build compliance scan (`atw-scan-pii-leaks`) structurally verifies no PII value reached `atw_documents`. |
| II | Markdown as Source of Truth | PASS | Every decision the pipeline consumes lives in `.atw/` markdown (project.md, brief.md, schema-map.md, action-manifest.md, build-plan.md); no SQLite/binary config. The manifest is JSON because it is a machine-written audit record, not a Builder-editable decision artifact — explicitly called out in `contracts/manifest.md`. |
| III | Idempotent and Interruptible | PASS | `source_hash` drives the "nothing-to-do" short-circuit; migrations are idempotent via `atw_migrations`; SIGINT boundary (contracts/slash-command.md §6) preserves in-flight work; re-run after abort resumes via `source_hash` match. |
| IV | Human-in-the-Loop by Default | PASS | Plan summary confirmation gate blocks any write before Builder types `y` (contracts/slash-command.md §2); `--dry-run` escape hatch; `--force` narrowly scoped per Clarifications Q2 to re-enrichment only. |
| V | Anchored Generation (red line) | PASS | `contracts/enrichment.md` §2.4 structurally enforces: every `fact.source` MUST appear as a key in the flattened assembled input; unknown-source facts are rejected. `insufficient_data` branch is the model's only escape hatch — validator accepts it and orchestrator flags the entity rather than inventing a fallback. |
| VI | Composable Deterministic Primitives | PASS | 13 auxiliary scripts (contracts/scripts.md) each do one deterministic thing (`atw-start-postgres`, `atw-apply-migrations`, `atw-embed-text`, …). Opus is the sole agentic layer, invoked only for semantic enrichment. |
| VII | Single-Ecosystem Simplicity | PASS | TypeScript/Node 20 throughout. One Postgres (`pgvector/pgvector:pg16`) holds reference + documents + vectors. Docker Compose is the only orchestrator. No Python side-services (embeddings via `@xenova/transformers`). No LangChain / LlamaIndex. |
| VIII | Reproducibility as a First-Class Concern (red line) | PASS | `.nvmrc` pins Node 20; `pgvector/pgvector:pg16` pinned with digest captured in manifest; `bge-small-multilingual-v1.5@1.0.0` pinned; `enrich-v1` prompt template version included in `source_hash`; quickstart.md is the Principle VIII reproducibility path and doubles as the CI integration test. |
| IX | Opus as a Tool, Not a Crutch | PASS | Opus is called exactly once per indexable entity during enrichment. SQL parsing, embedding, image build, widget bundle, PII scan, manifest write — all deterministic code. Retries are bounded (one sharpening retry per validator rejection; one HTTP retry per 5xx; halt on auth failure). |
| X | Narrative-Aware Engineering | PASS | This feature is the single most important demo beat: *"run one command, watch the agent get built."* Quickstart §3 is the demo script. No feature creep beyond what survives the 3-minute video. |

**Red lines (I, V, VIII) all PASS unconditionally.** No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/002-build-pipeline/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature spec with Clarifications §2026-04-22
├── research.md          # Phase 0 output (decisions resolved)
├── data-model.md        # Phase 1 output (DB schema + manifest + TS types)
├── quickstart.md        # Phase 1 output (12-section reproducibility path)
├── contracts/           # Phase 1 output
│   ├── slash-command.md    # /atw.build CLI surface
│   ├── scripts.md          # 13 auxiliary scripts
│   ├── enrichment.md       # prompt template + validator + retry
│   └── manifest.md         # build-manifest.json shape
├── checklists/
│   └── requirements.md  # spec quality checklist (12/12 pass)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
ai-to-widget/                        # npm workspaces monorepo
├── .nvmrc                           # Node 20 pin (Feature 001)
├── package.json                     # workspaces: packages/*
├── docker-compose.yml               # ATW service block (still commented from Feature 001)
├── commands/
│   └── atw.build.md                 # NEW — the slash command markdown
├── packages/
│   ├── installer/                   # (Feature 001) copies commands/atw.build.md into Builder's .claude/
│   ├── scripts/
│   │   ├── bin/
│   │   │   ├── atw-start-postgres.js           # NEW — thin shim
│   │   │   ├── atw-apply-migrations.js         # NEW
│   │   │   ├── atw-import-dump.js              # NEW
│   │   │   ├── atw-assemble-entity-input.js    # NEW
│   │   │   ├── atw-enrich-entity.js            # NEW
│   │   │   ├── atw-embed-text.js               # NEW
│   │   │   ├── atw-upsert-document.js          # NEW
│   │   │   ├── atw-render-backend.js           # NEW
│   │   │   ├── atw-compile-widget.js           # NEW
│   │   │   ├── atw-build-backend-image.js      # NEW
│   │   │   ├── atw-compose-activate.js         # NEW
│   │   │   ├── atw-scan-pii-leaks.js           # NEW
│   │   │   └── atw-write-manifest.js           # NEW
│   │   ├── src/
│   │   │   ├── start-postgres.ts               # NEW — dockerode lifecycle
│   │   │   ├── apply-migrations.ts             # NEW — replays SQL files + checksum ledger
│   │   │   ├── import-dump.ts                  # NEW — PII-filtered replay into client_ref
│   │   │   ├── assemble-entity-input.ts        # NEW — reads schema-map, joins related rows
│   │   │   ├── enrich-entity.ts                # NEW — Opus call + sharpening retry
│   │   │   ├── embed-text.ts                   # NEW — @xenova/transformers wrapper
│   │   │   ├── upsert-document.ts              # NEW — source_hash-aware upsert
│   │   │   ├── render-backend.ts               # NEW — Handlebars → backend/src/*.ts
│   │   │   ├── compile-widget.ts               # NEW — esbuild IIFE bundle
│   │   │   ├── build-backend-image.ts          # NEW — dockerode multi-stage build
│   │   │   ├── compose-activate.ts             # NEW — uncomments docker-compose.yml block
│   │   │   ├── scan-pii-leaks.ts               # NEW — normalized substring match per Q1
│   │   │   ├── write-manifest.ts               # NEW — atomic write (tmp+fsync+rename)
│   │   │   ├── orchestrator.ts                 # NEW — /atw.build top-level flow, p-limit driver
│   │   │   ├── migrations/
│   │   │   │   ├── 001_init.sql                # NEW — schemas, atw_migrations table
│   │   │   │   ├── 002_atw_documents.sql       # NEW — atw_documents + source_hash unique index
│   │   │   │   └── 003_hnsw_index.sql          # NEW — pgvector HNSW index on embedding
│   │   │   └── lib/
│   │   │       ├── types.ts                    # NEW — zod schemas: AssembledEntityInput, EnrichmentResponse, BuildManifest, PipelineProgress
│   │   │       ├── source-hash.ts              # NEW — canonical-JSON SHA-256
│   │   │       ├── pricing.ts                  # NEW — Opus 4.7 $/token constants
│   │   │       ├── manifest-io.ts              # NEW — atomic write helper + migrate() upconverter
│   │   │       ├── progress.ts                 # NEW — PipelineProgress renderer (5-entity / 10s cadence)
│   │   │       └── enrichment-validator.ts     # NEW — Principle V structural enforcement
│   │   └── test/
│   │       ├── <each-script>.unit.test.ts      # NEW — one per script
│   │       ├── <each-script>.contract.test.ts  # NEW — one per script
│   │       ├── enrichment-validator.test.ts    # NEW — rule-by-rule rejection cases
│   │       ├── source-hash.test.ts             # NEW — canonicalization + bit-stability
│   │       └── write-manifest.contract.test.ts # NEW — atomic write + schema round-trip
│   ├── backend/                                # NEW WORKSPACE
│   │   ├── package.json
│   │   ├── Dockerfile                          # NEW — multi-stage: builder→runtime, pre-caches embedding model
│   │   ├── .dockerignore                       # NEW
│   │   └── src/
│   │       ├── index.ts.hbs                    # NEW — entry template (Feature 003 fills behavior)
│   │       ├── retrieval.ts.hbs                # NEW — pgvector query template
│   │       ├── enrich-prompt.ts.hbs            # NEW — enrich-v1 prompt template (versioned)
│   │       └── enrich-prompt-sharpen.ts.hbs    # NEW — enrich-sharpen-v1 retry template
│   └── widget/                                 # NEW WORKSPACE (empty shell for Feature 003)
│       ├── package.json
│       └── src/                                # empty until Feature 003
└── tests/
    └── integration/
        ├── build-full-flow.test.ts             # NEW — happy path on Aurelia fixture (SC-012)
        ├── build-resumability.test.ts          # NEW — SIGINT + resume (SC-015)
        ├── build-incremental.test.ts           # NEW — nothing-to-do short-circuit (SC-013)
        ├── build-determinism.test.ts           # NEW — byte-identical outputs across runs (SC-016)
        ├── build-pii-scan.test.ts              # NEW — compliance-scan failure path
        ├── build-docker-down.test.ts           # NEW — Docker-unreachable halt diagnostic
        ├── build-auth-failure.test.ts          # NEW — missing ANTHROPIC_API_KEY halt
        └── build-force-flag.test.ts            # NEW — --force scope verification (Clarifications Q2)
```

**Structure Decision**: Feature 002 extends Feature 001's npm-workspaces
monorepo with two new workspaces (`packages/backend` for Handlebars
templates + Dockerfile, `packages/widget` as an empty shell until
Feature 003) and grows `packages/scripts` with 13 new auxiliary scripts
plus the `orchestrator.ts` that `/atw.build` invokes. This matches the
constitutional bias toward Single-Ecosystem Simplicity (Principle VII)
and Composable Deterministic Primitives (Principle VI): one language, one
package manager, one container runtime, and a flat set of single-purpose
scripts behind one slash command.

## Complexity Tracking

> No Constitution Check violations — this table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| *(none)*  | —          | —                                    |

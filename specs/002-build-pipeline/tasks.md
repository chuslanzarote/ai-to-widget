---

description: "Task list for Feature 002 — Build Pipeline"
---

# Tasks: Build Pipeline (Feature 002)

**Input**: Design documents from `/specs/002-build-pipeline/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests ARE included. The spec enumerates eight integration test suites under `tests/integration/` (plan.md Structure), and every auxiliary script in `contracts/scripts.md` requires one unit test plus one contract test. Tests are treated as first-class deliverables per Principle VIII (Reproducibility).

**Organization**: Tasks are grouped by the nine user stories in spec.md (US1–US9) to enable independent implementation and testing of each story. US1–US3 are all Priority P1 and together constitute the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Monorepo: `packages/scripts/` (CLI + orchestrator + migrations), `packages/backend/` (Handlebars templates + Dockerfile), `packages/widget/` (empty shell), `commands/` (slash command markdown), `tests/integration/` (cross-package integration suite).
- All paths are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the two new workspaces and install every dependency the pipeline needs.

- [ ] T001 Create `packages/backend/` workspace with `package.json`, `tsconfig.json`, `.dockerignore`, and empty `src/` directory
- [ ] T002 [P] Create `packages/widget/` workspace with `package.json`, `tsconfig.json`, and empty `src/` directory (Feature 003 fills later)
- [ ] T003 [P] Add new dependencies to `packages/scripts/package.json`: `@anthropic-ai/sdk`, `@xenova/transformers`, `pg`, `handlebars`, `esbuild`, `dockerode`, `p-limit`, `debug`
- [ ] T004 [P] Add dev dependencies to `packages/scripts/package.json`: `@testcontainers/postgresql`, `@types/pg`, `@types/dockerode`
- [ ] T005 [P] Add workspace entries for `packages/backend` and `packages/widget` to root `package.json`
- [ ] T006 [P] Configure `vitest.config.ts` in `packages/scripts/` with `unit`, `contract`, and `integration` projects and a 60-second default timeout
- [ ] T007 [P] Add root-level `tests/integration/vitest.config.ts` with a 20-minute timeout and `testcontainers` network isolation
- [ ] T008 Run `npm install` at repo root to materialize the new workspaces and dependencies

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, constants, migrations, and helper libraries that every user story depends on.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T009 [P] Define zod schemas for `AssembledEntityInput`, `EnrichmentResponse` (oneOf enriched | insufficient_data), `BuildPlan`, `BuildManifest` (schema_version "1"), and `PipelineProgress` in `packages/scripts/src/lib/types.ts`
- [ ] T010 [P] Define Opus 4.7 pricing constants ($15/$75 per 1M tokens) and `computeCostUsd(tokens)` in `packages/scripts/src/lib/pricing.ts`
- [ ] T011 [P] Implement canonical-JSON serializer (sorted keys, no whitespace) and `computeSourceHash(input, promptVersion, modelId)` in `packages/scripts/src/lib/source-hash.ts` per `contracts/enrichment.md` §4
- [ ] T012 [P] Implement atomic manifest writer (tmp → fsync → rename → fsync parent) and `migrate(oldManifest)` upconverter in `packages/scripts/src/lib/manifest-io.ts` per `contracts/manifest.md` §3
- [ ] T013 [P] Implement `PipelineProgress` renderer (5-entity or 10s cadence, `[PHASE] n/total ✓ ⊙ ✗ $cost elapsed ETA` line format) in `packages/scripts/src/lib/progress.ts`
- [ ] T014 [P] Write migration `packages/scripts/src/migrations/001_init.sql`: `CREATE EXTENSION vector`, `client_ref` schema, `atw_migrations(id PK, filename, sha256, applied_at)` table
- [ ] T015 [P] Write migration `packages/scripts/src/migrations/002_atw_documents.sql`: `atw_documents` table with `entity_type`, `entity_id`, `document`, `facts jsonb`, `categories jsonb`, `embedding vector(384)`, `source_hash`, `opus_tokens jsonb`, `created_at`, `updated_at`; unique index on `(entity_type, entity_id)`; btree index on `source_hash`
- [ ] T016 [P] Write migration `packages/scripts/src/migrations/003_hnsw_index.sql`: HNSW index on `atw_documents.embedding` using `vector_cosine_ops`
- [ ] T017 [P] Unit tests for `source-hash.ts`: canonicalization stability, bit-identical output across runs, metadata-field exclusion per `contracts/enrichment.md` §4 in `packages/scripts/test/source-hash.unit.test.ts`
- [ ] T018 [P] Unit tests for `manifest-io.ts`: round-trip validation, unknown-field preservation, `migrate()` upconversion, interrupted-write safety in `packages/scripts/test/write-manifest.contract.test.ts`
- [ ] T019 Write orchestrator skeleton in `packages/scripts/src/orchestrator.ts` exposing `runBuild(flags)` that validates artifacts, prints the plan summary, waits for `y/N` confirmation, and returns `exitCode` and `BuildManifest` — downstream phases fill in the actual work
- [ ] T020 Write slash-command markdown `commands/atw.build.md` that shells to `npx atw-orchestrate` (orchestrator entry point), per `contracts/slash-command.md` §1–§3; include flag documentation and prerequisite-artifact checks per FR-053

**Checkpoint**: Foundation ready — US1–US9 implementation can now begin.

---

## Phase 3: User Story 1 — One-command build from markdown artifacts (Priority: P1) 🎯 MVP

**Goal**: `/atw.build` takes a project with complete Feature 001 artifacts and produces a running Postgres + populated `atw_documents` + rendered `backend/src/*.ts` + `dist/widget.{js,css}` + `atw_backend:latest` image + `build-manifest.json`, end-to-end, without manual intervention between invocation and completion.

**Independent Test**: On a project with valid `.atw/` artifacts and a SQL dump under `.atw/inputs/`, run `/atw.build`, confirm the plan summary, wait for completion. Verify all six outputs exist per FR-051–FR-079 acceptance scenarios.

### Implementation for User Story 1

- [ ] T021 [P] [US1] Implement `atw-start-postgres` (dockerode lifecycle, `pgvector/pgvector:pg16`, port 5433 default, `--wait-seconds`) in `packages/scripts/src/start-postgres.ts` + shim `packages/scripts/bin/atw-start-postgres.js` per `contracts/scripts.md` §1
- [ ] T022 [P] [US1] Implement `atw-apply-migrations` (replays `src/migrations/*.sql`, ledger via `atw_migrations`, checksum comparison on prior-applied files) in `packages/scripts/src/apply-migrations.ts` + shim per `contracts/scripts.md` §2
- [ ] T023 [P] [US1] Implement `atw-import-dump` (filters SQL dump against `schema-map.md` primary/related tables, drops PII-flagged columns, skips PII-flagged tables entirely) in `packages/scripts/src/import-dump.ts` + shim per `contracts/scripts.md` §3, FR-059, FR-060
- [ ] T024 [P] [US1] Implement `atw-assemble-entity-input` (reads schema-map, joins `client_ref` rows, emits `AssembledEntityInput` JSON, excludes PII columns per FR-068) in `packages/scripts/src/assemble-entity-input.ts` + shim per `contracts/scripts.md` §4
- [ ] T025 [P] [US1] Implement `atw-embed-text` (@xenova/transformers wrapper, loads `bge-small-multilingual-v1.5`, caches model, returns 384-dim vector) in `packages/scripts/src/embed-text.ts` + shim per `contracts/scripts.md` §6, FR-062–FR-064
- [ ] T026 [P] [US1] Implement MVP `atw-enrich-entity` (Opus call, parse JSON, basic shape validation only — full Principle V validator wired in US2) in `packages/scripts/src/enrich-entity.ts` + shim per `contracts/scripts.md` §5
- [ ] T027 [P] [US1] Implement MVP `atw-upsert-document` (inserts/updates row into `atw_documents`, computes `source_hash`, stores `opus_tokens` — skip path added in US3) in `packages/scripts/src/upsert-document.ts` + shim per `contracts/scripts.md` §7
- [ ] T028 [P] [US1] Write Handlebars template `packages/backend/src/index.ts.hbs` (backend entry point — Feature 003 fills runtime behavior; this ships a compiling stub)
- [ ] T029 [P] [US1] Write Handlebars template `packages/backend/src/retrieval.ts.hbs` (pgvector query stub)
- [ ] T030 [P] [US1] Write Handlebars template `packages/backend/src/enrich-prompt.ts.hbs` carrying the `enrich-v1` system block verbatim from `contracts/enrichment.md` §1.1
- [ ] T031 [US1] Implement `atw-render-backend` (Handlebars compile + idempotent write for every `packages/backend/src/*.hbs` → `backend/src/*.ts`) in `packages/scripts/src/render-backend.ts` + shim per `contracts/scripts.md` §8, FR-073–FR-074 (`.bak` logic deferred to US8)
- [ ] T032 [P] [US1] Implement `atw-compile-widget` (esbuild IIFE bundle, no-op output for empty `packages/widget/src/`) in `packages/scripts/src/compile-widget.ts` + shim per `contracts/scripts.md` §9, FR-075
- [ ] T033 [P] [US1] Write multi-stage `packages/backend/Dockerfile` (builder stage: install deps + compile TypeScript; runtime stage: distroless-node, copy compiled JS, pre-cache `@xenova/transformers` embedding model, no secrets) per FR-077
- [ ] T034 [US1] Implement `atw-build-backend-image` (dockerode build using `packages/backend/Dockerfile`, tags as `atw_backend:latest`, guards against secrets in build context) in `packages/scripts/src/build-backend-image.ts` + shim per `contracts/scripts.md` §10 (depends on T033)
- [ ] T035 [P] [US1] Implement `atw-compose-activate` (uncomments ATW block in project-root `docker-compose.yml`, no-op if already active) in `packages/scripts/src/compose-activate.ts` + shim per `contracts/scripts.md` §11, FR-078
- [ ] T036 [P] [US1] Implement `atw-scan-pii-leaks` (iterates PII-flagged columns from `schema-map.md` × every `atw_documents.document`/`facts` text, case-insensitive whitespace-normalized substring match per Clarifications Q1 / FR-088) in `packages/scripts/src/scan-pii-leaks.ts` + shim per `contracts/scripts.md` §12
- [ ] T037 [P] [US1] Implement MVP `atw-write-manifest` (atomic write via `manifest-io.ts`, populates `schema_version`, `build_id`, timing, totals, opus accounting, outputs, environment, compliance_scan) in `packages/scripts/src/write-manifest.ts` + shim per `contracts/scripts.md` §13, FR-079
- [ ] T038 [US1] Wire the full happy-path pipeline in `orchestrator.ts`: boot Postgres → apply migrations → import dump → for-each-entity enrichment loop (bounded `p-limit(10)`) → render backend → compile widget → build backend image → compose-activate → PII scan → write manifest (depends on T021–T037)
- [ ] T039 [US1] Contract test for `atw-start-postgres` (exit codes 0/3/4, JSON output shape) in `packages/scripts/test/start-postgres.contract.test.ts`
- [ ] T040 [P] [US1] Contract test for `atw-apply-migrations` in `packages/scripts/test/apply-migrations.contract.test.ts`
- [ ] T041 [P] [US1] Contract test for `atw-import-dump` in `packages/scripts/test/import-dump.contract.test.ts`
- [ ] T042 [P] [US1] Contract test for `atw-assemble-entity-input` in `packages/scripts/test/assemble-entity-input.contract.test.ts`
- [ ] T043 [P] [US1] Contract test for `atw-embed-text` in `packages/scripts/test/embed-text.contract.test.ts`
- [ ] T044 [P] [US1] Contract test for `atw-enrich-entity` (mock Opus, verify exit codes 0/11/12/13) in `packages/scripts/test/enrich-entity.contract.test.ts`
- [ ] T045 [P] [US1] Contract test for `atw-upsert-document` in `packages/scripts/test/upsert-document.contract.test.ts`
- [ ] T046 [P] [US1] Contract test for `atw-render-backend` in `packages/scripts/test/render-backend.contract.test.ts`
- [ ] T047 [P] [US1] Contract test for `atw-compile-widget` in `packages/scripts/test/compile-widget.contract.test.ts`
- [ ] T048 [P] [US1] Contract test for `atw-build-backend-image` in `packages/scripts/test/build-backend-image.contract.test.ts`
- [ ] T049 [P] [US1] Contract test for `atw-compose-activate` in `packages/scripts/test/compose-activate.contract.test.ts`
- [ ] T050 [P] [US1] Contract test for `atw-scan-pii-leaks` in `packages/scripts/test/scan-pii-leaks.contract.test.ts`
- [ ] T051 [P] [US1] Contract test for `atw-write-manifest` in `packages/scripts/test/write-manifest.contract.test.ts`
- [ ] T052 [US1] Integration test `tests/integration/build-full-flow.test.ts` — runs `/atw.build` against the Aurelia fixture with Opus stubbed to fixture responses; asserts: Postgres up, `atw_documents` row-per-entity, `backend/src/*.ts` present, `dist/widget.{js,css}` present, `atw_backend:latest` in daemon, `.atw/state/build-manifest.json` with `result: "success"` (SC-012), AND `Math.abs(manifest.opus.cost_variance_pct) <= 20` to enforce SC-017 on the real fixture run

**Checkpoint**: `/atw.build` completes end-to-end on the Aurelia fixture. MVP baseline achieved.

---

## Phase 4: User Story 2 — Anchored enrichment with traceable provenance (Priority: P1)

**Goal**: Every `atw_documents` row produced by `/atw.build` contains facts whose `source` references a field actually present in the structured input that was passed to Opus. Zero invented facts.

**Independent Test**: Sample ten rows from `atw_documents`. Every `fact.claim` has a non-empty `source`; every source exists in the entity's assembled input JSON (SC-014).

### Implementation for User Story 2

- [ ] T053 [P] [US2] Implement flattened-key extractor (dotted-path notation, `[n]` for array indices) in `packages/scripts/src/lib/flatten-keys.ts` per `contracts/enrichment.md` §2.4
- [ ] T054 [US2] Implement full `enrichment-validator.ts` applying rules in order: `invalid_shape` → `document_too_short` → `fact_missing_fields` → `source_not_in_input` (Principle V core) → `unknown_category_label` → accept `insufficient_data` branch, per `contracts/enrichment.md` §2 (depends on T053)
- [ ] T055 [P] [US2] Write Handlebars template `packages/backend/src/enrich-prompt-sharpen.ts.hbs` carrying the `enrich-sharpen-v1` template per `contracts/enrichment.md` §3
- [ ] T056 [US2] Upgrade `enrich-entity.ts` to: (a) run validator on 200 responses, (b) on rejection, invoke sharpening retry once with the offending rule cited, (c) on second rejection flag the entity as `validation_failed_twice` and skip, per `contracts/enrichment.md` §3 + FR-067 (depends on T054, T055)
- [ ] T057 [US2] Upgrade `upsert-document.ts` to persist `source_hash` (via `computeSourceHash`) and `opus_tokens` on every upsert (depends on T011)
- [ ] T058 [US2] Wire validator rejections into `orchestrator.ts` progress stream: rejected entities appear as `✗` in the progress line and as `failures[]` entries in the manifest with appropriate `reason` strings per `contracts/manifest.md` §2.5
- [ ] T059 [P] [US2] Unit tests for `flatten-keys.ts`: nested objects, arrays, mixed structures in `packages/scripts/test/flatten-keys.unit.test.ts`
- [ ] T060 [P] [US2] Unit tests for `enrichment-validator.ts`: one rejection case per rule (invalid_shape, document_too_short, fact_missing_fields, source_not_in_input, unknown_category_label) + `insufficient_data` acceptance, in `packages/scripts/test/enrichment-validator.unit.test.ts`
- [ ] T061 [P] [US2] Unit tests for `enrich-entity.ts` retry logic: first-rejection sharpen + accept, first-rejection sharpen + second-rejection flag, in `packages/scripts/test/enrich-entity.unit.test.ts`
- [ ] T062 [US2] Extend `build-full-flow.test.ts` (T052) with: after build, sample 10 random `atw_documents` rows, assert every `fact.source` appears in the assembled input JSON's flattened key set (SC-014)

**Checkpoint**: Principle V is structurally enforced. No Opus hallucination can reach `atw_documents`.

---

## Phase 5: User Story 3 — Resumable build that never restarts from zero (Priority: P1)

**Goal**: Killed builds resume via `source_hash` match without re-paying Opus cost. Total cost across interrupted + resumed runs is within 5 % of a single uninterrupted run (SC-015).

**Independent Test**: Kill `/atw.build` mid-enrichment after N entities. Re-run. Verify the N are skipped, Opus is not re-invoked for them, remaining entities complete.

### Implementation for User Story 3

- [ ] T063 [US3] Add `source_hash` skip path to `orchestrator.ts` enrichment loop: before enqueueing an Opus call, query `atw_documents` for existing `source_hash`; if match and `--force` not set, increment `skipped_unchanged` and skip the call
- [ ] T064 [US3] Implement `.atw/state/input-hashes.json` reader/writer in `packages/scripts/src/lib/input-hashes.ts` that captures SHA-256 of `project.md`, `brief.md`, `schema-map.md`, `action-manifest.md`, `build-plan.md`, SQL dump, and `prompt_template_version`
- [ ] T065 [US3] Wire input-hashes into `orchestrator.ts`: on build start, load prior hashes from `input-hashes.json`; at the end of a successful build, write current hashes atomically
- [ ] T066 [US3] Implement SIGINT handler in `orchestrator.ts`: stop scheduling new Opus calls, await in-flight responses, validate-and-upsert each, skip render/bundle/image/scan phases, write manifest with `result: "aborted"`, exit 2, per `contracts/slash-command.md` §6
- [ ] T067 [P] [US3] Unit tests for `input-hashes.ts`: round-trip, missing-file handling, hash stability in `packages/scripts/test/input-hashes.unit.test.ts`
- [ ] T068 [P] [US3] Unit tests for orchestrator skip logic: given a DB with N existing rows at matching `source_hash`, orchestrator enriches only the remainder in `packages/scripts/test/orchestrator-skip.unit.test.ts`
- [ ] T069 [US3] Integration test `tests/integration/build-resumability.test.ts` — run full build against Aurelia fixture, SIGINT at 30 % progress, re-run, assert second run skips already-indexed entities via `source_hash` and total Opus cost across both runs is within 5 % of a single uninterrupted run (SC-015)

**Checkpoint**: MVP (US1 + US2 + US3) complete. All P1 stories independently testable and functional.

---

## Phase 6: User Story 4 — Cost and duration transparency (Priority: P2)

**Goal**: The estimate from `build-plan.md` is surfaced before the build; real cost and duration are surfaced after and recorded in the manifest. Actual cost on Aurelia fixture within 20 % of estimate (SC-017).

**Independent Test**: Run a build. Plan summary shows estimate from build-plan.md; final output and manifest both contain actual `opus_cost_usd`, `duration_seconds`, and enriched/skipped/failed totals.

### Implementation for User Story 4

- [ ] T070 [US4] Extend the plan-summary renderer in `orchestrator.ts` to read `build-plan.md`, parse `enrichment.estimated_cost_usd` and `estimated_duration_range`, and print them verbatim in the confirmation prompt per `contracts/slash-command.md` §2 and FR-054
- [ ] T071 [US4] Extend `write-manifest.ts` to populate `opus.estimated_cost_usd` and `opus.cost_variance_pct = (actual - estimated) / estimated * 100` per `contracts/manifest.md` §2.6
- [ ] T072 [US4] Extend the final `[DONE]` banner in `progress.ts` to print `$actual actual (estimated $X, ±Y%)`
- [ ] T073 [P] [US4] Unit test for `cost_variance_pct` computation including negative variance and zero-estimate edge case in `packages/scripts/test/cost-variance.unit.test.ts`

**Checkpoint**: Cost transparency matches Principle IX (cost accounting is auditable) and the US4 acceptance scenarios.

---

## Phase 7: User Story 5 — Incremental rebuild on changed artifacts (Priority: P2)

**Goal**: Unchanged inputs → < 30 s no-op (SC-013). Only `action-manifest.md` changed → skip enrichment, run render + bundle + image only (FR-081). `brief.md` changed → warn about re-enrichment (FR-082).

**Independent Test**: After a complete build, re-run with unchanged inputs → "nothing to do" in < 30 s, zero Opus calls. Edit `action-manifest.md` only → enrichment skipped, only render + image happen in < 2 min.

### Implementation for User Story 5

- [ ] T074 [US5] Implement input-hash comparison and branching logic in `orchestrator.ts`: if all input hashes match the prior run's, short-circuit to "nothing to do" (print banner, write manifest with `result: "nothing-to-do"`, exit 0 in < 30 s) per FR-080
- [ ] T075 [US5] Implement partial-rebuild mode in `orchestrator.ts`: if only `action-manifest.md` changed, skip enrichment phase, jump to render/bundle/image per FR-081
- [ ] T076 [US5] Implement `brief.md` change warning in `orchestrator.ts`: on detected change, re-render backend prompt files AND print a warning suggesting `--force` re-enrichment per FR-082
- [ ] T077 [US5] Integration test `tests/integration/build-incremental.test.ts` — scenario 1: re-run with zero changes → < 30 s, zero Opus, `result: "nothing-to-do"`; scenario 2: touch only `action-manifest.md` → render + image only, no enrichment; scenario 3: touch `brief.md` → warning surfaced (SC-013, FR-081, FR-082)

**Checkpoint**: Feature 001's Principle III (Idempotent and Interruptible) extends cleanly into the build phase.

---

## Phase 8: User Story 6 — Clear failure reporting without silent skips (Priority: P2)

**Goal**: Every failure mode surfaces a one-line Builder-facing diagnostic; failures are recorded in the manifest; the build continues for recoverable errors and halts for fatal ones. No bare stack traces.

**Independent Test**: Introduce an empty-description row → build completes, failure in manifest with specific reason. Bad `ANTHROPIC_API_KEY` → halt before enrichment with one-line instruction, no partial state.

### Implementation for User Story 6

- [ ] T078 [US6] Implement HTTP failure-mode matrix in `enrich-entity.ts`: 400 → flag `opus_400` + continue; 401/403 → halt with FR-085 diagnostic; 408/409 → retry once; 429 → exponential backoff (base 1s, max 32s, ±25% jitter); 5xx → retry once, then flag `opus_5xx_twice` per `contracts/enrichment.md` §5
- [ ] T079 [US6] Implement auth-halt path in `orchestrator.ts`: catch `AuthenticationError` from the SDK, print FR-085 one-liner, write manifest with `result: "failed"`, exit 3 before any Opus call was billed beyond the probe
- [ ] T080 [US6] Implement Docker-unreachable halt in `orchestrator.ts`: catch dockerode connection error, print FR-086 one-liner naming Docker Desktop / systemctl, exit 3 per `contracts/slash-command.md` §5
- [ ] T081 [US6] Implement port-conflict halt in `start-postgres.ts`: on `EADDRINUSE` for the configured port, print the `--postgres-port` suggestion diagnostic and exit 4 per `contracts/scripts.md` §1
- [ ] T082 [US6] Implement missing-artifact halt in `orchestrator.ts`: for each of the five required `.atw/` artifacts, print `Missing <path>. Run <prior-command> first.` and exit 3 per FR-053
- [ ] T083 [US6] Implement flag-combination guard: `--entities-only` + `--no-enrich` → halt with meaningful-combination error per FR-072
- [ ] T084 [US6] Extend `orchestrator.ts` to roll up `failures[]` in the manifest with short `reason` enum strings per `contracts/manifest.md` §2.5 (`insufficient_data`, `validation_failed_twice`, `opus_400`, `opus_5xx_twice`, `missing_source_data`)
- [ ] T085 [P] [US6] Integration test `tests/integration/build-docker-down.test.ts` — start `/atw.build` with Docker daemon unreachable; assert one-line diagnostic and exit 3
- [ ] T086 [P] [US6] Integration test `tests/integration/build-auth-failure.test.ts` — start `/atw.build` with unset `ANTHROPIC_API_KEY`; assert one-line FR-085 diagnostic and exit 3 before any container boots
- [ ] T087 [P] [US6] Unit test for HTTP failure-mode matrix in `enrich-entity.ts` with mock Opus server returning each status code, asserting correct flag/retry/halt behavior in `packages/scripts/test/enrich-entity-http.unit.test.ts`

**Checkpoint**: Principle IV ("Fail Loud, Degrade Clean") is honored end-to-end.

---

## Phase 9: User Story 7 — Clean abort that leaves the database consistent (Priority: P2)

**Goal**: Ctrl+C mid-enrichment leaves `atw_documents` in a fully consistent state: every upserted row has `source_hash` and `embedding` set. No partial rows. Next run resumes cleanly.

**Independent Test**: Start a build, Ctrl+C during enrichment after ≥ 5 entities completed. Inspect `atw_documents` → every present row has valid `source_hash` and non-null `embedding`. Re-run → `[ENRICH] 5/N skipped_unchanged 5` at start.

### Implementation for User Story 7

- [ ] T088 [US7] Wrap each per-entity pipeline (assemble → Opus → validate → embed → upsert) in a single transaction in `orchestrator.ts` so partial work rolls back on any exception; only committed rows survive a SIGINT
- [ ] T089 [US7] Extend the SIGINT handler from T066 to print the "letting N in-flight Opus calls complete" banner and the final `$X spent, resume with /atw.build` message per `contracts/slash-command.md` §5
- [ ] T090 [US7] Unit test for per-entity transaction rollback: simulate a post-Opus embedding failure, assert no `atw_documents` row is written for that entity, in `packages/scripts/test/enrich-transaction.unit.test.ts`
- [ ] T091 [US7] Extend `build-resumability.test.ts` (T069) with a post-abort consistency check: query `atw_documents`, assert every row has non-null `source_hash` and non-null `embedding`

**Checkpoint**: Ctrl+C is safe. Resume path (US3) is guaranteed to work.

---

## Phase 10: User Story 8 — Deterministic, auditable generated code (Priority: P2)

**Goal**: Two consecutive builds on unchanged inputs produce byte-identical `backend/src/*.ts` and byte-identical `dist/widget.{js,css}` (SC-016). Hand-edited files are preserved when templates are unchanged; overwritten only after `.bak` when `--backup` is set and content differs.

**Independent Test**: Run `/atw.build` twice. `diff -r backend/src/` and `sha256sum dist/widget.*` across the two runs → zero differences.

### Implementation for User Story 8

- [ ] T092 [US8] Make `render-backend.ts` idempotent: compare template output with existing target file; if byte-identical, mark `action: "unchanged"` and skip write; if different, write atomically per FR-074, FR-087
- [ ] T093 [US8] Implement `--backup` logic in `render-backend.ts`: when flag is set AND target exists AND content differs AND not a pristine render, write `<path>.bak` sibling before overwriting per FR-074
- [ ] T094 [US8] Make `compile-widget.ts` deterministic: set esbuild `banner`, `footer`, `define` values statically; ensure output order is stable; assert byte-equality on repeated runs
- [ ] T095 [US8] Make `build-backend-image.ts` layer-cacheable: order Dockerfile stages so source-file changes don't invalidate dependency layers; rely on Docker's native caching for determinism
- [ ] T096 [P] [US8] Integration test `tests/integration/build-determinism.test.ts` — run `/atw.build` twice on an unchanged fixture; assert byte-identity of every rendered `.ts` file and of `dist/widget.js` + `dist/widget.css` (SC-016), AND byte-compare (bytea equality) a sample of `atw_documents.embedding` vectors across the two runs to enforce FR-063 (embeddings bit-identical)
- [ ] T097 [P] [US8] Unit test for `--backup` flow in `render-backend.ts`: hand-edited file + unchanged template → preserved; hand-edited file + changed template + `--backup` → `.bak` written then overwrite, in `packages/scripts/test/render-backend-backup.unit.test.ts`

**Checkpoint**: Principle VIII (Reproducibility) holds on generated code.

---

## Phase 11: User Story 9 — Configurable concurrency (Priority: P3)

**Goal**: `--concurrency <n>` caps in-flight Opus calls; sustained 429s auto-reduce from default 10 to 3 per FR-070; continued 429s at 3 halt the build.

**Independent Test**: Run `/atw.build --concurrency 3` on a fixture; monitor in-flight Opus call count → never exceeds 3.

### Implementation for User Story 9

- [ ] T098 [US9] Wire `--concurrency <n>` flag through `commands/atw.build.md` → `orchestrator.ts` → `p-limit(n)` with validation that n ≥ 1 per FR-071
- [ ] T099 [US9] Implement auto-reduce logic in `orchestrator.ts`: track rolling 429 count; on 3 consecutive 429s at concurrency 10, reduce to 3 and record a `{at, from, to, reason}` entry in manifest `concurrency.reductions[]`; on 3 further 429s at 3, halt with FR-070 diagnostic per `contracts/enrichment.md` §5
- [ ] T100 [US9] Extend manifest `concurrency` block writer in `write-manifest.ts` to record `configured`, `effective_max`, and `reductions[]` per `contracts/manifest.md` §2.7
- [ ] T101 [P] [US9] Unit test for auto-reduce in `packages/scripts/test/concurrency-reduce.unit.test.ts`: mock Opus returning 429 for first 3 calls, assert reduction to 3; continued 429s at 3 → halt

**Checkpoint**: US9 is a nice-to-have, testable in isolation, and does not block any P1/P2 story.

---

## Phase 12: Polish & Cross-Cutting Concerns

**Purpose**: Integration tests that verify flags/features across stories, cross-platform validation, and quickstart verification.

- [ ] T102 [P] Integration test `tests/integration/build-pii-scan.test.ts` — inject a PII value into the Opus-mocked enrichment response; assert the post-build scan fails the build with `result: "failed"` and non-empty `compliance_scan.matches[]` (SC-018, FR-088)
- [ ] T103 [P] Integration test `tests/integration/build-force-flag.test.ts` — run a full build, then run with `--force` on unchanged inputs; assert (a) every entity is re-enriched (Opus called for all N), (b) migrations are NOT re-run, (c) `client_ref` is NOT re-imported, (d) embedding cache is NOT invalidated, (e) Docker layer cache is still consulted per Clarifications Q2
- [ ] T104 [P] Run quickstart.md manually on macOS, Linux, and WSL2 reference environments per Principle VIII; record timing + any platform-specific notes in `specs/002-build-pipeline/post-impl-notes.md`
- [ ] T105 [P] Add `DEBUG=atw:*` namespaced debug calls to every auxiliary script and the orchestrator per `contracts/scripts.md` cross-cutting; verify output shape with one manual run
- [ ] T106 [P] Add `--help` and `--version` output to every `atw-*` shim per `contracts/scripts.md` cross-cutting
- [ ] T107 Update root `README.md` with a top-level pointer to `specs/002-build-pipeline/quickstart.md` as the Principle VIII reproducibility path
- [ ] T108 Run full `vitest` suite at repo root, ensure all unit + contract + integration tests pass green, zero skips except the opt-in `ATW_E2E_REAL_OPUS=1` smoke
- [ ] T109 [P] Create small-project fixture (~20 entities, single entity type, minimal `.atw/` artifacts) under `tests/fixtures/mini/` and integration test `tests/integration/build-small-project.test.ts` — runs `/atw.build` against the fixture with Opus stubbed; asserts `manifest.result === "success"` AND `manifest.duration_seconds < 300` to enforce SC-019 (small-project wall-clock < 5 min on reference hardware)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. BLOCKS all user stories.
- **Phase 3 (US1 MVP)**: Depends on Phase 2. No dependency on other user stories.
- **Phase 4 (US2)**: Depends on Phase 2. US2 upgrades US1 artifacts (enrich-entity, upsert-document) — start after US1 lands.
- **Phase 5 (US3)**: Depends on Phase 4 (needs `source_hash` from US2's `upsert-document` upgrade).
- **Phase 6 (US4)**: Depends on Phase 3.
- **Phase 7 (US5)**: Depends on Phase 5 (needs input-hashes.json from US3).
- **Phase 8 (US6)**: Depends on Phase 3.
- **Phase 9 (US7)**: Depends on Phase 5 (extends the SIGINT handler from US3).
- **Phase 10 (US8)**: Depends on Phase 3.
- **Phase 11 (US9)**: Depends on Phase 3.
- **Phase 12 (Polish)**: Depends on all desired user-story phases.

### Within Each User Story

- Library code before the scripts that use it.
- Contract tests run against shipped CLI surfaces — written alongside or after implementation (not TDD-first per Principle VIII, which privileges reproducibility over test-first).
- Unit tests can be written in parallel with implementation where they do not require the implementation to exist.

### Parallel Opportunities

- All `[P]`-marked tasks within a phase run in parallel when team capacity allows.
- US1 has 12 `[P]`-parallel script-implementation tasks (T021–T037 excluding T031, T034, T038) — six developers could finish US1 implementation in a weekend.
- US6 failure-mode integration tests (T085, T086, T087) are fully independent.
- Polish phase is almost entirely `[P]`.

---

## Parallel Example: User Story 1

```bash
# Phase 3 script implementations (launch together — different files, no dependencies among the group):
Task: "T021 Implement atw-start-postgres in packages/scripts/src/start-postgres.ts"
Task: "T022 Implement atw-apply-migrations in packages/scripts/src/apply-migrations.ts"
Task: "T023 Implement atw-import-dump in packages/scripts/src/import-dump.ts"
Task: "T024 Implement atw-assemble-entity-input in packages/scripts/src/assemble-entity-input.ts"
Task: "T025 Implement atw-embed-text in packages/scripts/src/embed-text.ts"
Task: "T026 Implement MVP atw-enrich-entity in packages/scripts/src/enrich-entity.ts"
Task: "T027 Implement MVP atw-upsert-document in packages/scripts/src/upsert-document.ts"

# Phase 3 contract tests (launch together, independent files):
Task: "T039 Contract test for atw-start-postgres"
Task: "T040 Contract test for atw-apply-migrations"
Task: "T041 Contract test for atw-import-dump"
# ... and so on for T042–T051

# T038 (orchestrator wiring) and T052 (integration test) depend on all above and run sequentially at the end.
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 — all P1)

1. Complete Phase 1 (Setup) — one afternoon.
2. Complete Phase 2 (Foundational) — one or two developer-days.
3. Complete Phase 3 (US1) — multi-developer weekend on the parallelizable script implementations, then T038 (orchestrator wire) + T052 (integration test) land on the critical path.
4. Complete Phase 4 (US2) — the anchoring validator is the Principle V gate; it upgrades US1's enrich-entity without replacing it.
5. Complete Phase 5 (US3) — source_hash skip + SIGINT handler + input-hashes.
6. **STOP and VALIDATE**: All three P1 integration tests (`build-full-flow`, `build-resumability` partial) green → MVP ready for demo.

### Incremental Delivery (Post-MVP)

7. US4 (cost transparency) — small scope, high Builder-trust value. Ship next.
8. US5 (incremental rebuild) — unlocks Builder workflow speed.
9. US6 (failure reporting) — hardens against real-world flakiness.
10. US7 (clean abort) — bolt-on to US3, minor additional scope.
11. US8 (deterministic generated code) — required for Principle VIII completeness.
12. US9 (configurable concurrency) — nice-to-have.
13. Polish (Phase 12) — quickstart validation, cross-platform, etc.

### Parallel Team Strategy

With three developers:
- After Phase 2 completes: Dev A takes US1 orchestrator + DB scripts (T021–T023, T038), Dev B takes enrichment + embedding scripts (T024–T027), Dev C takes render/compile/image + manifest (T028–T037). Integration wiring and full-flow test land on Dev A at the end.
- Phases 4–5 (US2, US3) land sequentially on Dev A or B; Devs B/C can start Phases 6, 8, 10 in parallel once Phase 3 is green.

---

## Notes

- Tests in this feature ARE first-class: Feature 002 ships with one unit test + one contract test per auxiliary script (24 tests), plus nine integration tests (the eight enumerated in `plan.md` plus `build-small-project` added for SC-019 coverage). This is stricter than the tasks-template default, driven by Principle VIII and the explicit test enumeration in `plan.md` and `contracts/scripts.md`.
- Every task references a concrete file path. Tasks that extend or upgrade an existing file (e.g., T056 "Upgrade `enrich-entity.ts`") name the file that must be edited, not duplicated.
- `[P]` tasks within a phase touch different files and have no ordering dependency within that group — safe for parallel execution.
- Commit after each logical group (setup done, foundational done, US1 script group done, orchestrator wired, integration test green, etc.).
- When a task's acceptance depends on a specific FR, SC, or contract section, the task description names it inline for traceability.
- No task in this plan involves writing CLAUDE.md, spec.md, plan.md, or any other design document — those are owned by the speckit planning phase.

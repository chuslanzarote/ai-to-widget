---
description: "Task list for Feature 001 — Setup Flow"
---

# Tasks: Setup Flow (Feature 001)

**Input**: Design documents from `specs/001-setup-flow/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Selective test coverage is included because the spec's success
criteria (SC-003 Aurelia structural match, SC-004 PII exclusion, SC-005
admin-endpoint exclusion, SC-006 idempotent re-runs) all require
executable verification, and Constitution Principle VIII (Reproducibility)
ships a cross-platform CI matrix. Contract-level unit tests protect the
zod boundary of each auxiliary script; integration tests exercise each
user story end-to-end against Aurelia fixtures.

**Organization**: Tasks are grouped by user story. Setup and Foundational
phases are story-agnostic prerequisites. User story phases (US1→US6)
follow the priority order from [spec.md §User Scenarios & Testing](./spec.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US6). Setup / Foundational / Polish tasks carry no story label.
- Paths are repo-root-relative. Monorepo layout per [plan.md §Project Structure](./plan.md#source-code-repository-root).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bootstrap the npm-workspaces monorepo. No domain code yet.

- [X] T001 Create repo-root `package.json` with `"private": true`, `"workspaces": ["packages/*"]`, `"type": "module"`, Node engine `>=20.0.0`, and dev-script aliases (`dev:install`, `build`, `test`, `lint`).
- [X] T002 [P] Create `tsconfig.base.json` at repo root with strict mode, ES2022 target, Node module resolution, `"composite": true`, and declaration output enabled.
- [X] T003 [P] Create `.nvmrc` at repo root containing `20`.
- [X] T004 [P] Create `vitest.config.ts` at repo root with workspace config pointing at `packages/*` and `tests/`.
- [X] T005 [P] Create `.gitignore` at repo root covering `node_modules/`, `dist/`, `*.tsbuildinfo`, `coverage/`, `.env`, and the dev demo dir (`test-project/`).
- [X] T006 [P] Create `.editorconfig` and `.prettierrc` at repo root for consistent formatting across packages.
- [X] T007 Create `packages/installer/package.json` naming the public package `create-atw`, with `bin` entry, `commander`/`chalk`/`fs-extra`/`write-file-atomic` runtime deps, and `engines.node >=20`.
- [X] T008 [P] Create `packages/installer/tsconfig.json` extending the base config, emit target `packages/installer/dist/`.
- [X] T009 Create `packages/scripts/package.json` as private workspace `@atw/scripts` with `bin` entries for all six scripts, runtime deps (`pgsql-ast-parser`, `@apidevtools/swagger-parser`, `zod`, `gray-matter`, `unified`, `remark-parse`, `remark-frontmatter`, `write-file-atomic`), and `engines.node >=20`.
- [X] T010 [P] Create `packages/scripts/tsconfig.json` extending the base config, emit target `packages/scripts/dist/`.
- [X] T011 [P] Create `commands/` directory at repo root with a `README.md` stating *"Source of `.claude/commands/atw.*.md` files — the installer copies these verbatim into a Builder's project."*
- [X] T012 [P] Create `templates/` directory skeleton at repo root: `templates/atw-tree/{config,artifacts,state,templates}/.gitkeep`.
- [X] T013 [P] Create `tests/` directory at repo root with `integration/`, `fixtures/aurelia/`, `fixtures/malformed/` subdirectories (each with `.gitkeep`).
- [X] T014 Install dependencies by running `npm install` at the repo root so `package-lock.json` is generated and committed (per Principle VIII).

**Checkpoint**: Monorepo scaffolded, deps installed, lockfile committed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared libs and three generic scripts (`write-artifact`,
`load-artifact`, `hash-inputs`) that every user story depends on.
`parse-schema`, `parse-openapi`, and `validate-artifacts` are
story-specific and deferred to their respective phases.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### Shared types and helpers

- [X] T015 [P] Create `packages/scripts/src/lib/types.ts` exporting zod schemas for `ProjectArtifact`, `BriefArtifact`, `SchemaMapArtifact`, `ActionManifestArtifact`, `BuildPlanArtifact`, `ParsedSQLSchema`, `ParsedOpenAPI`, `InputHashRecord`, `LoadedArtifact`, `ArtifactConsistencyReport`, and `StructuralDiff<T>` per [data-model.md](./data-model.md).
- [X] T016 [P] Create `packages/scripts/src/lib/atomic.ts` wrapping `write-file-atomic` to perform atomic writes with a sibling `.bak` backup (FR-046).
- [X] T017 [P] Create `packages/scripts/src/lib/markdown.ts` exporting `parseArtifact(kind, path)` and `serializeArtifact(kind, obj)` helpers using `unified`/`remark-parse`/`remark-frontmatter`/`gray-matter`; implement one parse+serialize per artifact kind.
- [X] T018 [P] Create `packages/scripts/src/lib/structural-diff.ts` exporting a generic `diffByKey<T>(before, after, keyFn)` returning `StructuralDiff<T>` — used for Level-2 change detection (FR-049).
- [X] T019 [P] Create `packages/scripts/src/lib/normalize.ts` with a `normalizeForHash(buffer): Buffer` helper that converts CRLF → LF before hashing (per [research.md §8](./research.md#8-content-hashing-for-idempotency--resolved)).

### Generic auxiliary scripts (used by all commands)

- [X] T020 [P] Contract test for `hash-inputs` in `packages/scripts/test/hash-inputs.contract.test.ts` covering: stable hash across CRLF/LF, `--update-state` writes `input-hashes.json` atomically, `previousSha256` returned correctly on second run, exit codes (0/1/2/3).
- [X] T021 Implement `packages/scripts/src/hash-inputs.ts` + `packages/scripts/bin/atw-hash-inputs.js` shim per [contracts/scripts.md §6](./contracts/scripts.md).
- [X] T022 [P] Contract test for `write-artifact` in `packages/scripts/test/write-artifact.contract.test.ts` covering: atomic success, prior version → `.bak`, rollback on write failure, Windows rename-over-existing safety.
- [X] T023 Implement `packages/scripts/src/write-artifact.ts` + `packages/scripts/bin/atw-write-artifact.js` shim per [contracts/scripts.md §3](./contracts/scripts.md).
- [X] T024 [P] Contract test for `load-artifact` in `packages/scripts/test/load-artifact.contract.test.ts` covering: loads every kind from `examples/sample-*.md`, round-trips through `write-artifact` without structural drift, returns exit 2 on malformed input.
- [X] T025 Implement `packages/scripts/src/load-artifact.ts` + `packages/scripts/bin/atw-load-artifact.js` shim per [contracts/scripts.md §4](./contracts/scripts.md).

**Checkpoint**: Shared libs and generic scripts tested and working. All
six user stories can now start in parallel (subject to team capacity).

---

## Phase 3: User Story 1 — Bootstrap a new project directory (Priority: P1) 🎯 MVP

**Goal**: The installer `npx create-atw@latest .` scaffolds a Builder's
project with the full `.atw/` tree, `.claude/commands/atw.*.md` skeletons,
a commented `docker-compose.yml`, `README-atw.md`, `package.json`, and
an updated `.gitignore` — producing a directory ready for `/atw.init`.
The `/atw.init` command itself is included in this story since US1
promises *"next command: run `/atw.init`"* as a runnable affordance.

**Independent Test**: Run `node packages/installer/dist/index.js ./test-out`
against an empty directory; verify the produced tree matches
[quickstart.md §2](./quickstart.md#2-install-into-an-empty-project).
Re-run without `--force` and verify exit code 2 with conflict listing.
Open the test-out directory in Claude Code and run `/atw.init`; verify
`.atw/config/project.md` appears with the three captured values.

### Tests for User Story 1

- [X] T026 [P] [US1] Integration test: empty-directory scaffold in `tests/integration/installer-fresh.test.ts` — spawn installer, assert every path from [quickstart.md §2](./quickstart.md) tree exists, installer completes in < 60 s (SC-001).
- [X] T027 [P] [US1] Integration test: conflict detection in `tests/integration/installer-conflict.test.ts` — pre-populate `.atw/`, run without `--force`, assert exit 2 and stderr lists conflicting paths (FR-005).
- [X] T028 [P] [US1] Integration test: `--force` re-scaffold in `tests/integration/installer-force.test.ts` — pre-populate `.atw/` with fake Builder edits in `.atw/config/`, re-run with `--force`, assert structural files re-written but `.atw/config/` contents preserved.
- [X] T029 [P] [US1] Integration test: `.gitignore` management in `tests/integration/installer-gitignore.test.ts` — three cases: no `.gitignore` (create), existing without rule (append), existing with rule (no-op) (FR-048).
- [X] T030 [P] [US1] Integration test: `/atw.init` artifact in `tests/integration/atw-init.test.ts` — simulate the three-question interview via a mocked prompt layer, assert `project.md` written atomically with correct fields (FR-008, FR-009).

### Command file skeletons (source for `.claude/commands/`)

- [X] T031 [P] [US1] Write `commands/atw.init.md` with the full three-question flow, project.md output template, idempotent re-run branch (FR-010), and no-LLM note.
- [X] T032 [P] [US1] Write skeleton `commands/atw.brief.md` with section headers (purpose, steps, failure handling, anchored prompt template) — body filled in US2.
- [X] T033 [P] [US1] Write skeleton `commands/atw.schema.md` — body filled in US3.
- [X] T034 [P] [US1] Write skeleton `commands/atw.api.md` — body filled in US4.
- [X] T035 [P] [US1] Write skeleton `commands/atw.plan.md` — body filled in US5.

### Templates copied into the Builder's project

- [X] T036 [P] [US1] Write `templates/docker-compose.yml.tmpl` with Postgres+pgvector service and an `atw-backend` service, both commented out (Feature 002 will uncomment). Pin image tags per Principle VIII.
- [X] T037 [P] [US1] Write `templates/README-atw.md.tmpl` with the Builder-facing quickstart mirroring [quickstart.md](./quickstart.md) §§3–5.
- [X] T038 [P] [US1] Write `templates/package.json.tmpl` with minimal Builder-project deps (`zod`, `@atw/scripts` — or a subset — to enable re-runs of the aux scripts). Pin versions.
- [X] T039 [P] [US1] Write `templates/gitignore-atw-block.txt` containing the exact lines to append to `.gitignore` (`.atw/inputs/`, plus a comment explaining why) (FR-048).
- [X] T040 [P] [US1] Populate `templates/atw-tree/` subdirectories (`config/`, `artifacts/`, `state/`, `templates/`) with `.gitkeep` files so the installer copies the skeleton.

### Installer implementation

- [X] T041 [US1] Implement `packages/installer/src/index.ts` — commander CLI accepting `<target-dir>`, `--force`, `--dry-run`; dispatches to scaffold.
- [X] T042 [P] [US1] Implement `packages/installer/src/conflicts.ts` — detect existing `.atw/` and list conflicting paths; exit code 2.
- [X] T043 [P] [US1] Implement `packages/installer/src/gitignore.ts` — create/append-only-if-absent the `.atw/inputs/` block (FR-048).
- [X] T044 [P] [US1] Implement `packages/installer/src/messages.ts` — chalk-colored helpers for progress lines and the final `Next: ... /atw.init` message (FR-006).
- [X] T045 [US1] Implement `packages/installer/src/scaffold.ts` — copies `templates/` and `commands/` into the target, creates `.atw/` subdirs, writes `package.json` only when absent. Uses `fs-extra.copy` and `write-file-atomic` for single files. Depends on T036–T040, T042–T044.
- [X] T046 [US1] Create `packages/installer/bin/create-atw.js` shebang entry pointing at `dist/index.js`; ensure `chmod +x` equivalent via `package.json` `bin` field.

### `/atw.init` functional implementation

- [X] T047 [US1] Implement `/atw.init` behavior via `commands/atw.init.md` + a minimal helper in `packages/scripts/src/init-project.ts` that validates and writes `.atw/config/project.md` through `write-artifact`. No LLM call (FR-009).
- [X] T048 [US1] Add `packages/scripts/test/init-project.unit.test.ts` covering: valid answers → correct artifact; re-run loads existing values and accepts changes (FR-010).

**Checkpoint**: Installer ships. Builder can go from empty directory to
ready-for-`/atw.brief` state. US1 is independently demo-able.

---

## Phase 4: User Story 2 — Capture the business brief conversationally (Priority: P1)

**Goal**: `/atw.brief` interviews the Builder, synthesizes a draft
anchored to their statements only, and writes `.atw/config/brief.md`
matching `examples/sample-brief.md` after explicit confirmation.

**Independent Test**: With a fresh install and `project.md` present, run
`/atw.brief` with scripted answers against the Aurelia brief fixture;
assert `brief.md` structure matches `examples/sample-brief.md`
(headings, section order) and that no unasserted facts appear in the
output (FR-013).

### Tests for User Story 2

- [X] T049 [P] [US2] Fixture: `tests/fixtures/aurelia/brief-answers.json` containing scripted answers to the eight brief questions for Aurelia (used by the integration test below).
- [X] T050 [P] [US2] Integration test: brief synthesis in `tests/integration/atw-brief.test.ts` — inject the answer fixture into a mocked LLM layer, run `/atw.brief` E2E, assert `brief.md` has every required heading from [data-model.md §1.2](./data-model.md#12-business-brief) and contains only statements present in the fixture (FR-013).
- [X] T051 [P] [US2] Integration test: re-run refinement in `tests/integration/atw-brief-rerun.test.ts` — after one successful run, re-run with an unchanged input-hash; assert no LLM call, current values shown, Builder-driven section update preserved (FR-015, FR-049 L1).
- [X] T052 [P] [US2] Unit test: contradiction handling in `packages/scripts/test/brief-contradiction.unit.test.ts` — verify the contradiction surfacer detects self-conflicting answers and returns a prompt for disambiguation (FR-014).

### `/atw.brief` implementation

- [X] T053 [US2] Fill in `commands/atw.brief.md` with the eight-question interview flow, anchored synthesis prompt (per source doc §5.3 + FR-013 constraints), confirmation gate, and re-run branch (FR-015).
- [X] T054 [P] [US2] Implement `packages/scripts/src/lib/brief-synthesis.ts` — helper that formats the synthesized-draft verification routine (used by the LLM step): checks every claim in the draft is traceable to a Builder statement, returns a `{valid, unsupportedClaims[]}` report.
- [X] T055 [P] [US2] Implement `packages/scripts/src/lib/contradiction-check.ts` — compares Builder answers pairwise for contradiction patterns (allowed vs forbidden actions, tone, scope) and returns a prompt-ready conflict list (FR-014).

**Checkpoint**: `/atw.brief` produces anchored, reviewed `brief.md`.

---

## Phase 5: User Story 3 — Interpret the schema with PII protection (Priority: P1)

**Goal**: `/atw.schema` parses a `pg_dump --schema-only` (deterministically),
classifies tables with evidence, flags PII automatically, presents
entity-by-entity review, and writes `schema-map.md` only after
confirmation. Supports schemas of 300+ tables via FK-cluster chunking.

**Independent Test**: With `project.md` + `brief.md` in place, run
`/atw.schema` against `tests/fixtures/aurelia/schema.sql` with a
scripted review flow; assert `schema-map.md` matches
`examples/sample-schema-map.md` structurally, `customer` /
`customer_address` / `payment` tables are PII-excluded without
intervention (SC-004), and no database connection string is ever
requested or accepted (SC-010 negative check).

### Aurelia SQL fixture

- [ ] T056 [US3] Create `tests/fixtures/aurelia/schema.sql` — Medusa-style schema-only dump covering ≈ 60 tables: product, product_variant, product_collection, product_category, sales_channel, region, store, customer, customer_address, order, order_line_item, cart, payment, shipping_method, etc. Must include PII-heavy tables to validate SC-004.
- [ ] T057 [P] [US3] Create `tests/fixtures/aurelia/schema-with-data.sql` — subset of Aurelia product catalog rows for 50-row sample validation (FR-016).
- [ ] T058 [P] [US3] Create `tests/fixtures/malformed/broken.sql` — truncated `CREATE TABLE` statement for parse-failure testing.
- [ ] T059 [P] [US3] Create `tests/fixtures/large-schema.sql` — synthetic 120-table schema with FK clusters (to exercise FR-024 chunking).

### Tests for User Story 3

- [X] T060 [P] [US3] Contract test for `parse-schema` in `packages/scripts/test/parse-schema.contract.test.ts` — asserts `ParsedSQLSchema` shape via zod, exit codes (0/1/2/3), 50-row cap on sample data (FR-016).
- [X] T061 [P] [US3] Unit test: PII detection in `packages/scripts/test/pii-detection.unit.test.ts` — column-name + sample-value heuristics correctly flag the PII column classes from FR-021 (email/phone/name/address/payment/gov-id/free-text).
- [X] T062 [P] [US3] Unit test: FK clustering in `packages/scripts/test/fk-clusters.unit.test.ts` — union-find over Aurelia's FK graph produces semantically coherent clusters; single-component graph stays intact.
- [X] T063 [P] [US3] Unit test: credential rejection in `packages/scripts/test/credential-rejection.unit.test.ts` — inputs matching connection-string patterns (`postgres://`, `postgresql://`, `host=... password=...`) are rejected at the script boundary (FR-018 + SC-010).
- [X] T064 [P] [US3] Integration test: Aurelia end-to-end in `tests/integration/atw-schema-aurelia.test.ts` — run `/atw.schema` against `schema.sql`, assert SC-003 structural match and SC-004 PII exclusion with zero Builder intervention.
- [X] T065 [P] [US3] Integration test: large-schema chunking in `tests/integration/atw-schema-chunking.test.ts` — run against `large-schema.sql`, assert FK-cluster chunking occurred, no single LLM request exceeded token limits (FR-024).
- [X] T066 [P] [US3] Integration test: malformed SQL in `tests/integration/atw-schema-malformed.test.ts` — run against `broken.sql`, assert parse error with line/column reported, no LLM call attempted (edge case §Edge Cases).
- [X] T067 [P] [US3] Integration test: re-run structural diff in `tests/integration/atw-schema-rerun.test.ts` — after a completed run, add one table to `schema.sql`, re-run; assert LLM invoked only on the added table (FR-049 L2).

### Implementation

- [X] T068 [US3] Implement `packages/scripts/src/parse-schema.ts` + `packages/scripts/bin/atw-parse-schema.js` — uses `pgsql-ast-parser`, emits `ParsedSQLSchema`, caps sample rows at 50/table (FR-016, FR-017).
- [X] T069 [P] [US3] Implement `packages/scripts/src/lib/pii-detection.ts` — column-name + sample-value heuristics per FR-021; returns `{columns: PIIFlag[], tables: PIIFlag[]}`. Table-level defaults per FR-022.
- [X] T070 [P] [US3] Implement `packages/scripts/src/lib/fk-clusters.ts` — union-find over FK graph; exported helper `clusterTables(schema): Cluster[]` for FR-024 chunking.
- [X] T071 [P] [US3] Implement `packages/scripts/src/lib/credential-guard.ts` — regex + heuristic rejection of connection strings and credentials at the script boundary (FR-018).
- [X] T072 [US3] Fill in `commands/atw.schema.md` with the four-step pipeline (deterministic parse → hash+diff → LLM classification with chunking → interactive review → atomic write), PII defaults explained (FR-021, FR-022), re-run branch (FR-025), and Builder-edit-respected semantics (FR-040). Depends on T068–T071.

**Checkpoint**: `/atw.schema` produces a PII-safe `schema-map.md` for the
Aurelia demo with zero Builder intervention on PII exclusion.

---

## Phase 6: User Story 4 — Classify API endpoints (Priority: P2)

**Goal**: `/atw.api` parses an OpenAPI spec deterministically, classifies
every operation into one of six buckets, excludes admin endpoints by
default for customer-facing deployments, marks destructive operations
with `requires_confirmation: true`, and writes `action-manifest.md`
after review.

**Independent Test**: With upstream artifacts in place, run `/atw.api`
against `tests/fixtures/aurelia/openapi.json`; assert `action-manifest.md`
matches `examples/sample-action-manifest.md` structurally, all `/admin/*`
operations are excluded without intervention (SC-005), and destructive
operations carry `requires_confirmation: true`.

### Aurelia OpenAPI fixture

- [X] T073 [US4] Create `tests/fixtures/aurelia/openapi.json` — Medusa-style OpenAPI 3.1 spec with ≈ 120 operations across product / cart / customer / order / admin namespaces. Include destructive operations (cart delete, order cancel) to exercise FR-031.
- [X] T074 [P] [US4] Create `tests/fixtures/malformed/swagger-2.0.yaml` — Swagger 2.0 spec fragment to exercise FR-033 fallback + version detection (research §3).

### Tests for User Story 4

- [X] T075 [P] [US4] Contract test for `parse-openapi` in `packages/scripts/test/parse-openapi.contract.test.ts` — asserts `ParsedOpenAPI` shape, exit codes (0/1/2/3/4), Swagger 2.0 detection returns exit 3, URL-unreachable returns exit 2 offering file fallback.
- [X] T076 [P] [US4] Integration test: Aurelia admin exclusion in `tests/integration/atw-api-aurelia.test.ts` — assert SC-005: every `/admin/*` operation excluded from the manifest with zero Builder intervention.
- [X] T077 [P] [US4] Integration test: destructive confirmation in `tests/integration/atw-api-destructive.test.ts` — assert every DELETE/cancel operation in the manifest carries `requires_confirmation: true` (FR-031).
- [X] T078 [P] [US4] Integration test: Swagger 2.0 fallback in `tests/integration/atw-api-swagger2.test.ts` — feed the Swagger 2.0 fixture, assert command detects the version and surfaces the conversion suggestion without halting ungracefully (FR-033).
- [X] T079 [P] [US4] Integration test: URL unreachable fallback in `tests/integration/atw-api-url-fallback.test.ts` — point at a non-routable URL, assert the command offers the file-path fallback rather than retrying indefinitely (FR-033).

### Implementation

- [X] T080 [US4] Implement `packages/scripts/src/parse-openapi.ts` + `packages/scripts/bin/atw-parse-openapi.js` — uses `@apidevtools/swagger-parser.bundle()`, detects 2.0 / 3.0 / 3.1, resolves `$ref`s (FR-026, FR-027, FR-033).
- [X] T081 [P] [US4] Implement `packages/scripts/src/lib/admin-detection.ts` — detects admin namespace patterns (`/admin/*`, `x-admin: true`, admin-only security schemes) for default exclusion (FR-029).
- [X] T082 [P] [US4] Implement `packages/scripts/src/lib/destructive-detection.ts` — detects destructive operations (DELETE verb, "cancel"/"delete"/"remove" verbs in operationId, state-changing mutations) for `requires_confirmation: true` (FR-031).
- [X] T083 [US4] Fill in `commands/atw.api.md` with the four-step pipeline (deterministic parse → hash+diff → LLM classification → entity-grouped review → atomic write), explicit defaults for admin exclusion and destructive confirmation, URL-fallback and Swagger-2.0 handlers.

**Checkpoint**: `/atw.api` produces an admin-safe `action-manifest.md`
with `requires_confirmation` correctly set for destructive operations.

---

## Phase 7: User Story 5 — Consolidate the plan with cost estimate (Priority: P2)

**Goal**: `/atw.plan` validates cross-artifact consistency, synthesizes
the build plan, displays a cost estimate broken down by enrichment call
count × per-call cost × total + buffer, and writes `build-plan.md`
only after Builder confirmation.

**Independent Test**: With all four upstream artifacts in place, run
`/atw.plan`; assert the produced `build-plan.md` matches
`examples/sample-build-plan.md` structurally, the cost estimate
appears before the confirmation prompt with all four components
(calls / per-call / total / buffer), and missing-upstream cases halt
with explicit next-command guidance (FR-037).

### Tests for User Story 5

- [X] T084 [P] [US5] Contract test for `validate-artifacts` in `packages/scripts/test/validate-artifacts.contract.test.ts` — asserts `ArtifactConsistencyReport` shape and the four inconsistency kinds from [data-model.md §2.5](./data-model.md#25-artifactconsistencyreport), exit codes (0/1/2/3).
- [X] T085 [P] [US5] Integration test: happy-path plan in `tests/integration/atw-plan-aurelia.test.ts` — with all four Aurelia upstream artifacts in place, run `/atw.plan`, assert cost estimate displayed with all four components, `build-plan.md` matches `examples/sample-build-plan.md` structurally.
- [X] T086 [P] [US5] Integration test: missing upstream in `tests/integration/atw-plan-missing-upstream.test.ts` — delete `schema-map.md`, run `/atw.plan`, assert halt with message naming `/atw.schema` as the next command to run (FR-037).
- [X] T087 [P] [US5] Integration test: cross-artifact inconsistency in `tests/integration/atw-plan-inconsistent.test.ts` — craft an `action-manifest.md` referencing an entity excluded from `schema-map.md`, run `/atw.plan`, assert it surfaces the inconsistency and asks for resolution (FR-038).

### Implementation

- [X] T088 [US5] Implement `packages/scripts/src/validate-artifacts.ts` + `packages/scripts/bin/atw-validate-artifacts.js` — loads all four artifacts via `load-artifact`, runs cross-reference checks (action→entity, plan→upstream, brief-vocab→schema-map), returns `ArtifactConsistencyReport`.
- [X] T089 [P] [US5] Implement `packages/scripts/src/lib/cost-estimator.ts` — computes enrichment-call count from `schema-map` entity count × per-entity multiplier, per-call cost from a constants table, and retry buffer per FR-035.
- [X] T090 [US5] Fill in `commands/atw.plan.md` with the five-step pipeline (preflight validate → LLM synthesis → cost-estimate display → review + adjustments → atomic write) and the explicit halt-on-missing-upstream behavior. Depends on T088, T089.

**Checkpoint**: Full flow executable end-to-end on Aurelia: Builder
goes from empty directory to complete `.atw/` artifact set.

---

## Phase 8: User Story 6 — Iterate, edit, and resume without loss (Priority: P3)

**Goal**: Re-running any command preserves prior decisions via the
two-level change detection (FR-049), respects Builder hand-edits to
artifacts (FR-040), and recovers cleanly from mid-command interruptions
(FR-050).

**Independent Test**: Execute the full Aurelia flow once; then
(a) re-run each command with unchanged inputs and assert zero LLM calls
+ full decision preservation; (b) hand-edit `schema-map.md` to remove
an entity, run `/atw.plan`, assert the plan reflects the edit without
cache override; (c) simulate mid-command Claude Code close before
confirmation, re-run the command, assert no persisted mid-command
draft state and fresh synthesis from the same inputs.

### Tests for User Story 6

- [X] T091 [P] [US6] Integration test: full-flow idempotency in `tests/integration/idempotency-full-flow.test.ts` — complete Aurelia flow end-to-end twice back-to-back without input changes; assert the second run makes zero LLM calls across all five commands (SC-006, FR-049 L1).
- [X] T092 [P] [US6] Integration test: Builder edit respected in `tests/integration/builder-edit-respected.test.ts` — hand-edit `schema-map.md` to mark a table as excluded; run `/atw.plan`; assert the plan reflects the Builder's edit (SC-007, FR-040).
- [X] T093 [P] [US6] Integration test: structural diff delta in `tests/integration/structural-diff-delta.test.ts` — after completed flow, add three tables to `schema.sql`, re-run `/atw.schema`, assert LLM invoked only on the three new tables and existing decisions untouched (FR-049 L2).
- [X] T094 [P] [US6] Integration test: mid-command atomicity in `tests/integration/mid-command-atomicity.test.ts` — simulate killing the command between LLM proposal and confirmation; re-run; assert no draft file exists under `.atw/` and the re-run re-synthesizes from the same inputs (FR-050).
- [X] T095 [P] [US6] Integration test: `.atw/inputs/` lifecycle in `tests/integration/inputs-lifecycle.test.ts` — stage a file under `.atw/inputs/`, run the flow, delete the artifact, re-run; assert the input is still on disk and was not auto-purged (FR-048).

### Implementation (mostly integration glue)

- [X] T096 [US6] Wire `hash-inputs` Level-1 short-circuit into every `/atw.*` command body (refine `commands/atw.brief.md`, `atw.schema.md`, `atw.api.md`, `atw.plan.md` — one commit per file, five files total). Enters refinement mode when hash unchanged AND committed artifact exists (FR-049 L1 per [data-model.md §1.6](./data-model.md) clarification).
- [X] T097 [P] [US6] Wire `structural-diff` Level-2 into the LLM request construction for `/atw.schema` (table-level diff) and `/atw.api` (operation-level diff); LLM operates only on the delta (FR-049 L2).
- [X] T098 [P] [US6] Document mid-command atomicity in each command markdown file — explicit note in the re-run branch that in-progress drafts are discarded on interruption (FR-050).

**Checkpoint**: All six user stories delivered. Setup flow is complete
and robust to re-runs, edits, and interruptions.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Fit-and-finish that crosses multiple stories — quickstart
validation, CI matrix, publishing prep, docs.

- [X] T099 [P] Create `README.md` at repo root with the Principle VIII quickstart (`git clone && npx create-atw@latest test-project`), the three-platform support note, and links to `constitution.md`, `PRD.md`, `specs/001-setup-flow/`.
- [X] T100 [P] Create `.github/workflows/ci.yml` — matrix on `macos-latest`, `ubuntu-latest`, `windows-latest` × Node 20; install, build, lint, run vitest (Principle VIII).
- [X] T101 [P] Add npm publishing metadata to `packages/installer/package.json` — `files`, `publishConfig.access: public`, `repository`, `homepage`, `keywords`. Prepares `create-atw` for `npm publish`.
- [X] T102 [P] Wire `eslint` + `prettier` configs at repo root (inheriting into both packages); add `npm run lint` script.
- [X] T103 [P] Add a root-level `scripts/dev-install.ts` + `npm run dev:install` alias that runs the installer against a local `dev-out/` directory without needing an npm publish (for Builder-side iteration while developing Feature 001).
- [X] T104 Run the [quickstart.md](./quickstart.md) end-to-end on macOS (or via CI smoke run) against `tests/fixtures/aurelia/`; record the wall-clock time (target < 30 min per SC-002).
- [X] T105 [P] Bundle Aurelia fixtures into a pre-built `.atw/` set under `examples/aurelia-completed/` so reviewers can inspect the full output without re-running the flow (Principle VIII "pre-built `.atw/` artifacts" guidance).
- [X] T106 Final spec-compliance sweep — walk every FR-001 through FR-050 in [spec.md](./spec.md) and confirm the covering tasks exist; document any gaps in `specs/001-setup-flow/post-impl-notes.md` (deferred; empty on first completion).

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: no dependencies — start immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. Blocks Phases 3–8.
- **Phase 3 (US1 — Bootstrap, P1)**: depends on Phase 2.
- **Phase 4 (US2 — Brief, P1)**: depends on Phase 2. Needs US1's installer only for end-to-end integration tests; unit-level work can parallel US1.
- **Phase 5 (US3 — Schema, P1)**: depends on Phase 2. Needs US1's installer for E2E tests; unit-level work can parallel US1 and US2.
- **Phase 6 (US4 — API, P2)**: depends on Phase 2. For E2E tests also needs schema-map output (US3) — script-level work is still parallel-safe.
- **Phase 7 (US5 — Plan, P2)**: depends on Phase 2 and needs all four upstream artifacts for its integration tests → depends on US1–US4 reaching green E2E before Phase 7's E2E tests pass.
- **Phase 8 (US6 — Iterate, P3)**: depends on Phase 2. Its integration tests assume the full flow works → gate its E2E tests behind US1–US5 passing.
- **Phase 9 (Polish)**: depends on all desired user stories being complete.

### Within each user story

- Fixtures before tests, tests before implementation where tests drive the contract (zod boundaries).
- Helpers (single-responsibility modules) before the command markdown that composes them.
- `write-artifact` invocation is always last inside the command pipeline (Principle IV + FR-041).

### Parallel opportunities

- **Setup**: T002, T003, T004, T005, T006, T008, T010, T011, T012, T013 all run in parallel (different files).
- **Foundational**: T015, T016, T017, T018, T019 all parallel (different files). T020/T022/T024 contract tests parallel; implementations T021/T023/T025 run after the corresponding test.
- **User Story 1**: T026–T030 tests parallel; T031–T035 command skeletons parallel; T036–T040 template files parallel; T042–T044 installer helpers parallel (T041 + T045 + T046 depend on them).
- **User Story 2**: T049, T050, T051, T052 parallel; T054, T055 parallel; T053 depends on both.
- **User Story 3**: T056–T059 fixtures parallel; T060–T067 tests parallel; T069, T070, T071 parallel; T068 + T072 depend on them.
- **User Story 4**: T073, T074 fixtures parallel; T075–T079 tests parallel; T081, T082 parallel; T080 + T083 depend on them.
- **User Story 5**: T084–T087 parallel; T089 parallel with T088; T090 depends on both.
- **User Story 6**: all tests T091–T095 parallel; T097, T098 parallel with each other after T096.
- **Polish**: T099, T100, T101, T102, T103, T105 parallel; T104 (quickstart smoke) and T106 (spec sweep) sequential at the end.

---

## Parallel Example: User Story 1

```text
# After Phase 2 checkpoint, launch US1 work in parallel streams:

# Stream A — tests:
T026 Integration: empty-directory scaffold    → tests/integration/installer-fresh.test.ts
T027 Integration: conflict detection          → tests/integration/installer-conflict.test.ts
T028 Integration: --force re-scaffold         → tests/integration/installer-force.test.ts
T029 Integration: .gitignore management       → tests/integration/installer-gitignore.test.ts
T030 Integration: /atw.init artifact          → tests/integration/atw-init.test.ts

# Stream B — command markdown skeletons:
T031 commands/atw.init.md
T032 commands/atw.brief.md (skeleton)
T033 commands/atw.schema.md (skeleton)
T034 commands/atw.api.md (skeleton)
T035 commands/atw.plan.md (skeleton)

# Stream C — templates:
T036 templates/docker-compose.yml.tmpl
T037 templates/README-atw.md.tmpl
T038 templates/package.json.tmpl
T039 templates/gitignore-atw-block.txt
T040 templates/atw-tree/**/.gitkeep

# Stream D — installer helper modules:
T042 packages/installer/src/conflicts.ts
T043 packages/installer/src/gitignore.ts
T044 packages/installer/src/messages.ts

# Sequential after streams complete:
T041 packages/installer/src/index.ts
T045 packages/installer/src/scaffold.ts  (depends on T036–T040, T042–T044)
T046 packages/installer/bin/create-atw.js
T047 /atw.init functional impl
T048 /atw.init unit test
```

---

## Implementation Strategy

### MVP First (P1 only = US1 + US2 + US3)

The hackathon MVP is a Builder who can go from empty directory to
schema-map in under 20 minutes:

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational).
3. Complete Phase 3 (US1 — Bootstrap + `/atw.init`).
4. Complete Phase 4 (US2 — `/atw.brief`).
5. Complete Phase 5 (US3 — `/atw.schema`).
6. **STOP and VALIDATE**: demo the P1 flow on Aurelia; confirm SC-001,
   SC-003 (partial), SC-004, SC-010 all pass.

### Incremental delivery (add P2, P3)

7. Add Phase 6 (US4 — `/atw.api`). Validate SC-005.
8. Add Phase 7 (US5 — `/atw.plan`). Validate full SC-003, SC-008 sanity,
   SC-011.
9. Add Phase 8 (US6 — Iterate). Validate SC-006, SC-007.
10. Finish Phase 9 (Polish). Validate SC-002 (full flow < 30 min),
    Principle VIII three-platform CI, publishing readiness.

### Parallel team strategy

After Phase 2:
- Dev A owns US1 (installer + /atw.init).
- Dev B owns US2 (brief) and US5 (plan) — smaller per-story scope, same person can carry them since both are cost-estimator / synthesis shaped.
- Dev C owns US3 (schema) and US4 (api) — both center on a deterministic parser + LLM classifier pattern.
- US6 (iterate) + Phase 9 (polish) are integration and fit-and-finish; bring the team back together for them.

---

## Notes

- **[P] discipline**: A task is marked [P] only when its file is not
  touched by any concurrently running task. When two tasks target the
  same file, they are sequenced by ID.
- **[Story] discipline**: every task in Phases 3–8 carries its `[US#]`
  label; Setup / Foundational / Polish tasks do not.
- **Checkbox discipline**: every line above uses the `- [ ] T###` form.
- **Commit discipline**: prefer one commit per task or per logical
  cluster of [P] tasks. The `after_tasks` git-commit hook handles the
  aggregate commit after this file is written.
- **Confirmation discipline**: every command's implementation must
  explicitly gate its `write-artifact` call behind a Builder
  confirmation turn (Principle IV, FR-041). Reviewers should reject
  any command body that writes before confirming.
- **Anchoring discipline**: any LLM-facing prompt written in a command
  markdown must include the anchoring rules (no unsourced claims,
  evidence-per-classification) per Principle V / FR-013 / FR-020.

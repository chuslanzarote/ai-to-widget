---
description: "Task list for 005-full-reviewer-path"
---

# Tasks: Full Reviewer Path

**Input**: Design documents from `/specs/005-full-reviewer-path/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Contract tests ARE included because the contracts/ documents
specify testable invariants (import closure, failure taxonomy, manifest
shape). Integration tests are included for determinism and the reviewer
walkthrough. Unit tests are included for each new module. This matches
the Feature 002 / 003 / 004 testing convention.

**Organization**: Tasks are grouped by user story. US1 (P1) is the MVP
— everything else depends on it landing first.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no incomplete-task deps)
- **[Story]**: [US1] [US2] [US3] [US4] — maps to spec.md user stories

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prep the workspace for the new modules

- [ ] T001 Verify `packages/scripts/package.json` lists all runtime deps needed by the new modules (handlebars, debug, tar-fs, dockerode — all already present); no changes expected, but confirm with `npm ls --workspace @atw/scripts`
- [X] T002 Add `packages/scripts/src/_shared-lib-allowlist.ts` with the explicit allowlist of filenames in `packages/scripts/src/lib/` that are safe to vendor into Builder projects (seed list: `runtime-config.ts`, `runtime-pii-scrub.ts`, `runtime-credential-strip.ts`, `types.ts`, `error-codes.ts`, `runtime-logger.ts`). This is the single source of truth for what `vendorSharedLib()` is allowed to copy.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared types and error codes that every user-story phase depends on

**⚠️ CRITICAL**: No user-story work can start until Phase 2 completes.

- [X] T003 Extend `OrchestratorFlags` in `packages/scripts/src/orchestrator.ts` to add the optional `skipImage?: boolean` field (data-model.md Entity 4). Do NOT wire the gate yet — that belongs to US1. The field must be present so later phases can typecheck.
- [X] T004 [P] Extend the `BuildManifest` type in `packages/scripts/src/lib/types.ts` with the new `steps` object shape and the `ManifestImageStepAction` / `ManifestRenderStepAction` / etc. enum types (data-model.md Entity 2). Add the new failure-code values (`VENDOR_IMPORT_UNRESOLVED`) to `ManifestFailureReason`.
- [X] T005 [P] Add exit-code constants module `packages/scripts/src/lib/exit-codes.ts` exporting the numeric constants referenced by contracts/orchestrator-cli.md (`EXIT_GENERIC=1`, `EXIT_ENV=3`, `EXIT_TEMPLATE_COMPILE=17`, `EXIT_DOCKER_BUILD=19`, `EXIT_SECRET_IN_CONTEXT=20`). Replace magic numbers in `build-backend-image.ts` and `render-backend.ts` with imports from this module.

**Checkpoint**: Types and constants in place. User-story phases can now begin.

---

## Phase 3: User Story 1 — Builder ends `/atw.build` with a runnable backend (Priority: P1) 🎯 MVP

**Goal**: `/atw.build` produces a `backend/` directory that compiles,
packages, and ships as a tagged `atw_backend:latest` image.

**Independent Test**: From a scaffolded project whose upstream commands
have completed, run `/atw.build` → (a) every import in generated
`backend/src/*.ts` resolves to an existing file, (b) the backend compiles
without errors, (c) `docker images atw_backend:latest` shows a tagged
image. No other pipeline step needs to run.

### Tests for User Story 1

> Write tests first. All MUST fail before T013 lands.

- [X] T006 [P] [US1] Contract test `packages/scripts/test/render-backend.recursive.unit.test.ts` — asserts recursive walk over a fixture templates tree; checks emission order matches byte-sorted relative paths (contracts/render-backend-recursive.md §Ordering guarantee).
- [X] T007 [P] [US1] Contract test `packages/scripts/test/render-backend.vendor.unit.test.ts` — asserts import-rewriting at depth 0 (`config.ts` → `./_shared/…`) and depth 1 (`lib/pii-scrub.ts`, `routes/chat.ts` → `../_shared/…`), and that `grep -r @atw/scripts` on the rendered tree yields zero hits.
- [X] T008 [P] [US1] Unit test `packages/scripts/test/seed-backend-meta.unit.test.ts` — asserts byte-identical copy of Dockerfile, .dockerignore, package.json, tsconfig.json; asserts the diff-vs-prior pipeline tags actions as `created` / `unchanged` / `rewritten`.
- [X] T009 [P] [US1] Unit test `packages/scripts/test/vendor-shared-lib.unit.test.ts` — asserts that only files in the allowlist from T002 are copied; asserts a request to vendor a non-allowlisted file raises `VENDOR_NOT_ALLOWED`; asserts sha256 of vendored file matches source sha256.
- [ ] T010 [P] [US1] Integration test `packages/scripts/test/orchestrator.us1.integration.test.ts` — runs `runBuild()` against a fixture project with Docker available; asserts manifest `result: "success"`, `steps.image.action: "created"`, `backend_image.ref: "atw_backend:latest"`, `backend_image.image_id` non-empty.

### Implementation for User Story 1

- [X] T011 [US1] Rewrite `renderBackend()` in `packages/scripts/src/render-backend.ts` to walk templates recursively (contracts/render-backend-recursive.md §Behaviour change 1). Use `fs.readdir(..., { recursive: true, withFileTypes: true })` OR a manual depth-first walk; sort directory entries with plain byte-comparison at every level; emit relative paths using `/` separators on all platforms. Preserve the existing per-file diff pipeline (created/unchanged/rewritten + backup).
- [X] T012 [US1] Add import-rewriting in `renderBackend()` before Handlebars compile (contracts/render-backend-recursive.md §Behaviour change 2). Algorithm: compute `depth` of output file relative to `backend/src/`; build the `_shared/` prefix; run a regex replace against every `@atw/scripts/dist/lib/<name>.js` specifier. If `<name>` is not in the allowlist (T002), throw `Error` with `code = "VENDOR_IMPORT_UNRESOLVED"` and exit code 17.
- [X] T013 [P] [US1] Create `packages/scripts/src/seed-backend-meta.ts` exporting `seedBackendMeta({ projectRoot, backendPackageDir, backup? })` which copies `Dockerfile`, `.dockerignore`, `package.json`, `tsconfig.json` from `packages/backend/` into `<projectRoot>/backend/`. Same diff pipeline as `renderBackend()`: `created` / `unchanged` / `rewritten`, optional backup. Returns `SeededFile[]` with `{ path, sha256, bytes, action, backup? }`.
- [X] T014 [P] [US1] Create `packages/scripts/src/vendor-shared-lib.ts` exporting `vendorSharedLib({ projectRoot, allowlist })` which copies each allowlisted `.ts` file from `packages/scripts/src/lib/` into `<projectRoot>/backend/src/_shared/`. Same diff pipeline and return shape as `seedBackendMeta`. Discover the import set by scanning the rendered backend source tree for `"@atw/scripts/dist/lib/<name>.js"` specifiers and verifying each `<name>` is in the allowlist (fail loudly if not).
- [X] T015 [US1] Rewire the RENDER step in `packages/scripts/src/orchestrator.ts` (around line 547) to call, in sequence: `seedBackendMeta()` → `renderBackend()` → `vendorSharedLib()`. Collect every file into a single `backendFiles[]` list for the manifest. Preserve the step banner "Rendering backend/src/*.ts ..." but expand it to cover meta + vendored outputs.
- [X] T016 [US1] DELETE the silent try/catch at `packages/scripts/src/orchestrator.ts:612-617`. Let `buildBackendImage()` errors propagate. Import the exit-code constants from T005 so the outer handler can map `error.code` to the correct exit code (contracts/orchestrator-cli.md §IMAGE-step failure taxonomy).
- [X] T017 [US1] Extend the outer catch block in `orchestrator.ts` to convert a thrown `Error` with `code` from IMAGE into a `failure_entries[]` record with `step: "image"` and to set `result: "failed"`. Route the stderr diagnostic through a helper `emitStepFailure(step, err)` that prints a single-line message matching the format in contracts/orchestrator-cli.md.
- [X] T018 [US1] Extend `write-manifest.ts` to emit the new `steps` object (data-model.md Entity 2) and to include the new `input_hashes` entries for seeded meta files and vendored lib files. Do NOT compute `backend_source_tree` yet — that lands in US3.
- [X] T019 [US1] Update the orchestrator's plan-summary output to mention the new image-step expectation ("IMAGE step is mandatory; use --skip-image to suppress"). Keep the change to `--help` out-of-band for now; the `--skip-image` flag wiring happens in US2.

**Checkpoint**: US1 done. `/atw.build` in a fresh demo project produces a tagged image; the reviewer widget works from a full Builder run.

---

## Phase 4: User Story 2 — Build fails loudly when the image cannot be produced (Priority: P2)

**Goal**: Every real image-step failure exits non-zero with a named
cause and a `result: "failed"` manifest. Also adds the `--skip-image`
opt-out (FR-013) so contract tests stay runnable without Docker.

**Independent Test**: Inject one of the failure modes (stop Docker,
corrupt a template, plant `.env` in context) → `/atw.build` exits
non-zero, stderr names the step + cause, manifest records `failed`.

### Tests for User Story 2

- [X] T020 [P] [US2] Contract test `packages/scripts/test/orchestrator.skip-image.contract.test.ts` — asserts `--skip-image` flag appears in `/atw.build --help`; runs `runBuild({ skipImage: true })` with a fixture where Docker is unavailable; asserts `result: "success"`, `steps.image.action: "skipped"`, `steps.image.reason: "suppressed by --skip-image flag"`. [Note: the full runBuild arm is gated on Docker availability via existing `build-docker-down.test.ts`; this file covers the CLI-wiring portion.]
- [X] T021 [P] [US2] Contract test `packages/scripts/test/orchestrator.loud-failure.contract.test.ts` — covers the exit-code map + the non-Docker arms (TEMPLATE_COMPILE, VENDOR_IMPORT_UNRESOLVED). DOCKER_UNREACHABLE is covered by `tests/integration/build-docker-down.test.ts`; SECRET_IN_CONTEXT by the new arm in `build-backend-image.contract.test.ts` (T026); DOCKER_BUILD requires a live daemon and is deferred to the US4 e2e integration.
- [ ] T022 [P] [US2] Contract test `packages/scripts/test/orchestrator.no-overwrite.contract.test.ts` — run `/atw.build` to success (tag `atw_backend:latest`); inject a template failure; re-run; assert `atw_backend:latest` is still the prior image_id (FR-007). [DEFERRED: requires live Docker, covered by US4 integration path.]

### Implementation for User Story 2

- [X] T023 [US2] Wire the `--skip-image` CLI flag in the argv parser in `packages/scripts/src/orchestrator.ts`. Add it to the `parseArgs` options map as a boolean, add its help-text line to `printHelp()`, pipe `values["skip-image"]` into `flags.skipImage` in `runBuild()`.
- [X] T024 [US2] Gate the IMAGE step in `orchestrator.ts` on `if (!flags.entitiesOnly && !flags.skipImage && !abortState.aborted)`. When the flag is set, write `steps.image = { action: "skipped", reason: "suppressed by --skip-image flag" }` into the manifest and skip the dockerode call. The banner should say "IMAGE skipped (--skip-image)".
- [X] T025 [US2] Add the `emitStepFailure(step, err)` helper's implementations for each error code's stderr message (contracts/orchestrator-cli.md §stderr diagnostic column). Ensure every message fits on a single line (no embedded `\n`).
- [X] T026 [US2] Verify `build-backend-image.ts`'s SECRET_IN_CONTEXT guard is reachable on a real Builder run (it already exists at lines 78-104 but was previously short-circuited by the silent try/catch removal in T016). Add a test-run fixture that drops `.env` and asserts the guard fires before dockerode runs.
- [X] T027 [US2] Update the manifest-writer so `failure_entries[]` always includes `code` (not just `reason`) for every failure path — render, bundle, image, compose, scan — so contracts/build-manifest-extensions.md §Rule 5 holds. [Satisfied by the separate `pipeline_failures[]` array (schema: `{step, code, message}`) added in T004 — code is a required field on every pipeline-step failure, distinct from per-entity `failures[].reason`.]
- [X] T028 [US2] Audit every remaining try/catch in `orchestrator.ts` (lines 622-628 compose-activate, any others) for silent-skip behaviour; either promote them to `failure_entries` with `action: "failed"` or explicitly document them as `action: "skipped"` with a reason. No silent catches remain.

**Checkpoint**: US2 done. No path through `/atw.build` produces `result: "success"` with a missing `backend_image` outside `--skip-image`.

---

## Phase 5: User Story 3 — Re-running `/atw.build` with no changes is byte-identical no-op (Priority: P3)

**Goal**: Second run within 10 s, zero file rewrites, image unchanged,
`steps.*.action === "unchanged"` across the board.

**Independent Test**: Build once on stable inputs; capture hashes; build
again; assert every output file sha256 matches and every step reports
`unchanged`.

### Tests for User Story 3

- [ ] T029 [P] [US3] Integration test `packages/scripts/test/orchestrator.determinism.integration.test.ts` — runs `runBuild()` twice on the same fixture; asserts second-run manifest has `steps.render.action = "unchanged"`, `steps.bundle.action = "unchanged"`, `steps.image.action = "unchanged"`, zero files with modified mtimes, second-run duration < 10 s wall-clock (with the first run's image cached locally).
- [ ] T030 [P] [US3] Integration test `packages/scripts/test/orchestrator.input-hash-closure.integration.test.ts` — asserts that every file under `<project>/backend/` has an `input_hashes` entry, and that `backend_source_tree` equals the rolled-up sha256 defined in contracts/build-manifest-extensions.md §backend_source_tree roll-up.
- [ ] T031 [P] [US3] Unit test `packages/scripts/test/write-manifest.source-tree-rollup.unit.test.ts` — pure unit on the rollup helper: same inputs → same hash; reordered inputs → same hash (sort-invariance).

### Implementation for User Story 3

- [X] T032 [US3] Add a `computeBackendSourceTree(inputHashes)` helper to `packages/scripts/src/lib/input-hashes.ts` that filters entries starting with `backend/`, sorts them, joins as `path:sha256` lines, and sha256s the result. Export it for use by the orchestrator.
- [X] T033 [US3] Extend `write-manifest.ts` to populate `input_hashes["backend_source_tree"]` on every run. Ensure the rollup runs AFTER meta+render+vendor complete so the hash set is final. [Done via orchestrator writing `backend_source_tree` into both success and failure manifest assemblies.]
- [X] T034 [US3] Add image-cache short-circuit in `orchestrator.ts`'s IMAGE step: if the prior manifest exists AND `prior.input_hashes.backend_source_tree === current.input_hashes.backend_source_tree` AND `docker.getImage(prior.backend_image.image_id).inspect()` succeeds, skip the actual `buildBackendImage()` call and copy the prior `backend_image` record verbatim; record `steps.image.action: "unchanged"`.
- [X] T035 [US3] Verify the COMPOSE ACTIVATE step is a no-op on re-run (action `unchanged`) — check `compose-activate.ts` for any side effects that would rewrite state, and record the step status in the manifest. [Done via T028: compose step records `{action: "activated" | "unchanged" | "skipped"}` driven by `composeActivate()`'s returned action.]
- [X] T036 [US3] Guard the BUNDLE step similarly: if `compileWidget()` returns identical source paths with identical hashes AND `dist/widget.{js,css}` already match, record `steps.bundle.action: "unchanged"` (this may already be the case from Feature 004 — verify and only patch if needed). [Done: orchestrator now compares widget tree_hash against prior manifest and verifies dist file sha256s before skipping esbuild; records `steps.bundle = {action: "unchanged" | "created"}`.]

**Checkpoint**: US3 done. Determinism contract (principle VIII) extends to meta, vendored lib, and image.

---

## Phase 6: User Story 4 — Reviewer opens the demo and the widget just works (Priority: P2)

**Goal**: Clean clone + `docker compose up -d --wait` → working widget
without running any `/atw.*` command.

**Independent Test**: On a fresh clone of the repo (no prior build
artefacts), run `docker compose up -d --wait`; open
http://localhost:8000; send a query through the widget; receive a
grounded answer.

### Tests for User Story 4

- [ ] T037 [US4] E2E test `tests/integration/reviewer-path.e2e.test.ts` (new file under repo-root `tests/`) — spawns `docker compose up -d --wait` from a temp clone, waits for the atw_backend healthcheck, sends a chat request to http://localhost:3100/v1/chat, asserts a 200 response with a non-empty `reply`. Tears down with `docker compose down`.
- [ ] T038 [P] [US4] Determinism check `tests/integration/committed-demo-is-fixed-point.integration.test.ts` — runs `/atw.build` (via `runBuild()`) against `demo/atw-aurelia/` (the committed state); asserts ZERO files change (every action `unchanged`) and the manifest `backend_source_tree` matches the committed manifest's value.

### Implementation for User Story 4

- [ ] T039 [US4] Add a `build:` directive to the `atw_backend` service in the root `docker-compose.yml`. Shape:
  ```yaml
  atw_backend:
    build:
      context: ./demo/atw-aurelia/backend
      dockerfile: Dockerfile
    image: atw_backend:latest
    # ...existing environment, depends_on, ports, healthcheck blocks unchanged
  ```
  Keep the existing `image:` line so a Builder who ran `/atw.build` gets a cache hit.
- [ ] T040 [US4] Run `/atw.build` on `demo/atw-aurelia/` from a clean state (after Phase 3-5 changes merged locally); commit the populated `demo/atw-aurelia/backend/` directory: Dockerfile, .dockerignore, package.json, tsconfig.json, src/ tree (including _shared/), and the refreshed `.atw/state/build-manifest.json` + `.atw/state/input-hashes.json`. This is the canonical committed snapshot (data-model.md Entity 3).
- [ ] T041 [US4] Update `demo/atw-aurelia/.gitignore` (or repo-root `.gitignore`) to ensure `backend/node_modules/`, `backend/dist/`, and any build-time artefacts stay ignored, but ALL rendered/seeded/vendored source is committed.
- [ ] T042 [US4] Update `specs/003-runtime/quickstart.md` to reference the new reviewer shortcut (one-liner: `docker compose up -d --wait` on a clean clone works) and to point at `specs/005-full-reviewer-path/quickstart.md` for the detailed walkthrough.
- [ ] T043 [US4] Verify the Medusa storefront's widget embed still works post-feature: open `demo/medusa/storefront/` pages referenced in `demo/atw-aurelia/.atw/artifacts/embed-guide.md`, confirm `/widget.js` + `/widget.css` are still served correctly from `public/` and point at `http://localhost:3100`.

**Checkpoint**: US4 done. Feature's acceptance-scenario 1 from the spec holds end-to-end.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Lock the feature in and verify SC-001..SC-008

- [ ] T044 [P] Run every existing test under `packages/scripts/test/` and `tests/` via `npm test`; fix any regression (SC-007 requires zero regressions baseline).
- [ ] T045 [P] Update `packages/scripts/README.md` (if present) or create a short note at `packages/scripts/src/render-backend.ts` header comment documenting the recursive walk + import-rewriting contract.
- [ ] T046 [P] Verify the `--help` output snapshot tests (if any exist) reflect the new `--skip-image` flag.
- [ ] T047 Verify `git status` on the committed repo: after T040 all changes are stable and no transient build-output appears in `git diff`.
- [ ] T048 Walk the quickstart.md Path A steps verbatim from a fresh clone (separate directory). Time end-to-end; assert SC-001 (< 15 minutes wall-clock).
- [ ] T049 Walk the quickstart.md Path B steps verbatim. Re-run `/atw.build` twice; assert SC-004 (< 10 s) and zero file rewrites.
- [ ] T050 Cross-machine determinism spot-check: if a second machine is available, check out the same commit, run `/atw.build`, compare `backend/src/**/*.ts` sha256s and `atw_backend:latest` IMAGE ID (modulo non-semantic timestamps per SC-005). Document the comparison in a one-line PR comment.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: T001 and T002 can run in parallel. No blockers.
- **Phase 2 (Foundational)**: T003 must precede T015/T024. T004 and T005 can run in parallel (different files).
- **Phase 3 (US1 — MVP)**: Depends on Phase 2. Independently testable and deliverable.
- **Phase 4 (US2)**: Depends on Phase 3 (needs `seedBackendMeta` and `vendorSharedLib` wired; needs the silent try/catch removed in T016). Adds `--skip-image` and loud-failure assertions.
- **Phase 5 (US3)**: Depends on Phases 3 + 4 (needs manifest `steps` populated and needs failure paths stable before asserting byte-identical reruns). The determinism work builds on the new manifest shape.
- **Phase 6 (US4)**: Depends on Phase 5 (the committed demo snapshot must be a fixed point, and the determinism rerun is how T038 proves it). Also needs T039's compose change.
- **Phase 7 (Polish)**: Depends on all prior phases.

### User Story Priority Order

Per spec.md Priority Ordering — US1 is MVP (P1). US2 and US4 are P2
(both required for "shipped"). US3 is P3 (determinism invariant). The
recommended delivery sequence for a single developer: **US1 → US2 → US3 → US4**
(US3 before US4 because T040's committed snapshot must be a fixed point,
which US3 formally verifies).

### Within Each User Story

- Tests FIRST (T006-T010, T020-T022, T029-T031, T037-T038) then implementation.
- Models / types (Phase 2) before services.
- Services (`seedBackendMeta`, `vendorSharedLib`, `renderBackend` rewrite) before orchestrator wiring (T015+).
- Manifest shape extension (T018) before determinism work that relies on it (T032-T036).
- Committed demo snapshot (T040) is the LAST substantive change — it reflects all prior source changes.

### Parallel Opportunities

- T001 + T002 (different concerns, one touches npm, one creates a new source file).
- T004 + T005 (both type/constant modules, different files).
- T006-T010 (US1 tests, all different files, no deps beyond Phase 2 types).
- T013 + T014 (two new modules, no mutual imports).
- T020-T022 (US2 tests, all different test files).
- T029-T031 (US3 tests).
- T037 + T038 (US4 tests, independent fixtures).
- T044-T046 (Polish tasks, independent).

---

## Parallel Example: User Story 1 tests (all launchable together)

```bash
# T006-T010: write first, let them fail, then implement.
Task: "Write render-backend.recursive.unit.test.ts — walks subdirs + sort order"
Task: "Write render-backend.vendor.unit.test.ts — rewrites @atw/scripts imports"
Task: "Write seed-backend-meta.unit.test.ts — byte-identical copy + diff pipeline"
Task: "Write vendor-shared-lib.unit.test.ts — allowlist enforcement"
Task: "Write orchestrator.us1.integration.test.ts — full happy-path with Docker"
```

Then implement T011-T019 sequentially (most share `orchestrator.ts`).

---

## Implementation Strategy

### MVP First (US1 only)

1. Phase 1 + Phase 2 (T001-T005).
2. Phase 3 (T006-T019) — tests first, then implementation.
3. **STOP and VALIDATE**: on a fresh scaffolded demo, run `/atw.build`; confirm `docker images atw_backend:latest` exists, the manifest records the image, and `docker compose up -d --wait` succeeds.
4. Ship the MVP; widget works end-to-end from a full Builder flow.

### Incremental delivery

1. MVP (Phase 3) → demo the working widget.
2. Add loud failures (Phase 4) → regression test each failure mode; manifest is trustworthy.
3. Add determinism (Phase 5) → CI can assert reruns are no-ops.
4. Add reviewer shortcut (Phase 6) → commit `demo/atw-aurelia/backend/`; reviewer path drops from "run 8 commands" to "one compose up".
5. Polish (Phase 7) → docs + cross-machine spot-check.

### Parallel team strategy

Not applicable at current team size (solo). Sequential per spec's
Priority Ordering is correct.

---

## Notes

- Tests included because contracts/ specifies testable invariants.
- Every new file has a contract doc pointing at it; keep tasks in lockstep with contracts.
- Commit per task or per logical group (per .specify/extensions.yml auto-commit hook).
- Each checkpoint validates the story independently before moving on.
- Avoid: touching `packages/backend/src/**/*.hbs` during implementation (those are the source of truth being consumed, not modified); touching `packages/widget/` (out of scope per spec).
- Validate the constitution principle VIII on every checkpoint: if `/atw.build` rerun is not a no-op, stop and fix before proceeding.

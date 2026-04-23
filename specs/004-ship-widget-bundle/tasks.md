---

description: "Task list for Feature 004 — Ship the Real Widget Bundle to Builders"
---

# Tasks: Ship the Real Widget Bundle to Builders

**Input**: Design documents from `/specs/004-ship-widget-bundle/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Required. The contracts in `contracts/compile-widget-cli.md` and
`contracts/build-manifest-widget-section.md` both specify explicit test
obligations (regression guard for the stub string, determinism, manifest
shape). Tests are not optional for this feature.

**Organization**: Tasks are grouped by user story. US1 is the MVP and
independently delivers the fix. US2 is the Aurelia-demo acceptance path
(also P1 because it is how US1 is proven end-to-end). US3 and US4 add
auditability and preserve the contributor workflow.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no blocking dependencies).
- **[Story]**: Maps to a user story from `spec.md` (US1–US4).
- File paths are absolute-relative to repo root.

## Path Conventions

Monorepo. Source lives under `packages/scripts/src/` (the code that
changes) and `packages/widget/src/` (the code being shipped, unchanged).
Tests live under `packages/scripts/test/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire `@atw/widget` as a runtime dependency of `@atw/scripts`
so Node's module resolver can find it.

- [x] T001 Add `"@atw/widget": "0.1.0"` to the `dependencies` section of `packages/scripts/package.json` (workspace-resolved; see research.md §R2).
- [x] T002 Run `npm install` at the repo root to materialize the new dependency edge and verify `packages/scripts/node_modules/@atw/widget` symlinks to `packages/widget`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Build the two helpers every story depends on: resolve the
widget source through the Node resolver, and hash the source tree for
the manifest origin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Add `resolveWidgetSource()` helper in `packages/scripts/src/compile-widget.ts` — uses `createRequire(import.meta.url)` + `require.resolve("@atw/widget/package.json")`, returns `{ entry: <widgetRoot>/src/index.ts, widgetRoot, packageVersion }`, throws typed error `code: "WIDGET_SOURCE_MISSING"` on failure (research.md §R1, contracts/compile-widget-cli.md).
- [x] T004 Add `computeWidgetTreeHash(widgetRoot: string)` helper in `packages/scripts/src/compile-widget.ts` — reuses the existing `hashInputs` helper from `packages/scripts/src/hash-inputs.ts`; returns `sha256:<hex>` over a sorted `(relative_path\tfile_sha256)` listing of every file under `<widgetRoot>/src/` (data-model.md §E2, research.md §R3).

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 — Builder runs the pipeline and gets a working widget (Priority: P1) 🎯 MVP

**Goal**: `/atw.build` from any Builder host project emits a real compiled
widget bundle (not the stub) to `dist/widget.js` and `dist/widget.css`.

**Independent Test**: A fixture Builder project containing only a
`package.json` that depends on `@atw/scripts` runs `atw-compile-widget`
and produces a `dist/widget.js` > 1 KB that does not contain the string
`"no-op bundle"`.

### Tests for User Story 1

- [x] T005 [P] [US1] Write unit test `packages/scripts/test/compile-widget.resolve.test.ts` — asserts `resolveWidgetSource()` returns the path to `packages/widget/src/index.ts` when workspaces are active, and throws `WIDGET_SOURCE_MISSING` when `@atw/widget` is not present on the resolution path (simulated via a child process run in a temp dir with only `@atw/scripts` linked).
- [x] T006 [P] [US1] Write unit test `packages/scripts/test/compile-widget.no-stub.test.ts` — runs `compileWidget({ outDir })` and asserts: (a) `widget.js` exists and > 1024 bytes, (b) `widget.js` contains the banner `/* atw-widget */`, (c) `widget.js` does NOT contain the substring `"no-op bundle"` (FR-002 bright-line regression guard, contracts/compile-widget-cli.md §"Regression guard", contracts/build-manifest-widget-section.md §INV-4).
- [x] T007 [P] [US1] Write unit test `packages/scripts/test/compile-widget.cli.test.ts` — asserts the CLI (`runCompileWidget`) exits with code 3 and the exact error message specified in contracts/compile-widget-cli.md §"Exit codes" when `@atw/widget` cannot be resolved.
- [x] T008 [P] [US1] Write integration test `packages/scripts/test/compile-widget.integration.test.ts` — scaffolds a fixture host project directory in a temp dir (only a `package.json` with `@atw/scripts` in dependencies, symlinked into the workspace), runs `atw-compile-widget --out-dir <dist>`, asserts the resulting bundle satisfies acceptance scenarios 1, 2, and 4 from spec.md US1.

### Implementation for User Story 1

- [x] T009 [US1] Rewrite `compileWidget()` in `packages/scripts/src/compile-widget.ts` — remove the `findEntry()` stub-emitting branch and the stub string entirely (research.md §R5), change the `CompileOptions` type to drop `widgetSrcDir`, call `resolveWidgetSource()` (T003) to obtain the entry, pass the result to the existing `esbuild.build()` call unchanged. The `CompileResult` type drops `noop: boolean` and gains `source: { packageVersion, treeHash }`.
- [x] T010 [US1] Rewrite `parseCli()` and `runCompileWidget()` in `packages/scripts/src/compile-widget.ts` — remove the `--widget-src-dir` flag from the `parseArgs` options block and from the `--help` output; keep `--out-dir`, `--minify`/`--no-minify`, `--json`, `--help`, `--version` (contracts/compile-widget-cli.md §"Amended flags").
- [x] T011 [US1] Add the `WIDGET_SOURCE_MISSING` branch in `runCompileWidget()`'s catch block in `packages/scripts/src/compile-widget.ts` — returns exit code 3, writes the exact contract message to stderr (contracts/compile-widget-cli.md §"Exit codes").
- [x] T012 [US1] Update the orchestrator at `packages/scripts/src/orchestrator.ts:577–578` — remove the `widgetSrcDir: join(flags.projectRoot, "widget", "src")` argument from the `compileWidget(...)` call; pass only `{ outDir, minify }`.

**Checkpoint**: `/atw.build` from any Builder host project now emits a real widget. US1 is fully functional and independently testable (T005–T008 all green).

---

## Phase 4: User Story 2 — Aurelia demo runs end-to-end without manual patching (Priority: P1)

**Goal**: Running the Aurelia demo pipeline from a clean clone produces a
working widget without any manual step.

**Independent Test**: From a clean clone, running `atw-compile-widget`
in `demo/atw-aurelia` (cwd `demo/atw-aurelia`) produces
`demo/atw-aurelia/dist/widget.js` > 1 KB containing no stub string.

### Tests for User Story 2

- [x] T013 [P] [US2] Write end-to-end test `packages/scripts/test/compile-widget.aurelia.test.ts` — runs `atw-compile-widget --out-dir <repo>/demo/atw-aurelia/dist` with cwd set to `demo/atw-aurelia`, then asserts: (a) `widget.js` exists and > 1024 bytes, (b) `widget.css` exists and contains at least one CSS rule (regex `/\{[^}]+\}/`), (c) `gzip` of `widget.js` ≤ 81920 bytes, (d) `gzip` of `widget.css` ≤ 10240 bytes, (e) two consecutive runs produce byte-identical output (FR-005 determinism guard).

### Implementation for User Story 2

- [x] T014 [US2] Confirm `demo/atw-aurelia/package.json` needs no edit — add a comment in the quickstart.md §4 noting that the Aurelia demo resolves `@atw/widget` transitively through `@atw/scripts` (research.md §R7). No code change in this task; it is a verification checkpoint that the dependency graph works without touching the demo's manifest.
- [x] T015 [US2] Remove the stale placeholder files `demo/atw-aurelia/dist/widget.js` and `demo/atw-aurelia/dist/widget.css` that currently contain the "Feature 003 populates later" stub (if `dist/` is indeed git-tracked — verify against `.gitignore`; if already ignored, this task is a no-op, mark as N/A in tasks.md when implementing).

**Checkpoint**: Aurelia demo pipeline produces a real widget. US1 + US2 both work independently.

---

## Phase 5: User Story 3 — Bundle origin is observable and auditable (Priority: P2)

**Goal**: Build manifest records the widget-source origin so a reviewer
can reproduce any bundle from the manifest alone.

**Independent Test**: After `/atw.build`, the `widget` section of
`.atw/state/build-manifest.json` matches the schema in
`contracts/build-manifest-widget-section.md` and two runs on the same
source tree produce deep-equal `widget` sections.

### Tests for User Story 3

- [x] T016 [P] [US3] Write unit test `packages/scripts/test/write-manifest.widget-section.test.ts` — builds a manifest with a known `compileWidget` result and asserts the resulting JSON has `widget.result`, `widget.bundle.js.{path,bytes,gzip_bytes,sha256}`, `widget.bundle.css.{…}`, `widget.source.{package_version,tree_hash}` all present and typed per the contract. Validates INV-1 and INV-4 from `contracts/build-manifest-widget-section.md`.
- [x] T017 [P] [US3] Write determinism test `packages/scripts/test/write-manifest.widget-determinism.test.ts` — runs `compileWidget` twice against an unchanged source tree, builds manifests for both, asserts their `widget` sections are deep-equal.

### Implementation for User Story 3

- [x] T018 [US3] Add `buildWidgetManifestSection(compileResult, sourceOrigin): WidgetManifestSection` helper in `packages/scripts/src/write-manifest.ts` — shapes the object per `contracts/build-manifest-widget-section.md` §"Schema"; no I/O, pure transformer.
- [x] T019 [US3] Wire the widget section into the orchestrator's manifest-write path: in `packages/scripts/src/orchestrator.ts`, capture the `compileWidget` result (renamed from `widgetOut`), call `buildWidgetManifestSection()` with the result + `{ packageVersion, treeHash }` returned by T009, attach to the manifest object passed to `writeManifest()`.
- [x] T020 [US3] Promote gzip sizes from debug log to returned values in `packages/scripts/src/compile-widget.ts` `enforceBundleBudget()` — return `{ jsGz, cssGz }` instead of logging only, and include them in the `CompileResult.bundle.{js,css}.gzip_bytes` so T018 can populate the manifest without recomputing.

**Checkpoint**: Every build produces an auditable `widget` section. US1, US2, US3 all work.

---

## Phase 6: User Story 4 — ATW contributor workflow is preserved (Priority: P2)

**Goal**: An uncommitted edit in `packages/widget/src/` is visible in the
rendered widget after running the Aurelia demo pipeline, with no
publish/republish step.

**Independent Test**: Modify a visible string in
`packages/widget/src/panel.tsx`. Run `atw-compile-widget --out-dir
<aurelia-dist>`. The modified string appears in the emitted
`widget.js`; the `widget.source.tree_hash` in the manifest differs from
the pre-edit value.

### Tests for User Story 4

- [x] T021 [P] [US4] Write integration test `packages/scripts/test/compile-widget.contributor-loop.test.ts` — (a) run `compileWidget`, capture `widget.source.tree_hash` and `widget.bundle.js.sha256`, (b) programmatically edit a fixture source file under `packages/widget/src/` (or equivalently, a temp-dir copy of the widget package symlinked in), (c) rerun, (d) assert both `tree_hash` and `sha256` differ, (e) restore the file.

### Implementation for User Story 4

- [x] T022 [US4] Document the contributor loop guarantee in `packages/widget/README.md` (create if absent) — one paragraph citing FR-010 and noting that workspace symlinking means `packages/widget/src/` edits are picked up by the next `atw-compile-widget` run without any republish step. No code change; verification checkpoint.

**Checkpoint**: Contributor edit round-trip works. All four user stories functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Remove stale references, rebuild the `dist/` outputs, and
run the full regression suite.

- [x] T023 [P] Remove or update any mention of `--widget-src-dir` in README files, `demo/*/README-atw.md`, and `commands/atw.build.md` if present.
- [x] T024 [P] Grep the repo for the string `"Feature 003 populates later"` outside of `packages/scripts/dist/` (generated) and `node_modules/` — remove any remaining prose references in docs/comments so the codebase doesn't carry a stale promise.
- [x] T025 Rebuild the `@atw/scripts` dist bundle: `npm run build -w @atw/scripts`. Confirm `packages/scripts/dist/compile-widget.js` no longer contains the stub string (sanity regression check against the generated artifact).
- [x] T026 Run the full repository test suite: `npm test -ws`. All pre-existing Feature 001/002/003 tests must continue to pass. New Feature 004 tests (T005–T008, T013, T016–T017, T021) must be green.
- [ ] T027 Run `specs/004-ship-widget-bundle/quickstart.md §2` (fast unit path) and §3 (integration path) to manually validate the work-flow end-to-end; if `ANTHROPIC_API_KEY` + Docker available, also run §4b (fresh Builder path).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1 (needs `@atw/widget` installed so `require.resolve` works).
- **Phase 3 (US1 / MVP)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 3 (the Aurelia demo path exercises the US1 rewrite).
- **Phase 5 (US3)**: Depends on Phase 3 (needs `CompileResult.source` populated by T009 + `.gzip_bytes` from T020).
- **Phase 6 (US4)**: Depends on Phase 5 (T021 uses the manifest's `tree_hash` as its differential signal).
- **Phase 7 (Polish)**: Depends on Phases 3–6.

### User Story Dependencies

- **US1 (P1)**: Depends only on Foundational. Delivers the MVP.
- **US2 (P1)**: Depends on US1 complete (tests exercise the same `compileWidget`; no new logic, only a new test surface). Independent from the code perspective — touches only tests + stale dist files.
- **US3 (P2)**: Depends on US1 (T009 introduces the source origin plumbing it consumes). Touches only `write-manifest.ts`, `orchestrator.ts` manifest assembly, and one field addition in `compile-widget.ts`. No conflict with US2 files.
- **US4 (P2)**: Depends on US3 (reuses `tree_hash`). Test-only story in code; no production behaviour change beyond what US1+US3 deliver.

### Within Each User Story

- Tests first, then implementation (all test IDs come before implementation IDs within each phase).
- T003, T004 in Phase 2 MUST land before any Phase 3 task — T009 imports them.
- T009 MUST land before T018/T019 (US3 consumes `CompileResult.source`).
- T020 MUST land before T018 (US3 manifest needs `gzip_bytes`).

### Parallel Opportunities

- Within Phase 3 (US1): T005, T006, T007, T008 are all `[P]` — four separate test files.
- Within Phase 5 (US3): T016, T017 are `[P]` — two separate test files.
- Phase 7 polish tasks T023, T024 are `[P]` — different files.
- Across phases: US2 tests (T013) and US3 tests (T016, T017) can be drafted in parallel once T009 exists.

### Forbidden parallelism

- T009, T010, T011 all edit `packages/scripts/src/compile-widget.ts` — they must be sequenced, NOT `[P]`.
- T012, T019 both edit `packages/scripts/src/orchestrator.ts` — sequenced, NOT `[P]`.

---

## Parallel Example: User Story 1

```bash
# Launch all four US1 tests in parallel (distinct files):
Task: "T005 — unit test for resolveWidgetSource in packages/scripts/test/compile-widget.resolve.test.ts"
Task: "T006 — unit test for no-stub regression in packages/scripts/test/compile-widget.no-stub.test.ts"
Task: "T007 — unit test for CLI exit codes in packages/scripts/test/compile-widget.cli.test.ts"
Task: "T008 — integration test for fixture Builder in packages/scripts/test/compile-widget.integration.test.ts"

# Then implementation sequentially (all touch the same files):
Task: "T009 — rewrite compileWidget() in packages/scripts/src/compile-widget.ts"
Task: "T010 — rewrite parseCli/runCompileWidget in the same file"
Task: "T011 — add WIDGET_SOURCE_MISSING exit branch in the same file"
Task: "T012 — drop widgetSrcDir argument in packages/scripts/src/orchestrator.ts"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1 (T001–T002).
2. Complete Phase 2 (T003–T004).
3. Complete Phase 3 (T005–T012).
4. **STOP and VALIDATE**: Run `quickstart.md §2` (unit verification) and
   confirm `demo/atw-aurelia/dist/widget.js` is real after a build.
5. At this point, the spec's primary complaint
   ("`/atw.embed` doesn't produce anything useful") is resolved. The
   feature could ship here and deliver user-visible value.

### Incremental Delivery

1. MVP ships (US1). Demo works. Video-ready.
2. Add US2 (T013–T015): formalise the Aurelia acceptance path.
3. Add US3 (T016–T020): auditability in the manifest.
4. Add US4 (T021–T022): contributor-loop guarantee.
5. Polish (T023–T027).

### Sequencing rationale

Phases 1 → 2 → 3 are strict prerequisites. Phases 4, 5, 6 could technically
land in any order after Phase 3 complete, but the sequence above keeps
each PR focused on a single concern. A cautious reviewer can stop after
any phase and ship a validated increment.

---

## Notes

- All code edits are in `packages/scripts/`. `packages/widget/` is not
  touched — its source is treated as the fixed input the build
  consumes. This bounds the blast radius of the change.
- `demo/atw-aurelia/` is also not edited (except for T015, removing
  stale tracked stubs if any). The Aurelia demo proves the fix;
  modifying it would conflate test and system-under-test.
- FR-002's regression guard (no `"no-op bundle"` string) is enforced
  three times: T006 at the source, T025 at the compiled dist, and the
  CI suite via T026. Belt-and-braces — cheap and worth it.
- Commits should land one phase at a time. The Feature 003
  post-impl-notes document this cadence as the working rhythm for the
  repo.

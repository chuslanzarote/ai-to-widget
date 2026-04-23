# Implementation Plan: Full Reviewer Path

**Branch**: `005-full-reviewer-path` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-full-reviewer-path/spec.md`

## Summary

Today `/atw.build` reports `result: "success"` even when it produces a
project that cannot be deployed. Two concrete gaps cause this:

1. **Non-recursive template rendering.** `renderBackend()` at
   `packages/scripts/src/render-backend.ts:47` does a flat
   `fs.readdir()` against `packages/backend/src/` and filters for top-level
   `*.hbs`. The `src/lib/` and `src/routes/` subtrees — which carry the
   shared-lib wrappers and the route modules imported by the rendered
   `index.ts` — are never rendered into the Builder's project.
2. **Missing meta files + no fail-loud.** The Builder's project never
   receives `Dockerfile`, `package.json`, or `tsconfig.json`, because the
   renderer only writes `src/*`. When the orchestrator's IMAGE step
   (`orchestrator.ts:598-618`) invokes `buildBackendImage`, the error is
   caught and swallowed with `log("image build skipped: %s", …)`, so the
   manifest still reports `result: "success"` with `backend_image: null`.

The fix is a bounded three-change set inside `@atw/scripts`:

- Make `renderBackend()` walk the templates directory recursively (same
  sorting / determinism discipline as today), producing a rendered source
  tree that mirrors `packages/backend/src/**/*.hbs`.
- Add a `seedBackendMeta()` step that copies the committed meta files
  (`packages/backend/{Dockerfile,.dockerignore,package.json,tsconfig.json}`)
  into `<project>/backend/`, and a `vendorSharedLib()` step that copies
  the exact TypeScript sources the rendered backend imports from
  `@atw/scripts/dist/lib/*` out of `packages/scripts/src/lib/*.ts` into
  `<project>/backend/src/_shared/`, rewriting those imports to relative
  paths during render.
- Replace the `try/catch` around IMAGE with loud failure propagation, add
  an explicit `--skip-image` flag (visible in `--help`), and extend the
  build manifest with the new input hashes so re-runs short-circuit
  byte-identically. Concurrently, add a `build:` directive on the
  `atw_backend` service in the root `docker-compose.yml` so a reviewer
  who clones a committed demo can `docker compose up -d --wait` without
  first running `/atw.build`.

Scope stays inside the existing pipeline step order (RENDER → BUNDLE →
IMAGE → COMPOSE ACTIVATE → SCAN, `orchestrator.ts:547-652`). No new
ecosystems, no new datastores, no new orchestration layer.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 20 (existing `@atw/scripts`,
`@atw/backend` workspaces).
**Primary Dependencies**: Handlebars (template renderer, already in
`@atw/scripts`), dockerode + tar-fs (image build, already wired in
`build-backend-image.ts`), no new runtime dependencies. Fastify, pg,
@xenova/transformers, @anthropic-ai/sdk (already declared in
`packages/backend/package.json`).
**Storage**: N/A — the feature operates on files on disk (templates,
rendered backend source, meta files, build manifest) and on the local
container image registry.
**Testing**: Vitest (existing harness under `packages/scripts/test/`).
New contract tests for the `--skip-image` flag, recursive render, and
vendored-import rewriting; new integration test that runs the full
`/atw.build` against a fixture project with Docker available and asserts
the image is tagged; new determinism test that re-runs and checks 0
rewrites and image unchanged.
**Target Platform**: Node 20 CLI for `/atw.build`; final artifacts run
under Docker Compose (images: `pgvector/pgvector:pg16`,
`gcr.io/distroless/nodejs20-debian12` via the backend Dockerfile,
existing Medusa images), unchanged from Feature 003.
**Project Type**: Monorepo package change — modifies `@atw/scripts` and
extends how the existing `@atw/backend` template package is consumed.
Adds a committed demo-side backend directory under
`demo/atw-aurelia/backend/` so `docker compose up` from a fresh clone
has a valid build context.
**Performance Goals**: Second-run `/atw.build` on unchanged inputs
completes in < 10 s (SC-004) and rewrites zero files. First-run image
build stays within the existing Feature 002 envelope (~90 s cold,
dominated by the embedding model pre-warm in the Dockerfile).
**Constraints**:
- Preserve Feature 002's determinism contract byte-for-byte
  (principle VIII, FR-009, FR-010). Every vendored file and meta file
  must have stable content and stable ordering.
- Preserve existing CLI behavior: `/atw.build` help output only grows
  by one flag; no existing flag changes meaning.
- No new public APIs on `@atw/scripts` beyond what the CLI surface
  already exposes (library is `private: true`).
- Image build failures from real causes (daemon down, syntax error,
  secret in context) MUST exit non-zero — silent skip is forbidden
  outside the explicit `--skip-image` flag (FR-005, FR-013).
**Scale/Scope**: Three source files modified
(`packages/scripts/src/render-backend.ts`,
`packages/scripts/src/orchestrator.ts`,
`packages/scripts/src/write-manifest.ts`), two new source files
(`packages/scripts/src/seed-backend-meta.ts`,
`packages/scripts/src/vendor-shared-lib.ts`), one root YAML touched
(`docker-compose.yml`), one committed demo directory populated
(`demo/atw-aurelia/backend/`). Expected diff: ~300 lines of source +
~400 lines of tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against all ten principles. Red lines (I, V, VIII) MUST pass.

| # | Principle | Assessment |
|---|-----------|------------|
| I | User Data Sovereignty (red line) | **PASS.** No change to data paths. The backend still never touches a client database directly; the vendored shared-lib files (`runtime-config`, `runtime-pii-scrub`, `runtime-credential-strip`, `types`, `error-codes`) are the same modules already shipping in the runtime today, just copied into the project at render time instead of resolved via `node_modules`. Secret-in-context guard (`build-backend-image.ts:78-104`) stays and is now reachable on every Builder run. |
| V | Anchored Generation (red line) | **PASS.** No Opus calls added or changed. The feature is entirely deterministic scaffolding. |
| VIII | Reproducibility (red line) | **PASS — directly fixes.** Today `git clone && /atw.build && docker compose up` does NOT produce a working demo: the atw_backend image is absent and the manifest lies about success. This feature is the work that makes principle VIII hold. Every new output (rendered subtree file, vendored lib file, copied meta file, backend image) is either templated from `packages/backend/` + `packages/scripts/src/lib/` or produced deterministically from hashed inputs the manifest tracks. |
| IV | Human-in-the-Loop | **PASS.** No new automation; `/atw.build` still requires the Builder to run it. The new `--skip-image` flag is opt-in, visible in `--help`, and never the default. Meta-file overwrite is recorded (optionally backed up, reusing existing `--backup`). |
| X | Narrative-Aware Engineering | **PASS — directly enables the demo.** The reviewer demo is the jury-visible artifact; this feature is what takes it from "silently broken on first run" to "works from a clean clone." |
| II | Markdown as Source of Truth | **PASS.** Build manifest stays JSON (the existing shape from Feature 002); new state is written under `.atw/state/` as today. No hidden state added. |
| III | Idempotent and Interruptible | **PASS.** Every new write goes through the same action-tagged path (`created` / `unchanged` / `rewritten`) used by `renderBackend()` today, including backups. Re-running is the determinism contract (FR-009). |
| VI | Composable Deterministic Primitives | **PASS.** The three new pieces (recursive walk, meta seeding, lib vendoring) are pure deterministic functions. No Opus involvement anywhere on the image path. |
| VII | Single-Ecosystem Simplicity | **PASS.** TypeScript + Node + Handlebars + Docker. No new runtimes, no new languages, no new orchestration layer. |
| IX | Opus as a Tool, Not a Crutch | **PASS.** Zero Opus calls in this feature. |

**All gates pass. No violations. Complexity Tracking section is empty.**

## Project Structure

### Documentation (this feature)

```text
specs/005-full-reviewer-path/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — design decisions + rejected alternatives
├── data-model.md        # Phase 1 output — manifest extensions + rendered-project shape
├── quickstart.md        # Phase 1 output — reviewer walkthrough + builder walkthrough
├── contracts/           # Phase 1 output
│   ├── orchestrator-cli.md              # --skip-image flag, exit-code map
│   ├── render-backend-recursive.md      # subdir traversal + import rewriting
│   └── build-manifest-extensions.md     # backend_files[] shape, skipped step, failure entries
├── spec.md              # Already present (/speckit.specify output)
├── checklists/
│   └── requirements.md  # Already present (all green)
└── tasks.md             # NOT created here — /speckit.tasks output
```

### Source Code (repository root)

```text
packages/
├── scripts/                                       # MODIFIED
│   ├── src/
│   │   ├── render-backend.ts                     # recurse into subdirs; rewrite imports
│   │   ├── seed-backend-meta.ts                  # NEW — copy Dockerfile/package.json/tsconfig
│   │   ├── vendor-shared-lib.ts                  # NEW — copy @atw/scripts/src/lib/*.ts → backend/src/_shared/
│   │   ├── orchestrator.ts                       # add --skip-image, remove silent try/catch, wire new steps
│   │   ├── write-manifest.ts                     # extend with meta/shared-lib input hashes, "skipped" step state
│   │   └── build-backend-image.ts                # UNCHANGED (already has SECRET + DOCKER_* error codes)
│   └── test/
│       ├── render-backend.recursive.unit.test.ts # NEW
│       ├── render-backend.vendor.unit.test.ts    # NEW — import-rewriting
│       ├── seed-backend-meta.unit.test.ts        # NEW
│       ├── orchestrator.skip-image.contract.test.ts     # NEW
│       ├── orchestrator.loud-failure.contract.test.ts   # NEW
│       └── orchestrator.determinism.integration.test.ts # NEW — re-run byte-identical
├── backend/                                       # UNCHANGED source of truth
│   ├── Dockerfile                                # seeded into projects
│   ├── .dockerignore                             # seeded into projects
│   ├── package.json                              # seeded into projects
│   ├── tsconfig.json                             # seeded into projects
│   └── src/
│       ├── index.ts.hbs                          # already top-level
│       ├── config.ts.hbs                         # already top-level
│       ├── lib/*.ts.hbs                          # NOW rendered (previously skipped)
│       └── routes/*.ts.hbs                       # NOW rendered (previously skipped)

demo/
└── atw-aurelia/
    ├── backend/                                  # COMMITTED, fully populated post-build snapshot
    │   ├── Dockerfile
    │   ├── .dockerignore
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts (+ config.ts + routes/ + lib/ + _shared/)
    └── .atw/state/build-manifest.json            # reflects the committed snapshot

docker-compose.yml                                 # MODIFIED — add build: directive on atw_backend

tests/                                             # UNCHANGED — existing contract/integration tests
                                                   # must continue to pass (SC-007)
```

**Structure Decision**: Monorepo package change scoped to `@atw/scripts`
plus two YAML edits. `@atw/backend` remains the single source of truth
for templates and meta files; `@atw/scripts` gains the plumbing to copy
what the project needs into the project. The committed
`demo/atw-aurelia/backend/` is the concrete post-build snapshot that
makes the reviewer shortcut work (FR-011, FR-011a) and is regenerated
deterministically on every `/atw.build` re-run.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.

# Phase 0 Research — Full Reviewer Path

**Feature**: 005-full-reviewer-path
**Date**: 2026-04-23
**Status**: Complete — no unresolved NEEDS CLARIFICATION

The spec's three clarification-session answers already pinned the three
biggest design decisions. This document records the remaining sub-design
decisions discovered while reading the code, and the alternatives
considered and rejected for each.

---

## Decision 1 — Recursive template walk preserves flat-render determinism

**Decision.** Replace the flat `fs.readdir()` in
`packages/scripts/src/render-backend.ts:47` with a recursive walk that
(a) yields relative paths, (b) sorts by the relative path using
locale-agnostic byte order, and (c) mirrors the source tree under
`outputDir`. Each rendered file keeps the same per-file pipeline
(Handlebars compile → LF normalise → diff vs prior → action tag), just
emitted into nested directories.

**Rationale.** The existing flat walk already enforces sort order
(`entries.filter(...).sort()`). A recursive walk preserves this invariant
as long as (1) directory entries are sorted at every level and (2) paths
are joined with `/` separators in the rendered file's recorded `path`
field (already done at line 68 via `.replace(/\\/g, '/')`). This change
keeps the determinism contract (Feature 002 SC-016) byte-identical.

**Alternatives considered.**

- **Two-pass approach** (render top-level, then render each subdir in a
  separate call). Rejected — doubles the number of `mkdir` + diff paths
  the orchestrator must manage, and duplicates sort logic across call
  sites. The recursive walk is one bounded change in one file.
- **Handlebars partials with a single entrypoint template.** Rejected —
  would force every sub-module to become a partial, losing the clean
  one-file-per-module mapping to `src/lib/*.ts` and `src/routes/*.ts`.
  Also doesn't solve meta-file seeding, so partial migration is
  net-negative.
- **Glob-based collection** (`fast-glob` or `globby`). Rejected — adds a
  runtime dependency for something `fs.readdir({ recursive: true })` and
  a tiny sort helper already do. `@atw/scripts` stays dependency-light.

---

## Decision 2 — Vendor shared-lib as `.ts` source, rewrite imports during render

**Decision.** A new `vendorSharedLib()` function (in
`packages/scripts/src/vendor-shared-lib.ts`) resolves the set of files
under `packages/scripts/src/lib/` that the rendered backend imports via
`@atw/scripts/dist/lib/*`, copies their TypeScript source into
`<project>/backend/src/_shared/`, and records their sha256 hashes in the
manifest's `input_hashes` map. `renderBackend()` rewrites `.hbs`
import specifiers matching `@atw/scripts/dist/lib/(.+)\.js` to relative
paths into `./_shared/…` (or `../_shared/…` for files in subdirs) at
render time, before Handlebars compilation.

The initial import-set (from `grep @atw/scripts packages/backend/src`) is:

- `runtime-config.ts` — imported from `src/config.ts.hbs`
- `runtime-pii-scrub.ts` — imported from `src/lib/pii-scrub.ts.hbs`, `src/lib/retrieval.ts.hbs`
- `runtime-credential-strip.ts` — imported from `src/lib/credential-strip.ts.hbs`
- `types.ts` — imported from `src/lib/action-intent.ts.hbs`, `src/lib/opus-client.ts.hbs`, `src/routes/chat.ts.hbs`
- `error-codes.ts` — imported from `src/lib/errors.ts.hbs`

The set is discovered programmatically by scanning rendered outputs for
`@atw/scripts/dist/lib/*` specifiers — not hard-coded — so future
template edits propagate automatically.

**Rationale.** Vendoring TS sources (not `dist/*.js` bundles) means the
backend's Dockerfile can compile everything uniformly with its existing
`npx tsc` step. The alternative (shipping compiled JS) would force the
Dockerfile to skip type-checking for vendored code, and would bind the
image's layer hash to the `@atw/scripts/dist/` build timestamp — a
determinism regression.

The rewrite-during-render (rather than vendor first, fix-up imports in a
separate pass) keeps the template → file pipeline single-pass and avoids
a class of race bugs where someone edits a rendered file between
render and rewrite.

**Alternatives considered.**

- **Publish `@atw/scripts-runtime` as a public npm package.** Rejected
  per Q1 clarification — adds a release step to the workflow and couples
  Builder deployments to our npm publish cadence. The project stays
  self-contained.
- **Build context = monorepo root** (so `node_modules/@atw/scripts`
  resolves inside the Dockerfile). Rejected — leaks monorepo tooling,
  lockfile, other workspaces, and anything else in the repo into every
  Builder's image build context. Violates principle I (sovereignty) at
  the blast-radius level even if no secret leaks; also slows every image
  build by tarring the monorepo.
- **Inline the shared-lib source into each `.hbs` template.** Rejected —
  duplicates code across templates, makes future edits to
  `runtime-pii-scrub.ts` require touching every consuming template, and
  defeats the goal of having auditable shared primitives.

---

## Decision 3 — Meta files are seeded, not templated

**Decision.** `Dockerfile`, `.dockerignore`, `package.json`, and
`tsconfig.json` are copied byte-for-byte from `packages/backend/` into
the Builder's project. No Handlebars compilation. Each seeded file goes
through the same diff-vs-prior pipeline used by `renderBackend()` so
re-runs are idempotent and backup-on-rewrite works identically.

**Rationale.** These files contain no project-specific values today
(`package.json` has the backend workspace name and deps; the `.hbs`
templates handle anything that needs variable interpolation). Treating
them as pure-copy keeps the surface simple and eliminates a class of
"wait, is this file templated or not?" confusion for Builders reading
the output.

If the future introduces variance (for example, a per-project NPM
organisation in the `name` field), converting any of these to `.hbs`
templates is a one-file change — the seeding step just starts preferring
a `.hbs` file when it exists, same convention as
`packages/backend/src/*.hbs`.

**Alternatives considered.**

- **Render all four as `.hbs` templates today, even without interpolation.**
  Rejected as premature — every Handlebars pass is a source of
  determinism risk (line endings, whitespace). Pure copy is the simpler
  deterministic primitive.
- **Ship meta files inside the Dockerfile via `COPY` from a sibling
  directory.** Rejected — `build-backend-image.ts` sends a single tar
  stream rooted at `contextDir`, by design. Pulling from outside the
  context reintroduces the monorepo-as-build-context problem rejected in
  Decision 2.

---

## Decision 4 — Loud failure replaces silent try/catch at IMAGE step

**Decision.** Remove the `try/catch` at `orchestrator.ts:612-617`.
Errors from `buildBackendImage()` propagate; the orchestrator's existing
outer catch converts them to a `ManifestResult = "failed"` with a
`failure_entries[]` record naming the failing step and the error code
(`DOCKER_UNREACHABLE`, `DOCKER_BUILD`, `SECRET_IN_CONTEXT`,
`TEMPLATE_COMPILE`). stderr gets a one-line diagnostic
(`atw.build: IMAGE step failed — <cause>`). Exit code is non-zero
(`1` for `DOCKER_BUILD`, `3` for `DOCKER_UNREACHABLE`, `20` for
`SECRET_IN_CONTEXT`, matching `build-backend-image.ts`'s existing CLI
exit map).

**Rationale.** The error codes and messages already exist on the
underlying function. The current orchestrator simply throws that
information on the floor. Removing the catch is a three-line diff that
converts a silent regression into an actionable failure — the highest
value-per-line change in this feature.

**Alternatives considered.**

- **Keep the catch but log-at-error-level.** Rejected — contradicts
  FR-005 (manifest MUST record `failed` on real failures). Also leaves
  the image unbuilt while reporting green, which is the root cause this
  feature exists to fix.
- **Replace the catch with a classifier that picks which errors to
  swallow** (e.g., swallow "no Dockerfile found" specifically).
  Rejected — that's exactly the "silent skip on specific cases" footgun
  that got us here. With meta-file seeding (Decision 3), "no Dockerfile
  found" is no longer possible on a real Builder run, so the previous
  justification for a swallow is gone.

---

## Decision 5 — `--skip-image` is a CLI flag, not an env var or detection

**Decision.** Add `skipImage?: boolean` to `OrchestratorFlags`, parse
`--skip-image` in the CLI argv parser (visible in `--help`), and gate
the IMAGE step on `if (!flags.entitiesOnly && !flags.skipImage && !abortState.aborted)`.
When skipped, the manifest records the IMAGE step with
`{ action: "skipped", reason: "suppressed by --skip-image flag" }`. The
existing `entitiesOnly` and `noEnrich` flags stay unchanged.

**Rationale.** Q3 clarification locked this in. Contract tests pass the
flag explicitly; Builders never do. Pattern matches the existing
`--no-enrich` / `--entities-only` flags — same CLI parsing path, same
help-output rendering, same manifest-visibility.

**Alternatives considered.**

- **Environment variable (`ATW_SKIP_IMAGE=1`).** Rejected — too implicit;
  a test-runner with a leaky env could silently disable the image build
  in a Builder shell.
- **Auto-detect "no Docker available → skip."** Rejected — exactly the
  regression this feature exists to prevent (FR-005).
- **Separate test-only entrypoint.** Rejected — duplicates the 650-line
  orchestrator flow and drifts over time.

---

## Decision 6 — Compose build directive coexists with pre-built image tag

**Decision.** `docker-compose.yml` gains a `build:` block on the
`atw_backend` service pointing at `./demo/atw-aurelia/backend`. The
existing `image: atw_backend:latest` stays. Compose's resolution order:
if the image exists locally, it's used; otherwise compose builds from
the context and tags it as the declared image name. Builders who run
`/atw.build` first get a cache hit on compose-up; reviewers who just
`docker compose up -d --wait` get a one-time build of ~90s on first run.

**Rationale.** Q2 clarification locked this in. Single compose file
serves both audiences with no conditional logic. The committed
`demo/atw-aurelia/backend/` directory is always in the "post-build"
state, so the compose-build produces a byte-identical image to the one
`/atw.build` would produce from its inputs (SC-005).

**Alternatives considered.**

- **Separate `docker-compose.reviewer.yml` overlay.** Rejected —
  reviewer and Builder get different compose files, which means a
  reviewer bug won't reproduce for a Builder and vice versa. Same-file
  is the simpler invariant.
- **Pre-push `atw_backend:latest` to a registry.** Rejected — adds a
  release step and a registry dependency; violates "works from a clean
  clone with only Docker installed" (principle VIII).

---

## Decision 7 — Input-hash coverage expands to cover every file in the image build context

**Decision.** The manifest's existing `input_hashes` map (currently
tracks schema-map, action-manifest, build-plan, source-hashes) gains
entries for:

- every seeded meta file (Dockerfile, .dockerignore, package.json, tsconfig.json) — keyed by their path inside `<project>/backend/`
- every vendored shared-lib file — keyed by `<project>/backend/src/_shared/<name>.ts`
- every rendered backend source file (already hashed today per-file in the `backend_files[]` array) — additionally rolled up into a single `backend_source_tree` hash for fast change detection on re-runs

The image cache-validity check is: if any of these hashes change, the
IMAGE step rebuilds; otherwise it records `action: "unchanged"` and
reuses the prior image_id from the last manifest.

**Rationale.** FR-004, FR-008 (SC-008) make this explicit. The
information is trivially computable (every file is already read by the
renderer/seeder/vendorer; hashing the buffer on the way to disk adds
microseconds). Without the roll-up hash, the image-cache check would
need to diff N per-file hashes on every run, which is unnecessary work.

**Alternatives considered.**

- **Skip per-file hashes; trust the tar's sha256.** Rejected — the tar
  includes timestamps that dockerode/tar-fs can normalise but only if we
  explicitly set them; per-file content hashes are more robust against
  tarball-layout regressions.
- **Use Docker's native image cache with no manifest tracking.**
  Rejected — Docker's cache is opaque to the manifest, breaking
  "every file that affects the image has an input_hashes entry"
  (FR-004, SC-008).

---

## Summary of resolved unknowns

| Concern in Technical Context | Decision | Pointer |
|---|---|---|
| How to make rendering recursive without breaking determinism | Decision 1 | above |
| How to make shared runtime code available without publishing | Decision 2 | above |
| Whether meta files need templating | Decision 3 | above |
| How to make image failures visible | Decision 4 | above |
| How tests opt out of Docker | Decision 5 | above |
| How reviewers run compose without running /atw.build | Decision 6 | above |
| How the manifest covers every rebuild-triggering file | Decision 7 | above |

No NEEDS CLARIFICATION markers remain. Proceed to Phase 1.

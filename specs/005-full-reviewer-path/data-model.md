# Data Model — Full Reviewer Path

**Feature**: 005-full-reviewer-path
**Date**: 2026-04-23
**Status**: Phase 1 complete

This feature extends three existing entities and introduces no new
runtime data store. All state continues to live in files on disk
(templated/seeded under `<project>/backend/`) and in the JSON build
manifest at `<project>/.atw/state/build-manifest.json`.

---

## Entity 1 — Rendered Backend Project

The populated `<project>/backend/` directory after `/atw.build` runs.

### Shape (post-build)

```text
<project>/backend/
├── Dockerfile                              # seeded byte-copy
├── .dockerignore                           # seeded byte-copy
├── package.json                            # seeded byte-copy
├── tsconfig.json                           # seeded byte-copy
└── src/
    ├── index.ts                            # rendered from index.ts.hbs
    ├── config.ts                           # rendered from config.ts.hbs
    ├── enrich-prompt.ts                    # rendered
    ├── enrich-prompt-sharpen.ts            # rendered
    ├── prompts.ts                          # rendered
    ├── retrieval.ts                        # rendered
    ├── tools.ts                            # rendered
    ├── lib/
    │   ├── action-intent.ts                # rendered — imports rewritten to ../_shared/types.js
    │   ├── cors.ts                         # rendered
    │   ├── credential-strip.ts             # rendered — imports rewritten to ../_shared/runtime-credential-strip.js
    │   ├── embedding.ts                    # rendered
    │   ├── errors.ts                       # rendered — imports rewritten to ../_shared/error-codes.js
    │   ├── logger.ts                       # rendered
    │   ├── opus-client.ts                  # rendered — imports rewritten
    │   ├── pii-scrub.ts                    # rendered — imports rewritten to ../_shared/runtime-pii-scrub.js
    │   ├── rate-limit.ts                   # rendered
    │   ├── retrieval-context.ts            # rendered
    │   ├── retrieval.ts                    # rendered — imports rewritten
    │   └── tool-execution.ts               # rendered
    ├── routes/
    │   ├── chat.ts                         # rendered — imports rewritten
    │   └── health.ts                       # rendered
    └── _shared/                            # NEW — vendored from @atw/scripts
        ├── runtime-config.ts
        ├── runtime-pii-scrub.ts
        ├── runtime-credential-strip.ts
        ├── types.ts
        └── error-codes.ts
```

### Invariants

- **Closure invariant.** Every `import` specifier in every `.ts` file
  under `backend/src/` either (a) resolves to another file under
  `backend/src/` or `backend/src/_shared/`, or (b) resolves to a package
  listed in `backend/package.json` `dependencies` / `devDependencies`.
  No dangling `@atw/*` imports; no bare imports of monorepo siblings.
- **Determinism invariant.** Re-running `/atw.build` with unchanged
  inputs produces byte-identical files (same sha256 for every path).
  LF line endings throughout. No timestamps in file bodies.
- **No-secret invariant.** Enforced by `assertNoSecretsInContext()` in
  `build-backend-image.ts:78`: no `.env*`, `*.pem`, `*.key`, `*.p12`,
  `*.pfx`, `id_rsa`, `id_ed25519` anywhere under `backend/` at the time
  of image build.

### Relationships

- **Produced by**: `renderBackend()` + `seedBackendMeta()` +
  `vendorSharedLib()` orchestrated by the RENDER step in `runBuild()`.
- **Consumed by**: `buildBackendImage()` via tar-pack of the `backend/`
  directory.
- **Sourced from**: `packages/backend/**/*.hbs` (templates),
  `packages/backend/{Dockerfile,.dockerignore,package.json,tsconfig.json}`
  (meta), `packages/scripts/src/lib/*.ts` (shared-lib subset).

---

## Entity 2 — Build Manifest (extensions)

Existing JSON blob at `<project>/.atw/state/build-manifest.json`. New
fields are additive; existing fields and shapes unchanged.

### Existing top-level fields (unchanged)

```json
{
  "result": "success" | "failed" | "aborted",
  "started_at": "<iso>",
  "completed_at": "<iso>",
  "input_hashes": { "<path>": "<sha256>", ... },
  "failure_entries": [ ... ],
  "entities": [ ... ],
  "compliance_scan": { ... },
  "widget_bundle": { ... },
  "backend_files": [ { "path", "sha256", "bytes", "action" }, ... ],
  "backend_image": { "ref", "image_id", "size_bytes" } | null
}
```

### New / extended fields

```json
{
  "input_hashes": {
    // ...existing entries...
    "backend/Dockerfile": "<sha256>",
    "backend/.dockerignore": "<sha256>",
    "backend/package.json": "<sha256>",
    "backend/tsconfig.json": "<sha256>",
    "backend/src/_shared/runtime-config.ts": "<sha256>",
    "backend/src/_shared/runtime-pii-scrub.ts": "<sha256>",
    "backend/src/_shared/runtime-credential-strip.ts": "<sha256>",
    "backend/src/_shared/types.ts": "<sha256>",
    "backend/src/_shared/error-codes.ts": "<sha256>",
    "backend_source_tree": "<rolled-up sha256>"
  },
  "steps": {
    // NEW — per-step status for idempotency reporting (FR-009)
    "render":   { "action": "created" | "rewritten" | "unchanged", "files_changed": <int> },
    "bundle":   { "action": "created" | "rewritten" | "unchanged" },
    "image":    {
      "action": "created" | "rebuilt" | "unchanged" | "skipped" | "failed",
      "reason": "<string>"  // present on "skipped" and "failed"
    },
    "compose":  { "action": "activated" | "unchanged" | "skipped" },
    "scan":     { "action": "ran" | "skipped", "clean": <bool> }
  },
  "failure_entries": [
    // Extended failure reason taxonomy (FR-005, FR-006):
    {
      "step": "image",
      "code": "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "TEMPLATE_COMPILE",
      "message": "<single-line diagnostic>"
    }
  ]
}
```

### Validation rules

- `result: "success"` MUST NOT appear alongside a `failure_entries[]`
  containing a `step: "image"` entry.
- `result: "success"` REQUIRES either `backend_image != null` OR
  `steps.image.action == "skipped"` with a recorded reason.
- `steps.image.action == "skipped"` REQUIRES the `--skip-image` CLI flag
  was passed (the orchestrator writes the reason string literally so
  this is testable).
- `input_hashes["backend_source_tree"]` MUST equal
  `sha256(join('\n', sorted(input_hashes[path] for path starting with 'backend/')))`
  so a single-string diff answers "did any image input change?".

### State transitions (image step only)

```
             ┌─ flags.skipImage ──────────────────────────────┐
             │                                                 │
 RENDER ok ─┤                                                 ├─► image.action = "skipped"
             │                                                 │
             └─ buildBackendImage()                            │
                ├─ docker.ping() fails ─► image.action = "failed", code = "DOCKER_UNREACHABLE"
                ├─ secret in context  ─► image.action = "failed", code = "SECRET_IN_CONTEXT"
                ├─ build returns err  ─► image.action = "failed", code = "DOCKER_BUILD"
                ├─ image_id matches prior manifest's image_id
                │                     ─► image.action = "unchanged"
                └─ new image tagged   ─► image.action = "created" (first run) | "rebuilt" (subsequent)
```

---

## Entity 3 — Canonical Demo (committed artefact)

The `demo/atw-aurelia/` directory, post-build state committed to git.

### Contents (post-build)

- `backend/` — the full rendered project per Entity 1. Always kept in
  sync with what `/atw.build` produces on the demo's inputs.
- `dist/widget.js`, `dist/widget.css` — real bundles, unchanged from
  Feature 004.
- `.atw/state/build-manifest.json` — the last-successful-build's
  manifest. `result: "success"`, `backend_image.ref: "atw_backend:latest"`.
- `.atw/state/input-hashes.json` — the input-hash snapshot used for
  determinism-check short-circuiting on re-run.
- `.atw/artifacts/*` — the committed upstream artefacts
  (schema-map, action-manifest, build-plan, embed-guide) unchanged.

### Invariant

The committed state of `demo/atw-aurelia/` MUST be a fixed point of
`/atw.build`: re-running the pipeline against the committed inputs
produces zero file changes (action = "unchanged" for every rendered,
seeded, and vendored output). This is how SC-005 and SC-006 are verified.

### Relationship to `docker-compose.yml`

The root compose file's `atw_backend.build.context` points at
`./demo/atw-aurelia/backend`. So `docker compose up -d --wait` on a
fresh clone, without running `/atw.build`, builds the image directly
from committed files. A Builder who ran `/atw.build` first finds
`atw_backend:latest` already tagged locally and compose-up is a cache
hit on the build layer.

---

## Entity 4 — Orchestrator Flags (extension)

```ts
// packages/scripts/src/orchestrator.ts
export interface OrchestratorFlags {
  projectRoot: string;
  force?: boolean;
  dryRun?: boolean;
  concurrency?: number;
  postgresPort?: number;
  entitiesOnly?: boolean;
  noEnrich?: boolean;
  backup?: boolean;
  yes?: boolean;
  help?: boolean;
  version?: boolean;
  skipImage?: boolean;        // NEW — Q3 clarification, FR-013
  opusClient?: OpusClient;
}
```

### CLI parsing

- Long form: `--skip-image` (boolean, no argument)
- No short form (avoid clash with any future `-s` semantic)
- Help output line: `--skip-image            suppress IMAGE step; manifest records step as "skipped"`
- Default: absent → `skipImage === undefined` → IMAGE step runs and
  failures are loud (FR-005).

### Mutual-exclusion rules

- `--skip-image` + `--entities-only`: compatible (entities-only already
  skips RENDER, BUNDLE, IMAGE, COMPOSE, SCAN).
- `--skip-image` + `--no-enrich`: compatible.
- `--skip-image` + `--dry-run`: compatible (dry-run already returns
  early before any step runs).

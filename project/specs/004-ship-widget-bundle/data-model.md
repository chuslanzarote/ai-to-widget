# Data Model — Feature 004 (Ship Widget Bundle)

This feature touches one structured artifact (the build manifest) and
preserves the on-disk shape of the bundle files themselves. No database
schema, no runtime data model changes. All state is file-backed per
Principle II.

## E1 — Widget Bundle (on disk)

Unchanged from Feature 002 / Feature 003. Named here for completeness.

| Field | Type | Notes |
|-------|------|-------|
| `path` | filesystem path | Always `dist/widget.js` or `dist/widget.css` under the Builder's project root. |
| `bytes` | integer | Raw file size. |
| `sha256` | hex string | Computed by `describe()` in `compile-widget.ts`. |

**Invariants** (preserved by this feature):

- Two builds on the same source tree produce identical `sha256` for both
  files. (FR-005 / Feature 002 SC-016.)
- `widget.js.gz` ≤ 80 KB, `widget.css.gz` ≤ 10 KB. (FR-004 / Feature 003
  SC-009; enforced by `enforceBundleBudget()` in `compile-widget.ts`.)
- `widget.js` MUST NOT contain the substring `no-op bundle`. (FR-002;
  enforced by removing the stub code path per R5.)

## E2 — Widget Source Origin (new logical entity)

Identifies the exact `@atw/widget` source that was compiled into a
bundle. Not a persisted entity on its own — stored inline as a field of
the build manifest (E3).

| Field | Type | Source |
|-------|------|--------|
| `package_version` | semver string | `version` field of the resolved `@atw/widget/package.json`. |
| `tree_hash` | `sha256:<hex>` | sha256 of a sorted `(relative_path\tcontent_sha256)` list over every file under `@atw/widget/src/`, computed via the existing `hashInputs` helper. |

**Invariants**:

- Deterministic: same source tree → same `tree_hash`.
- Different source tree → different `tree_hash`, even if `package_version`
  is unchanged (catches contributor-local edits).
- `package_version` alone is NOT authoritative; `tree_hash` is the
  reproducibility-grade identifier.

## E3 — Build Manifest (extended)

Existing file at `.atw/state/build-manifest.json`. Current shape (from
Feature 002) includes `build_id`, `result`, `totals`, `opus.*`,
`input_hashes.*`, `outputs.backend_files[]`. This feature adds one
top-level section.

### New section: `widget`

```json
{
  "widget": {
    "result": "success" | "skipped_unchanged",
    "bundle": {
      "js": {
        "path": "dist/widget.js",
        "bytes": 47218,
        "gzip_bytes": 17094,
        "sha256": "sha256:<hex>"
      },
      "css": {
        "path": "dist/widget.css",
        "bytes": 9844,
        "gzip_bytes": 2811,
        "sha256": "sha256:<hex>"
      }
    },
    "source": {
      "package_version": "0.1.0",
      "tree_hash": "sha256:<hex>"
    }
  }
}
```

### Field semantics

| Field | Required | Notes |
|-------|----------|-------|
| `widget.result` | yes | `"success"` when a fresh compile ran; `"skipped_unchanged"` when the bundle was already up-to-date (idempotent rerun — Principle III). Never `"failure"`: on failure the manifest is not written (FR-007 / R4). |
| `widget.bundle.js.*` | yes | Values computed post-compile by `describe()` for the JS file. |
| `widget.bundle.js.gzip_bytes` | yes | NEW. Reported for budget-audit transparency (FR-004 / SC-004). Computed by `enforceBundleBudget()` — today a debug log only. |
| `widget.bundle.css.*` | yes | Same for CSS. |
| `widget.source.package_version` | yes | Extracted from `@atw/widget/package.json` at compile time. |
| `widget.source.tree_hash` | yes | Deterministic hash per E2. |

### Validation rules

- If `widget.bundle.js.path` does not exist on disk OR its sha256
  doesn't match, the manifest is invalid — `/atw.build` refuses to emit
  it.
- If `widget.source.tree_hash` changes between two runs but
  `widget.bundle.js.sha256` does not, that is a bug in determinism — a
  test must catch it (FR-005).
- Existing Feature 002 manifest fields are preserved verbatim. No
  renames, no field removals. Additive only.

### Migration

Manifests produced before Feature 004 lack the `widget` section.
Downstream consumers (none today consume `widget` specifically) treat
the field as optional. The `schema_version` field stays at `"1"` —
this is an additive change, not a breaking one.

## E4 — Relationship diagram

```text
┌──────────────────────────┐
│  @atw/widget/src/        │  (Feature 003 source — unchanged)
│  ├── index.ts            │
│  ├── panel.tsx           │
│  └── ...                 │
└────────────┬─────────────┘
             │ resolved via require.resolve("@atw/widget/package.json")
             ▼
┌──────────────────────────┐
│  compileWidget()         │  (R1 — @atw/scripts/src/compile-widget.ts)
│    esbuild.build()       │
└────────────┬─────────────┘
             │ emits
             ▼
┌──────────────────────────┐         ┌──────────────────────────────┐
│  dist/widget.js          │────────▶│  build-manifest.json         │
│  dist/widget.css         │ recorded│    widget.bundle.{js,css}    │
│  (E1)                    │   in    │    widget.source.{version,   │
│                          │         │                  tree_hash}  │
│                          │         │  (E3)                        │
└──────────────────────────┘         └──────────────────────────────┘
                                                  ▲
                                                  │ consumed by
                                      ┌───────────┴───────────┐
                                      │  /atw.embed           │
                                      │  integration guide    │
                                      │  references dist/     │
                                      │  widget.{js,css}      │
                                      └───────────────────────┘
```

# Contract — Build Manifest `widget` section

Extends `.atw/state/build-manifest.json` with a new top-level `widget`
section. Additive to the Feature 002 manifest shape; all existing
fields remain verbatim.

## Schema

```json
{
  "widget": {
    "result": "success",
    "bundle": {
      "js":  { "path": "dist/widget.js",  "bytes": 47218, "gzip_bytes": 17094, "sha256": "sha256:..." },
      "css": { "path": "dist/widget.css", "bytes":  9844, "gzip_bytes":  2811, "sha256": "sha256:..." }
    },
    "source": {
      "package_version": "0.1.0",
      "tree_hash": "sha256:..."
    }
  }
}
```

## Field-by-field

### `widget.result`

- Type: string enum.
- Values: `"success"` | `"skipped_unchanged"`.
- `"failure"` is intentionally absent: per FR-007 and research.md §R4,
  a failed widget compile does not produce a success manifest.
- `"skipped_unchanged"` is emitted when `/atw.build` detects unchanged
  inputs (source tree hash + bundle budget) and reuses the prior
  bundle — preserves Feature 002 idempotence semantics.

### `widget.bundle.js` / `widget.bundle.css`

- `path`: relative to the Builder's project root (not absolute). Matches
  the existing convention for `outputs.backend_files[].path`.
- `bytes`: raw (uncompressed) file size, integer.
- `gzip_bytes`: gzip-compressed size, integer. New field — previously
  computed only as a debug log. Promoting it to the manifest makes the
  budget trail auditable (SC-004).
- `sha256`: `sha256:` prefix + lowercase hex digest. Matches the
  existing `input_hashes.*` prefix convention from Feature 002.

### `widget.source.package_version`

- Type: semver string.
- Value: the `version` field of the resolved `@atw/widget/package.json`.
- Not hashed, not prefixed.

### `widget.source.tree_hash`

- Type: `sha256:<lowercase-hex>`.
- Value: sha256 over a sorted list of
  `<relative_path>\t<file_sha256>` lines for every file under
  `@atw/widget/src/`, computed by the existing `hashInputs` helper in
  `@atw/scripts`.
- Determinism: sorting ensures OS-independent ordering. Line separator
  is `\n` (LF), matching the existing helper.

## Invariants

- **INV-1 (determinism)**: Two runs with the same `widget.source.tree_hash`
  MUST produce the same `widget.bundle.js.sha256` and
  `widget.bundle.css.sha256`. Violation = determinism bug.
- **INV-2 (traceability)**: Given only the manifest, a reviewer can
  check out `@atw/widget` at `source.package_version`, compare the
  checked-out tree to `source.tree_hash`, and be sure the source on
  disk is exactly the source that was compiled.
- **INV-3 (budget)**: `widget.bundle.js.gzip_bytes` ≤ 81920 AND
  `widget.bundle.css.gzip_bytes` ≤ 10240. A manifest violating this
  MUST NOT be written (compile-widget fails first, per its own
  contract).
- **INV-4 (no stub)**: `widget.bundle.js.sha256` MUST NOT match the
  sha256 of the Feature 003 stub string. A golden-value regression
  guard in the test suite asserts this.

## Migration

- `schema_version` stays `"1"`. Additive field additions do not bump it.
- Pre-Feature-004 manifests lack the `widget` section entirely. No
  downstream consumer reads it today; no migration script needed.
- If a future feature requires the `widget` section on every manifest
  (e.g., for `/atw.analyze`), that feature owns the migration. This
  contract only adds the section when `/atw.build` runs the widget
  step, which happens on every successful build.

## Test obligations

The test suite MUST include:

1. A unit test that builds the manifest object and asserts the shape
   above (every required field present and typed).
2. A determinism test that runs `/atw.build` twice on the same input
   and asserts the two `widget` sections are deep-equal.
3. A regression test that asserts `widget.bundle.js.sha256` never
   equals the sha256 of `"/* atw widget: no-op bundle (Feature 003
   populates later) */\n"`.

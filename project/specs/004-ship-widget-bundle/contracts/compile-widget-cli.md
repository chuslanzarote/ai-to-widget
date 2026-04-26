# Contract — `atw-compile-widget` CLI (amended)

Supersedes the Feature 002 contract for this command's entry-resolution
behaviour. All other behaviour (esbuild flags, determinism, budget
enforcement, exit codes already in use) is unchanged.

## Invocation

```bash
atw-compile-widget [--out-dir <path>] [--minify|--no-minify] [--json]
```

## Amended flags

- **Removed**: `--widget-src-dir <path>`.
  Rationale: the widget source is resolved via Node module resolution
  against `@atw/widget` (see spec FR-001, FR-011 and research.md §R1).
  A CLI override would reintroduce the cwd-relative ambiguity this
  feature exists to eliminate.
- **Unchanged**: `--out-dir` (defaults to `<cwd>/dist`), `--minify`,
  `--no-minify`, `--json`, `--help`, `--version`.

## Entry resolution algorithm

```
1. Use createRequire(import.meta.url) to get a require function scoped to
   @atw/scripts's location.
2. Call require.resolve("@atw/widget/package.json").
   - On success → widgetPkgPath = the resolved path.
   - On failure → emit WIDGET_SOURCE_MISSING (see exit codes).
3. widgetRoot = path.dirname(widgetPkgPath).
4. entry = path.join(widgetRoot, "src", "index.ts").
5. Verify entry exists on disk. If not → WIDGET_SOURCE_MISSING.
6. Read @atw/widget/package.json and extract `version` →
   source.package_version.
7. Compute source.tree_hash = hashInputs(@atw/widget/src/**/*) per the
   existing helper in @atw/scripts.
8. Pass `entry` to esbuild.build() using the same options as today
   (bundle, iife, es2020, no sourcemap, no metafile, empty define,
   static banner, legalComments: none).
9. Call enforceBundleBudget() on the result (unchanged).
10. Emit the JSON result (if --json) with the extended shape below.
```

No step references `process.cwd()` for source location. Steps 1 and 2
are the only search path.

## Amended JSON output (when `--json` is set)

```json
{
  "js": { "path": "...", "bytes": 47218, "sha256": "..." },
  "css": { "path": "...", "bytes": 9844, "sha256": "..." },
  "source": {
    "package_version": "0.1.0",
    "tree_hash": "sha256:<hex>"
  }
}
```

- Field `noop: boolean` is **removed** (there is no stub path anymore,
  so a noop result is structurally impossible — see research.md §R5).
- Fields `source.package_version` and `source.tree_hash` are **added**
  and required.

## Exit codes

| Code | Condition | Message (to stderr) |
|------|-----------|---------------------|
| 0 | Success — bundle written and within budget. | — |
| 1 | Generic failure not covered by a specific code. | `atw-compile-widget: <message>` |
| 3 | `WIDGET_SOURCE_MISSING` — `@atw/widget` cannot be resolved or its `src/index.ts` is absent. | `atw-compile-widget: cannot resolve @atw/widget — ensure it is listed as a dependency of your project and install it with npm/pnpm/yarn.` |
| 17 | `BUNDLE_BUDGET_EXCEEDED` — gzip js > 80 KB or gzip css > 10 KB. | `atw-compile-widget: bundle budget exceeded (FR-027/SC-009): <details>` (unchanged from Feature 003) |
| 18 | `ESBUILD` — esbuild failed to compile. | `atw-compile-widget: esbuild failed: <message>` (unchanged) |

Exit code 3 is new for this command but matches the existing
"missing prerequisite" convention used by `/atw.embed`.

## Determinism contract

Two consecutive invocations with the same `@atw/widget` source tree MUST
produce byte-identical `widget.js` and `widget.css`. This inherits
directly from Feature 002 SC-016 and Feature 003's existing
`compile-widget.ts` configuration. Verified by a round-trip test
in `packages/scripts/test/compile-widget.unit.test.ts`.

## Regression guard

The test suite MUST include an assertion that the string
`"no-op bundle"` does not appear in the emitted `widget.js` under any
green build path. This is the bright-line regression guard for FR-002.

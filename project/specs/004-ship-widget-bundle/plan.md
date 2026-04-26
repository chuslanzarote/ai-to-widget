# Implementation Plan: Ship the Real Widget Bundle to Builders

**Branch**: `004-ship-widget-bundle` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/004-ship-widget-bundle/spec.md`

## Summary

The `/atw.build` pipeline currently hard-codes the widget source location at
`<builder-cwd>/widget/src` (orchestrator.ts:578 and compile-widget.ts:194).
No Builder host project has that directory, so `findEntry()` returns null and
`compileWidget()` writes the stub `/* atw widget: no-op bundle (Feature 003
populates later) */` to `dist/widget.js`. The real widget source already
exists, fully implemented, as the `@atw/widget` workspace package at
`packages/widget/src/` (Preact + Signals, <80 KB gzip, all of Feature 003's
widget delivery).

The fix is small and single-locus: resolve the widget entry point through the
Node module resolver against `@atw/widget` rather than against the Builder's
cwd. In the monorepo this resolves via npm workspaces to
`packages/widget/src/index.ts` (contributor edits visible for free, FR-010).
External Builders who install `@atw/widget` as a dependency resolve to
`node_modules/@atw/widget/src/index.ts` (FR-011). The esbuild configuration
in `compileWidget()` is already correct and deterministic — only the source
resolution changes. The build manifest grows a `widget` section recording
source origin (package version + source tree hash) alongside the bundle
sha256, satisfying FR-006 and the reproducibility invariant.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 20 (existing `@atw/scripts`,
`@atw/widget` workspaces).
**Primary Dependencies**: esbuild (already in `@atw/scripts` devDependencies,
used by `compileWidget()` today); Node ESM `import.meta.resolve` for entry
resolution. No new runtime dependencies.
**Storage**: N/A. Artifacts are files on disk (`dist/widget.js`,
`dist/widget.css`, `.atw/state/build-manifest.json`).
**Testing**: Vitest (existing harness under `packages/scripts/test/`); one
new contract test for compile-widget entry resolution, one new integration
test that runs the full /atw.build against a fixture Builder project and
asserts the bundle is real, plus regressions to the existing Feature 003
e2e tests (aurelia-demo Playwright).
**Target Platform**: Node 20 CLI for the build step; widget runs in modern
evergreen browsers (ES2020), unchanged from Feature 003.
**Project Type**: Monorepo package change — modifies the existing
`@atw/scripts` package and adjusts how it depends on `@atw/widget`. No new
packages or services.
**Performance Goals**: Widget bundle must compile within the existing
`/atw.build` budget (sub-second esbuild run for a widget this size).
Preserve gzip budgets (js ≤ 80 KB, css ≤ 10 KB — FR-004 / Feature 003
SC-009) and determinism (FR-005 / Feature 002 SC-016).
**Constraints**: No change to the Builder-facing command surface. No new
authoring steps. No change to `@atw/widget`'s public entry — just its
consumption path.
**Scale/Scope**: Two source files modified
(`packages/scripts/src/compile-widget.ts`,
`packages/scripts/src/orchestrator.ts`), one extended
(`packages/scripts/src/write-manifest.ts` gains a `widget` section), plus
tests. Expected diff: ~100 lines of source + ~150 lines of tests.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against all ten principles. Red lines (I, V, VIII) MUST pass.

| # | Principle | Assessment |
|---|-----------|------------|
| I | User Data Sovereignty (red line) | **PASS.** The change only concerns how static widget JS/CSS reaches the Builder. No database connection strings, no end-user credentials touched. |
| V | Anchored Generation (red line) | **PASS.** No Opus calls added or changed. The widget's existing anchored-generation guarantees (enforced by the backend, Feature 003) are untouched. |
| VIII | Reproducibility (red line) | **PASS — directly improves.** Today's pipeline is reproducible in that it deterministically emits the same stub; after this feature it deterministically emits the real bundle. The manifest extension (FR-006) strengthens auditability: a reviewer can trace any bundle back to a pinned `@atw/widget` version + source tree hash. |
| IV | Human-in-the-Loop | **PASS.** No new automation; Builder still explicitly runs `/atw.build` and `/atw.embed`. No silent decisions. |
| X | Narrative-Aware Engineering | **PASS — directly enables the demo.** The hackathon video depends on a working widget in the Aurelia demo. Today that demo is broken; this feature is the fix. |
| II | Markdown as Source of Truth | **PASS.** Build manifest is JSON (existing Feature 002 shape), not markdown; this feature preserves that existing decision without adding new hidden state. |
| III | Idempotent and Interruptible | **PASS.** `compileWidget()` already uses `writeIfChanged()` and unchanged inputs → byte-identical output. Rerun semantics unchanged. |
| VI | Composable Deterministic Primitives | **PASS.** Agentic/deterministic split unchanged. Widget compile is pure deterministic primitive. No Opus involvement. |
| VII | Single-Ecosystem Simplicity | **PASS.** TypeScript + Node + esbuild. No new runtimes, no new languages. |
| IX | Opus as a Tool, Not a Crutch | **PASS.** Zero Opus calls in this feature. |

**All gates pass. No violations. Complexity Tracking section is empty.**

## Project Structure

### Documentation (this feature)

```text
specs/004-ship-widget-bundle/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output — resolution strategy, edge cases
├── data-model.md        # Phase 1 output — manifest widget section shape
├── quickstart.md        # Phase 1 output — how to verify the fix locally
├── contracts/           # Phase 1 output — compile-widget CLI + manifest
│   ├── compile-widget-cli.md
│   └── build-manifest-widget-section.md
├── spec.md              # Already present (/speckit.specify output)
├── checklists/
│   └── requirements.md  # Already present
└── tasks.md             # NOT created here — /speckit.tasks output
```

### Source Code (repository root)

```text
packages/
├── scripts/                          # MODIFIED
│   ├── src/
│   │   ├── compile-widget.ts         # Entry resolution switches to @atw/widget
│   │   ├── orchestrator.ts           # Drops hard-coded widgetSrcDir path
│   │   └── write-manifest.ts         # Extends manifest with widget section
│   ├── test/
│   │   ├── compile-widget.unit.test.ts      # EXTEND: resolve-from-@atw/widget cases
│   │   └── compile-widget.integration.test.ts  # NEW: full pipeline against fixture host
│   └── package.json                  # Add @atw/widget to dependencies
└── widget/                            # UNCHANGED
    └── src/                           # Feature 003 source, consumed by @atw/scripts

demo/
└── atw-aurelia/                       # VERIFIED (no source change)
    └── dist/                          # After fix: real widget.js / widget.css

specs/003-runtime/                     # Existing regression tests (Playwright)
                                       # must continue to pass against the fix.
```

**Structure Decision**: Monorepo package change. `@atw/scripts` gains a
dependency on `@atw/widget` (already a workspace sibling). `compileWidget()`
resolves its entry point via Node module resolution rather than a
cwd-relative path. No new packages, no new directories, no restructuring.
This keeps the change surgical and reversible.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations. Section intentionally empty.

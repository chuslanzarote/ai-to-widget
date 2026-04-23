# Research — Feature 004 (Ship Widget Bundle)

## R1 — Where should the widget entry point be resolved?

**Decision.** Resolve the widget entry via Node module resolution against
the `@atw/widget` package name. Concretely, from within `@atw/scripts`:

```ts
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const widgetPkg = require.resolve("@atw/widget/package.json");
const widgetRoot = path.dirname(widgetPkg);
const entry = path.join(widgetRoot, "src", "index.ts");
```

No `widgetSrcDir` CLI flag, no `process.cwd()`-relative fallback, no
`{projectRoot}/widget/src/` lookup. The Node resolver is the single source
of truth.

**Rationale.**

- Works identically in the monorepo (npm workspaces symlink
  `node_modules/@atw/widget → packages/widget/`) and for external Builders
  who install `@atw/widget` from a published registry. One code path,
  FR-010 and FR-011 both satisfied.
- FR-011 forbids "any path on their local disk" — resolution through the
  installed dependency satisfies that literally: the resolver returns
  whatever the Builder's `node_modules` tree says, not a cwd scan.
- Contributor edits in `packages/widget/src/` are picked up automatically
  because workspaces symlink, not copy (FR-010).
- Eliminates the "Builder coincidentally has a `widget/src/index.ts`" edge
  case raised in the spec. The resolver ignores the Builder's cwd, so
  collisions are impossible.

**Alternatives considered.**

- **Pre-build the widget at publish time and ship a prebuilt bundle
  inside `@atw/widget/dist/widget.js`.** Rejected for the hackathon
  timeframe: it adds a publish step that contributors must run before
  every demo, breaking the zero-manual-step promise of FR-009 /
  Assumption "ATW contributors iterate in-tree". The esbuild run is
  <1s on a widget this size — the cost is negligible compared to the
  velocity cost of a republish loop.
- **Keep a per-project `widget/src/` override as an escape hatch.**
  Rejected because FR-011 explicitly forbids local-disk sources for
  Builders, and no concrete use case for an override surfaced. Power
  users who really want to swap in a custom widget can depend on a
  fork of `@atw/widget` — that is a cleaner extension point than a
  silent cwd lookup.
- **Hard-code a workspace-relative path
  (`../../packages/widget/src/index.ts`).** Rejected: works only inside
  this monorepo, fails for every external Builder. Doesn't satisfy
  FR-001.

## R2 — How should `@atw/scripts` depend on `@atw/widget`?

**Decision.** Add `@atw/widget` to `@atw/scripts`'s runtime `dependencies`
(not `devDependencies`, not `peerDependencies`).

**Rationale.**

- `dependencies`: any project that installs `@atw/scripts` transitively
  pulls `@atw/widget`. The Builder doesn't need to know about the widget
  package or add it to their own `package.json`. Aligns with FR-009
  (zero manual steps).
- `devDependencies`: wrong — `@atw/widget` is needed at the Builder's
  `/atw.build` runtime, not at `@atw/scripts`'s own development time.
- `peerDependencies`: wrong — would require Builders to add `@atw/widget`
  to their own dependency list. Violates FR-009.

**Alternatives considered.**

- **Inline the widget source inside `@atw/scripts`.** Rejected: couples
  build tooling to UI code and breaks the Feature 003 contributor
  workflow (contributors would have to edit inside `@atw/scripts`, not
  `packages/widget/`).

## R3 — What origin identifier satisfies FR-006 auditability?

**Decision.** Record two fields in the manifest's new `widget` section:

- `source.package_version`: the `version` field from the resolved
  `@atw/widget/package.json`.
- `source.tree_hash`: sha256 of a deterministic listing of every file
  under `@atw/widget/src/` (path + content), computed by the same
  `hashInputs` helper used elsewhere in `@atw/scripts` for input hashes.

**Rationale.**

- `package_version` alone is insufficient during development: two
  contributors editing the same version produce different bundles.
  `tree_hash` captures that. Together they answer "which release was
  this?" and "exactly which source?" respectively.
- Matches the existing manifest pattern (Feature 002 already records
  `input_hashes` for other markdown inputs by sha256).
- Deterministic: two builds on the same source tree produce the same
  `tree_hash`; two builds on different trees produce different hashes.
  Satisfies SC-005 (reviewer reproduces bundle from manifest alone).

**Alternatives considered.**

- **Git SHA of the current monorepo HEAD.** Rejected: meaningless for
  external Builders installing a published package (they have no git
  history of ATW). Also wrong during contributor workflow — an
  uncommitted edit produces the same SHA as the prior commit but a
  different bundle.
- **Bundle sha256 only.** Rejected: doesn't let a reviewer work
  backwards. Given only `bundle.sha256`, you don't know which source
  produced it.

## R4 — What happens when `@atw/widget` is unresolvable?

**Decision.** `compileWidget()` throws a typed error
(`code: "WIDGET_SOURCE_MISSING"`) with message:

> `atw-compile-widget: cannot resolve @atw/widget — ensure it is listed as a dependency of your project and install it with npm/pnpm/yarn.`

The orchestrator propagates this as exit code 3 (existing convention for
"missing prerequisite" — matches `/atw.embed`'s halt behavior). The
build manifest is NOT written (no success manifest under failure,
FR-007).

**Rationale.**

- FR-007 explicitly requires: no stub on failure, no success manifest on
  failure. The `WIDGET_SOURCE_MISSING` path is exactly that.
- Exit code 3 matches the existing "missing prerequisite" convention
  used by `/atw.embed` (embed-command.md contract), giving Builders
  consistent diagnostics across commands.
- The error message names the specific remediation — install the
  package — rather than saying "something went wrong".

**Alternatives considered.**

- **Silent fallback to stub with a warning.** Rejected: this is the exact
  failure mode FR-002 and FR-007 exist to prevent. A stub that ships to
  the Builder's `dist/` is worse than a loud failure.

## R5 — Should the stub code path be removed entirely, or kept for tests?

**Decision.** Remove the stub code path from `compileWidget()`. Any test
that needs to exercise the "no widget" failure mode asserts the
`WIDGET_SOURCE_MISSING` error instead.

**Rationale.**

- FR-002 forbids the stub string from appearing in any successful build.
  The most robust way to enforce that is to delete the code that
  produces it, not to rely on every future code path to avoid it.
- The stub was an explicit Feature 003 placeholder ("Feature 003
  populates later"). Feature 003 is delivered, Feature 004 ships it.
  The placeholder has served its purpose.

**Alternatives considered.**

- **Keep the stub behind a `--noop` flag for testing.** Rejected:
  creates a code path whose sole purpose is producing the bundle the
  spec prohibits. No legitimate runtime consumer.

## R6 — Do we need to re-bundle `@atw/widget`'s dependencies (Preact, etc.)?

**Decision.** No code change. The existing `esbuild.build()` call in
`compileWidget()` (compile-widget.ts:53–68) already sets
`bundle: true, platform: browser, format: iife`, which pulls in Preact,
@preact/signals, marked, DOMPurify, focus-trap transitively from the
entry point. No changes needed beyond flipping the entry path.

**Rationale.**

- Verified against Feature 003 post-impl-notes: widget bundle was
  verified <80 KB gzip with all dependencies bundled. The esbuild
  pipeline is known-good.
- This research item exists only to document the non-change: the
  delta is strictly about resolving `entry`, not about bundle shape.

## R7 — Does the Aurelia demo need its own dependency on `@atw/widget`?

**Decision.** No. `demo/atw-aurelia/package.json` depends on `@atw/scripts`
(transitively already, via the workspace). Since R2 puts `@atw/widget`
under `@atw/scripts`'s `dependencies`, the Aurelia demo gets it for free
through dependency resolution. No edit to Aurelia's `package.json`.

**Rationale.**

- Minimises the change surface. The Aurelia demo already represents the
  "Builder" persona; demanding it add a dep would signal that every
  Builder has to, violating FR-009.
- npm/yarn/pnpm all hoist transitive deps identically here — the widget
  resolves from the demo's `node_modules` tree.

**Alternatives considered.**

- **Add `@atw/widget` directly to Aurelia's `package.json`.** Rejected:
  unnecessary and sets a wrong precedent for external Builders.

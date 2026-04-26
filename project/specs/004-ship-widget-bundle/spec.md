# Feature Specification: Ship the Real Widget Bundle to Builders

**Feature Branch**: `004-ship-widget-bundle`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "He montado la web y he hecho todo el proceso y he ejecutado /atw.embed pero no me ha generado nada útil; mira en la carpeta demo/atw-aurelia/dist: widget.css y widget.js no tienen nada, el js dice `/* atw widget: no-op bundle (Feature 003 populates later) */`."

## User Scenarios & Testing *(mandatory)*

> Feature 003 delivered the widget source (Preact + Signals, action card, auth
> modes, theming) as a working codebase inside the ATW monorepo and claimed 93%
> completion. It did **not** deliver a way for a Builder — someone running
> `/atw.build` and `/atw.embed` from their own host-app directory — to actually
> receive that widget as a real compiled bundle. Today, every Builder gets a
> stub (`/* atw widget: no-op bundle (Feature 003 populates later) */`) because
> the build pipeline looks for a per-project widget entry that no Builder has.
> This feature closes that gap: the same happy-path run of `/atw.build` then
> `/atw.embed` that works for an ATW contributor must also produce a working
> chat widget for any Builder using ATW as a dependency.

### User Story 1 — Builder runs the published pipeline and gets a working widget (Priority: P1) 🎯 MVP

A Builder installs ATW into their host application (for example, the Aurelia
Medusa storefront under `demo/atw-aurelia/`), runs the four authoring
commands, runs `/atw.build`, and runs `/atw.embed`. When they open the
integration guide and load the widget into their storefront, the chat
launcher appears, opens a panel, accepts a message, reaches the backend,
and displays a grounded answer. At no point does the Builder need to know
that ATW has widget source code, where it lives, or how to compile it.

**Why this priority**: This is the entire value proposition of ATW. Without
a working widget in the Builder's `dist/`, `/atw.embed` is cosmetic — the
integration guide references files that render nothing. The hackathon
narrative ("talk to your catalog in minutes") collapses if the Builder
reaches the final step and finds a blank widget. Every other story in this
spec is a refinement of this one.

**Independent Test**: From a clean clone, run the quickstart flow end-to-end
against the Aurelia demo (`/atw.setup` → `/atw.scan` → `/atw.actions` →
`/atw.plan` → `/atw.build` → `/atw.embed`). Open the storefront in a
browser, send one question, and verify the widget renders a grounded reply
using products from the catalog. `demo/atw-aurelia/dist/widget.js` must be
> 1 KB and must not contain the string "no-op bundle".

**Acceptance Scenarios**:

1. **Given** a Builder host project with no local widget source code,
   **When** the Builder runs `/atw.build`, **Then** `dist/widget.js` and
   `dist/widget.css` contain the real compiled widget and the build manifest
   records `noop: false` for the widget bundle step.
2. **Given** the bundle from step 1 is referenced via the `<script>` and
   `<link>` tags produced by `/atw.embed`, **When** the host page loads in a
   modern browser, **Then** the chat launcher button is visible, clicking it
   opens the panel, and sending a message reaches the backend and renders a
   reply.
3. **Given** the Builder has not changed any inputs, **When** they run
   `/atw.build` a second time, **Then** `widget.js` and `widget.css` are
   byte-identical to the first run (determinism — inherited from Feature 002
   SC-016, must not regress).
4. **Given** the shipped bundle is gzipped, **When** its size is measured,
   **Then** `widget.js.gz` ≤ 80 KB and `widget.css.gz` ≤ 10 KB (the existing
   Feature 003 budget — must not regress once real code is shipped).

---

### User Story 2 — Aurelia demo runs end-to-end without manual patching (Priority: P1)

The Aurelia Medusa demo under `demo/atw-aurelia/` is the canonical "Builder"
in the repo; it is what the hackathon video demonstrates. A reviewer or
maintainer should be able to run `make demo` (or the equivalent quickstart
flow) and watch the widget chat against the seeded Medusa catalog, with
zero hand-editing of generated files or copying of bundles between folders.

**Why this priority**: The Aurelia demo is how every external evaluator
(hackathon judges, users trying ATW for the first time) forms their
first impression. If it requires an undocumented manual step to get the
widget to render, the demo is effectively broken. This story is P1
because it is how Story 1 is proven.

**Independent Test**: From a clean clone, follow
`specs/003-runtime/quickstart.md §3` (fresh Builder path). At no step
should the reviewer open `packages/widget/` or manually copy a file
into `demo/atw-aurelia/dist/`. The final step — opening the storefront
— must produce a working widget.

**Acceptance Scenarios**:

1. **Given** a clean clone of the repo, **When** the quickstart fresh path
   is followed to completion, **Then** the storefront at the documented URL
   serves a working chat widget without any additional manual step.
2. **Given** the Aurelia demo has completed `/atw.embed`, **When**
   `demo/atw-aurelia/.atw/artifacts/embed-guide.md` is read, **Then** the
   snippets in it reference the same `widget.js` and `widget.css` files
   that exist in `demo/atw-aurelia/dist/` and those files contain the real
   widget.

---

### User Story 3 — Bundle origin is observable and auditable (Priority: P2)

When something goes wrong — the widget doesn't render, a Builder reports
an old version, a security review asks "what code is running in my page" —
the answer must be recoverable from the build manifest without reading
compiled JavaScript. The widget bundle written to `dist/` must be
traceable back to a specific, pinned version of the ATW widget source
(a package version, a git SHA, or an equivalent identifier captured at
publish time), and `/atw.build`'s manifest must record that identifier
alongside the bundle's sha256.

**Why this priority**: Principle VIII (Reproducibility) and the existing
determinism contract (SC-016) require every artifact to be explainable.
Shipping a compiled widget without an auditable origin regresses that
guarantee. This is P2 rather than P1 because a Builder can demo the
product without this — but maintainers and reviewers cannot trust it.

**Independent Test**: Run `/atw.build` twice, once on version N and once
on version N+1 of the ATW widget. The two manifests must contain two
distinct widget-origin identifiers. Given either manifest alone, a
reviewer must be able to check out the exact widget source that produced
the bundle and reproduce it byte-for-byte.

**Acceptance Scenarios**:

1. **Given** `/atw.build` has completed, **When**
   `.atw/state/build-manifest.json` is read, **Then** it contains a
   `widget` section with the widget-source origin identifier and the
   bundle's sha256.
2. **Given** two builds on the same widget-source origin and same inputs,
   **When** their manifests are compared, **Then** the widget sha256s and
   origin identifiers match exactly.
3. **Given** two builds on different widget-source origins, **When** their
   manifests are compared, **Then** the origin identifiers differ.

---

### User Story 4 — ATW contributor workflow is preserved (Priority: P2)

An ATW contributor (someone modifying `packages/widget/`) must still be
able to run the pipeline against a local, uncommitted change to the widget
and see it reflected in `demo/atw-aurelia/dist/`. The Builder-facing happy
path must not block local iteration on the widget source.

**Why this priority**: Feature 003 implementation depends on this
iteration loop. If shipping the widget means freezing it to a published
version, contributors lose the ability to test changes against the
Aurelia demo before release. This is P2: it matters for contributors,
but only after Story 1 works for Builders.

**Independent Test**: Modify a visible string in
`packages/widget/src/panel.tsx` (e.g., the launcher label). Run the
Aurelia demo pipeline. Open the storefront. The modified string must
appear in the rendered widget without any manual publish/republish step.

**Acceptance Scenarios**:

1. **Given** an uncommitted edit in `packages/widget/src/`, **When** the
   Aurelia demo pipeline is run, **Then** the edit is visible in the
   rendered widget.
2. **Given** the contributor workflow from step 1, **When** the same
   pipeline is run from an external Builder project (outside the
   monorepo), **Then** the Builder receives the published bundle, not
   the contributor's local edit.

---

### Edge Cases

- What happens if the Builder's host project happens to contain a
  `widget/src/index.ts` by coincidence? (Today, `findEntry()` would pick
  it up and try to bundle it — the spec must decide whether that is
  still honoured as an override, or whether the ATW widget always wins.)
- What happens when the bundle budget (80 KB js / 10 KB css gzip) is
  exceeded by a legitimate widget change? (Build must fail with a clear
  message, not silently fall back to a stub.)
- What happens when the Builder is offline and the published widget
  package is not cached? (Build must fail with an actionable diagnostic
  identifying the missing dependency, not emit a stub.)
- What happens on rerun after a partial failure (bundle written but
  manifest not updated)? (Determinism contract from Feature 002 must
  still hold; rerun on unchanged inputs produces byte-identical output.)
- What happens if the Builder's project has a pinned older ATW version
  than the widget expected by their `/atw.embed` integration guide? (The
  integration guide and the bundle must come from the same ATW version;
  mismatch must be detected, not papered over.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/atw.build`, when run from any Builder host project that
  has successfully completed the authoring steps, MUST emit a compiled
  widget bundle containing the real ATW widget code to
  `dist/widget.js` and `dist/widget.css`.
- **FR-002**: The stub string `"no-op bundle (Feature 003 populates
  later)"` MUST NOT appear in any bundle produced by a successful
  `/atw.build` run under any supported configuration.
- **FR-003**: The compiled widget bundle MUST render a functional chat
  UI in modern evergreen browsers (launcher, panel, message input,
  message list, action card) when loaded via the `<script>` / `<link>`
  tags produced by `/atw.embed`.
- **FR-004**: Gzip-compressed widget bundle size MUST remain at or
  under the existing Feature 003 budget (80 KB `widget.js.gz`, 10 KB
  `widget.css.gz`). A regression MUST fail the build with a clear
  diagnostic — it MUST NOT silently fall back to a stub.
- **FR-005**: Two consecutive `/atw.build` runs on unchanged inputs
  MUST produce byte-identical `widget.js` and `widget.css` (inherits
  SC-016 from Feature 002).
- **FR-006**: `.atw/state/build-manifest.json` MUST record, for the
  widget bundle step, (a) the bundle's sha256, (b) the bundle's size,
  and (c) an origin identifier that lets a reviewer reproduce the exact
  widget source used to produce the bundle.
- **FR-007**: When `/atw.build` cannot emit a real bundle (dependency
  missing, source unavailable, bundler error), it MUST fail with a
  non-zero exit code and an actionable diagnostic. It MUST NOT write a
  stub bundle and MUST NOT write a success manifest.
- **FR-008**: `/atw.embed`'s integration guide MUST reference bundles
  produced by the same `/atw.build` invocation that generated them; the
  guide and the bundle it points at MUST come from the same ATW version.
- **FR-009**: Running the Aurelia demo quickstart from a clean clone
  MUST NOT require a manual step to copy, rebuild, or patch the widget
  bundle. The documented sequence alone MUST produce a working widget.
- **FR-010**: An ATW contributor with an uncommitted edit in
  `packages/widget/src/` MUST be able to observe that edit in the
  rendered widget after running the Aurelia demo pipeline, without a
  manual publish step.
- **FR-011**: When a Builder runs `/atw.build` from outside the ATW
  monorepo, the widget source used MUST come from the published ATW
  artifact they installed, not from any path on their local disk.

### Key Entities *(include if feature involves data)*

- **Widget bundle**: The pair of files `dist/widget.js` +
  `dist/widget.css`. Attributes: sha256, byte size, gzip size, origin
  identifier. Produced by `/atw.build`. Consumed by the browser via
  the tags in the embed guide.
- **Widget source origin**: The pinned identifier (version, SHA, or
  equivalent) of the ATW widget source that was compiled to produce a
  given bundle. Recorded in the build manifest. Required by FR-006 and
  FR-011.
- **Build manifest (extension)**: The existing
  `.atw/state/build-manifest.json` gains a `widget` section documented
  by FR-006. Does not replace Feature 002's existing manifest fields.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of clean-clone runs of the documented Aurelia demo
  quickstart produce a widget that renders and responds to a message
  in a browser, measured across three consecutive full runs on a
  reference machine.
- **SC-002**: A Builder with no prior ATW knowledge reaches a working
  widget in their host application within 20 minutes of starting the
  quickstart (measured from `/atw.setup` to first grounded reply).
- **SC-003**: Zero occurrences of the string `"no-op bundle"` in any
  `widget.js` produced by a successful build, measured across a
  regression test that runs the full pipeline against both the Aurelia
  demo and a second, non-Aurelia Builder project.
- **SC-004**: Gzip size of `widget.js` stays within the 80 KB budget
  across every release of this feature; gzip size of `widget.css`
  stays within 10 KB. A single byte over budget MUST fail CI.
- **SC-005**: Given a build manifest alone, a reviewer can reproduce
  the exact widget bundle byte-for-byte in under 10 minutes on a
  reference machine, using only information recorded in the manifest.
- **SC-006**: An ATW contributor can round-trip a one-line change in
  the widget source to the rendered Aurelia demo in under 2 minutes
  (no republish, no manual copy).

## Assumptions

- The widget source in `packages/widget/` as delivered by Feature 003
  is behaviourally correct and is approved as the code to ship; this
  feature does not re-scope what the widget does, only how it reaches
  Builders.
- The Builder-facing command surface stays the same: `/atw.build` and
  `/atw.embed` are still the only commands a Builder invokes for this
  step. No new Builder-facing commands are introduced.
- The existing build manifest shape in `.atw/state/build-manifest.json`
  is extended, not replaced; Feature 002 consumers of the manifest
  continue to work unchanged.
- Determinism, bundle-budget, and auth/credential-sovereignty guarantees
  from Features 002 and 003 are preserved; this feature does not
  relax any red-line principle.
- "Modern evergreen browsers" means the same target Feature 003 uses
  (ES2020, current Chrome/Firefox/Safari/Edge); this feature does not
  expand or contract browser support.
- Any change to where the widget source is located or how it is
  distributed is an implementation detail for the plan phase, not a
  requirement here. The spec requires that the widget arrive at the
  Builder; it does not prescribe the delivery mechanism.

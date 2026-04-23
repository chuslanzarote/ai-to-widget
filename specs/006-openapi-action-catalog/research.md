# Phase 0 Research: OpenAPI-Driven Action Catalog and Client-Side Execution

**Feature**: 006-openapi-action-catalog
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)

This document records the design decisions taken before drafting
`data-model.md` and the contracts under `contracts/`. Every decision
below was a genuine fork — alternatives are named so a reader can judge
whether the choice still holds when the premise changes.

There are no `NEEDS CLARIFICATION` markers outstanding. The spec's
clarifications session (2026-04-23) resolved five ambiguities; the
remainder fell out as natural consequences of the existing codebase
shape that was inventoried during plan drafting.

---

## R1. Where does the OpenAPI document live after ingestion?

**Decision.** Committed to the project under
`.atw/artifacts/openapi.json`. JSON, pretty-printed, stable key ordering
via `JSON.stringify(value, null, 2)` on a recursively key-sorted clone.

**Rationale.** Principle II (Markdown as Source of Truth) allows JSON
for hierarchical structured data that markdown lists cannot represent
naturally — a 100+ operation OpenAPI is the canonical example. The
pinned-snapshot model (FR-020) requires the document to be committable
so `git diff` surfaces drift; storing it under `.atw/artifacts/`
(already the project's artefact directory) keeps it alongside
`brief.md`, `schema-map.md`, and `build-plan.md`. JSON was chosen over
YAML because `parseOpenAPI()` already normalises to JSON internally
after `SwaggerParser.bundle()`, and because stable key ordering is
tractable in JSON without a bespoke YAML emitter.

**Alternatives considered.**

- *Store only the `ParsedOpenAPI` normalised shape from
  `packages/scripts/src/lib/types.ts`.* Rejected: the normalised shape
  is lossy (it discards unrecognised extensions, `info.contact`,
  `externalDocs`). Committing the normalised form would make the
  reviewer's diff show classifier-driven changes mixed with
  shape-discarding changes, muddling the `git diff` audit signal.
- *Store the raw as-provided document byte-for-byte.* Rejected: a
  user-provided document may be YAML, may have comments, may have
  trailing whitespace differences across platforms. We commit the
  post-`SwaggerParser.bundle()` output (references resolved, JSON
  canonicalised) so re-ingestion on any machine produces the same file.
- *Reach back to the source URL on every downstream run.* Rejected by
  FR-020 (pinned snapshot, no auto-refresh). Reproducibility (red line
  VIII) forbids a network round-trip as part of `/atw.build`.

---

## R2. Classification strategy: pure deterministic, pure Opus, or a layered pass?

**Decision.** Two-stage pipeline inside `classify-actions.ts`:

1. **Deterministic heuristic pass** (pure function; no Opus). Applies
   the default-exclusion rules from FR-005:
   - Admin-path prefix (`/admin/**`, `/internal/**`, and patterns from
     the existing `packages/scripts/src/lib/admin-detection.ts`).
   - Non-cookie-based `security` requirement (the operation declares
     `oauth2`, `bearer`, `apiKey` as a scheme other than the host's
     session cookie name).
   - Missing or non-object `requestBody.schema`.
   - Destructive operations against resources the documentation does
     not mark as shopper-owned — detected by
     `packages/scripts/src/lib/destructive-detection.ts`.
   Output: a candidate-included list, a pre-excluded list with a
   `reason` per entry.
2. **Opus narrowing review** (single model call; budgeted). Opus sees
   the candidate-included list (paired with operation summaries and
   request schemas) and is instructed to *remove* any operation it
   judges unsafe for a shopper. Opus CANNOT add to the list — the
   post-processing step validates that every item Opus returns was
   already in the candidate-included list and rejects the run
   otherwise (FR-004).

**Rationale.** Principle IX (Opus as a Tool, Not a Crutch): the
deterministic pass handles everything a regex can reliably handle, so
Opus only sees genuine judgment calls. Principle V (Anchored Generation,
red line): the "narrow only" constraint is the structural enforcement
of "every action traces back to a real operation". Principle VI
(Composable Deterministic Primitives): the two stages are separable,
individually testable, and the deterministic stage is fully byte-stable
across machines.

The "narrow only" invariant is validated by a post-Opus check: for each
operation in Opus's output, assert that its `(operationId, path,
method)` triple is present in the candidate-included list the
deterministic pass produced. If not, the run exits non-zero, names the
offending entry, and writes no manifest.

**Alternatives considered.**

- *Pure deterministic.* Rejected: handles prefixes and schemes well,
  fails on operations the OpenAPI tags ambiguously or that are
  domain-specific (e.g., a "customer service" endpoint a shopper should
  not call). The Medusa `/store/*` surface has ~20 operations where
  heuristic alone would include some shopper-unsafe ones.
- *Pure Opus.* Rejected: per Principle IX, wasteful, slow, and
  non-deterministic for cases that don't need judgment. Also conflicts
  with Principle V's red line more sharply: a freehand Opus pass is
  more likely to fabricate an operation.
- *Opus first, heuristic second.* Rejected: the heuristic is strictly
  more conservative than Opus on admin-prefix checks; running it last
  would mean Opus sees garbage input it must then filter. Running it
  first means Opus sees only operations that passed the deterministic
  filter and can concentrate on genuine judgment.
- *Let the Builder curate the list manually without Opus.* Possible
  fallback; the classification step accepts manual edits to
  `action-manifest.md` as authoritative on re-run (FR-017). But the
  first-pass experience ("the Builder gets a usable manifest without
  manual intervention") requires at least one automated classifier.

**Budget.** One Opus 4.7 call per classification run, with the
candidate list capped at 40 operations in the prompt (well above the
20-action soft warning at FR-019, and comfortable inside the 200K
context). Max output capped at 2 KB. A run on a typical host OpenAPI
costs well under $0.10.

---

## R3. Manifest format: markdown with embedded JSON blocks, or pure markdown, or pure JSON?

**Decision.** Markdown with embedded fenced JSON blocks for input
schemas and structured fields, following the pattern the hand-authored
Feature 005 demo manifest already uses (see
`demo/atw-aurelia/.atw/artifacts/action-manifest.md` for the current
shape). Each included action is a third-level heading (`###
operation_name`); each excluded operation is a single bullet line.

**Rationale.** Principle II requires markdown for auditable state, and
"markdown with code-fenced JSON" is the constitution's explicit-fallback
pattern when hierarchical structured data is unavoidable (e.g., input
schemas, summary field lists). The hand-authored demo manifest already
follows this pattern, so the machine-generated version is a migration
of the existing shape rather than a format-break. Reviewers and
Builders already know how to read it.

A parallel `.atw/artifacts/action-executors.json` carries the
declarative catalog the widget loads — JSON not markdown because the
widget's fixed interpreter parses it at runtime and a JSON file is the
correct shape for that consumer (Principle II's structured-data
exception).

**Alternatives considered.**

- *Pure JSON manifest.* Rejected: loses the Builder's ability to read
  and edit by hand. The excluded list's free-text reasons would become
  awkward.
- *YAML manifest.* Rejected: no YAML emitter in the workspace; adding
  one for this feature violates Principle VII (Single-Ecosystem
  Simplicity) and adds a dependency for a gain pure markdown already
  offers.
- *Two separate files — `action-manifest-included.md` and
  `action-excluded.md`.* Rejected: the excluded list is the Builder's
  primary lever for curating coverage (FR-017), so keeping it in the
  same file the Builder reviews after classification is the intuitive
  choice. A single file also diffs more clearly when an operation moves
  from excluded to included.

---

## R4. Executors catalog: what's the executable surface?

**Decision.** A strict declarative schema the widget's fixed
interpreter consumes. One entry per included action:

```json
{
  "version": 1,
  "credentialMode": "same-origin-cookies",
  "actions": [
    {
      "tool": "add_to_cart",
      "method": "POST",
      "pathTemplate": "/store/carts/{cart_id}/line-items",
      "substitution": {
        "path": { "cart_id": "arguments.cart_id" },
        "body": {
          "variant_id": "arguments.variant_id",
          "quantity": "arguments.quantity"
        },
        "query": {}
      },
      "headers": {
        "content-type": "application/json"
      },
      "responseHandling": {
        "successStatuses": [200, 201],
        "summaryTemplate": "Added {product_title} ×{quantity} to cart.",
        "summaryFields": ["product_title", "quantity"],
        "errorMessageField": "message"
      }
    }
  ]
}
```

No field in this schema may contain a code expression. `substitution`
values are simple dotted accessors (`arguments.*`) evaluated by a
whitelist-based resolver; `responseHandling.summaryTemplate` is a
restricted `{field}`-style template (not Handlebars, not Mustache,
certainly not eval). The interpreter accepts **only** these shapes and
refuses any structure outside them.

**Rationale.** FR-009 / SC-006: no `eval`, no `new Function`, no
dynamic `import`. A restricted declarative shape is the auditable form.
The `{field}`-style template with a fixed-character interpolation
syntax is trivially implementable as a single `String.replace` pass,
with no parser to exploit.

**Alternatives considered.**

- *Use a general template language like Handlebars for
  `summaryTemplate`.* Rejected: even noEscape Handlebars has a helper
  surface and a parser; reducing the template engine to a
  single-function `String.replace` over `{name}` placeholders collapses
  the attack surface to zero.
- *Store the URL as a full `https://...` string with placeholders.*
  Rejected: the widget constructs the URL from `config.apiBaseUrl` +
  `pathTemplate` (the existing `api-client-action.ts:53-55` pattern),
  and cross-origin mismatches are caught at build time rather than
  runtime. Committing absolute URLs would make the catalog brittle
  across dev / staging / prod.
- *Allow arbitrary JavaScript `responseHandler(response) => summary`.*
  Rejected outright: this is the precise XSS surface FR-009 forbids.

---

## R5. How does the widget load the executors catalog at runtime?

**Decision.** The widget bundle is served alongside
`action-executors.json` from the same static hosting the widget itself
uses. At init, the widget issues a single `fetch` to
`${config.widgetBaseUrl}/action-executors.json` (new
`WidgetConfig.actionExecutorsUrl`, defaulting to that relative path),
validates the response against the JSON schema (runtime Zod check,
fails closed on any shape mismatch), and freezes the catalog in
module-level state. `executeAction()` reads from this frozen catalog;
if the catalog is missing or malformed, the widget falls back to
chat-only and logs a single warning to the browser console.

**Rationale.** Co-locating the catalog with the bundle means the same
CDN caching, same CORS policy, and same CSP applies. A fresh build
replaces both the bundle and the catalog together, preventing a
desync where the bundle expects tools the catalog doesn't carry (or
vice versa). Loading at init rather than on first action means Opus's
first `tool_use` doesn't wait on a network round-trip.

**Alternatives considered.**

- *Bake the catalog into the widget bundle as a compile-time constant.*
  Rejected: means every host-specific build produces a widget-specific
  JS artefact, breaking the "one widget bundle" shape Feature 004
  landed. Loading from a sibling JSON keeps the JS bundle generic.
- *Fetch the catalog from the chat backend.* Rejected by Principle I
  (the widget should not need the backend to execute actions) and by
  FR-010 (no backend-minted data on the widget's fetch path beyond
  chat responses). Also makes the widget depend on the backend being
  up for first-action availability, which is wrong.
- *Fetch the catalog lazily on first `tool_use`.* Rejected: adds a
  visible latency to the first action (bad UX), and if the fetch fails
  the widget has no action capability mid-session (bad failure mode).

---

## R6. Cross-origin detection: build-time vs runtime-only?

**Decision.** Both, with the build-time warning taking precedence.

- **Build-time (FR-016).** When the ingested OpenAPI's `servers[0].url`
  origin differs from the Builder-configured widget embed origin (a
  value declared in `brief.md` / `config.ts.hbs`), `/atw.build` emits a
  warning naming each cross-origin action and explains that
  same-origin credential attachment will not apply. The build does not
  fail — some deployments intentionally embed on a subdomain and
  configure CORS + cookie Domain attributes to handle it — but the
  warning is loud enough to catch misconfiguration.
- **Runtime (FR-016 continuation).** The widget's executor, when
  building a request, compares the catalog's `pathTemplate`-derived
  request URL origin against `window.location.origin`. If they differ
  AND `credentialMode === "same-origin-cookies"`, the executor
  surfaces a distinct "configuration mismatch" error state through
  the confirmation card (not a generic failure), so the Builder can
  diagnose it.

**Rationale.** Build-time catches the common Builder misconfiguration
before the widget ships. Runtime catches the edge case where the
widget was configured correctly at build time but embedded on an
unexpected origin (e.g., a staging deployment). Both surfaces are
cheap to add and neither changes the happy path.

**Alternatives considered.**

- *Runtime only.* Rejected: makes the Builder debug an issue at
  shopper-visible time that was diagnosable at build time.
- *Build-time only.* Rejected: cannot catch a widget embedded on a
  different origin than the one declared in the brief (operator
  error at embed time).
- *Fail the build on cross-origin.* Rejected: some hosts intentionally
  run cross-origin (subdomain-based API) with cookie-Domain
  configuration that works. A warning is correct; a hard failure is
  wrong.

---

## R7. How does the manifest survive Builder edits across pipeline re-runs?

**Decision.** `action-manifest.md` is the source of truth after it is
first written. On re-run, the classifier inspects the committed
manifest against the ingested OpenAPI:

- If a manifest entry cites an `operationId` that still exists in the
  OpenAPI, the manifest entry is preserved verbatim (including any
  Builder flip of `confirmation_required` or description edit).
- If the ingested OpenAPI no longer contains an operation the manifest
  cites, the classifier surfaces the orphan in the build output and
  moves the entry to a `## Orphaned (operation removed from OpenAPI)`
  section, leaving the Builder to decide whether to delete it.
- If the ingested OpenAPI has new operations the manifest does not
  cover, the classifier runs the full heuristic+Opus pass on only
  those new operations and merges the result into the included /
  excluded lists.
- The Builder can force a full re-classification by deleting
  `action-manifest.md` and re-running.

**Rationale.** Principle III (Idempotent and Interruptible) requires
re-runs to honour prior work. Principle IV (Human-in-the-Loop) requires
Builder edits to stick. The merge strategy above is the minimal one
that satisfies both without requiring the Builder to re-review the
full list every time the OpenAPI changes.

**Alternatives considered.**

- *Always regenerate from scratch on re-run.* Rejected: destroys
  Builder edits, violates FR-017 explicitly.
- *Manifest is authoritative; new OpenAPI operations are ignored until
  the Builder asks.* Rejected: surprises the Builder by leaving new
  operations off the list silently. The delta-merge approach makes new
  operations visible in the next manifest diff.
- *Store the merge state in a hidden lockfile.* Rejected by Principle
  II (no hidden state). The orphaned section is how merge state
  surfaces.

---

## R8. Same-origin cookie mode: how does it interact with existing widget auth modes?

**Decision.** `buildHostApiRequest()` in `packages/widget/src/auth.ts`
already supports three auth modes: `cookie`, `bearer`, `custom`. The
`cookie` mode sets `credentials: 'include'` directly. This feature
constrains the executors catalog to always declare `credentialMode:
"same-origin-cookies"` in v1, which the executor translates to the
widget's existing `cookie` mode. `bearer` and `custom` remain
supported by `buildHostApiRequest()` but are not reachable from the
generated executors catalog in v1 — they are available for future
features (e.g., bearer tokens minted entirely in the widget by a host
SDK) without a catalog-schema migration.

**Rationale.** The existing auth infrastructure is correct; this
feature piggybacks on it rather than replacing it. FR-010 is
structurally enforced by the existing `buildBackendHeaders()` strip,
which runs on every request destined for the chat backend regardless
of widget auth mode. The v1 constraint to `same-origin-cookies` in
the catalog is a scope decision (OAuth and bearer flows out of scope
per spec Assumptions), not a technical limitation.

**Alternatives considered.**

- *Ship v1 with bearer-token support in the catalog.* Rejected: adds
  an attack surface (the catalog could declare a bearer token template)
  for a use case the spec explicitly defers to phase 2.
- *Refactor `buildHostApiRequest()` to remove the unused modes.*
  Rejected: modes are used by non-catalog callers (reviewed in
  `packages/widget/test/`); removing them is a breaking change that
  does not belong in this feature.

---

## R9. Determinism surface: what hashes the manifest depends on?

**Decision.** The build manifest's `input_hashes` section is extended
to include:

- `openapi`: sha256 of `.atw/artifacts/openapi.json` (the pinned
  document as committed).
- `action_manifest`: sha256 of `.atw/artifacts/action-manifest.md`.
- `shared_lib`: already tracked in Feature 005's vendored-shared-lib
  hash (unchanged).
- `classifier_model_snapshot`: the Opus model id + effective date from
  the last classification run. Stored in the manifest front-matter; the
  build reads it from there, does not compute it.

The hashes determine whether RENDER can short-circuit as
`unchanged`. If any of the three data inputs (openapi, manifest,
shared_lib) match the prior run AND `tools.ts` and
`action-executors.json` already exist with the prior recorded sha256s,
the render step skips rewrite (matches Feature 005's bundle cache
pattern at `orchestrator.ts:614-646`).

**Rationale.** Principle VIII requires re-runs on unchanged inputs to
be no-ops. Tracking the manifest hash rather than the OpenAPI hash
alone means that a Builder edit to `action-manifest.md` (the human
curation path, FR-017) correctly triggers a render, while an unrelated
change elsewhere does not.

**Alternatives considered.**

- *Hash only the OpenAPI.* Rejected: Builder edits to the manifest
  would be lost on re-run.
- *Hash every file the render touches.* Rejected: overkill;
  short-circuit logic at the step level with input-hashes is the
  Feature 002 pattern and works.
- *Include the classifier model snapshot in the determinism ledger.*
  Partially rejected: the model snapshot is recorded in the manifest's
  front-matter (so a Builder can see why the manifest changed), but
  determinism at the render step is defined against the manifest
  content, not against the model snapshot. This matches spec edge case
  "Builder re-runs the build on a machine whose Opus snapshot has
  changed".

---

## R10. What's the minimum-viable UX for the excluded-operations list?

**Decision.** Simple markdown bulleted list under `## Excluded`, one
line per operation, format: `- HTTP_METHOD path — reason`. The
`demo/atw-aurelia/.atw/artifacts/action-manifest.md` already uses this
shape; the generated format matches it.

**Rationale.** The excluded list is an audit surface (what did the
classifier filter out, and why?) and a curation lever (the Builder can
move a line from excluded to included by hand, per FR-017). Both use
cases want a flat list a human reads top-to-bottom, not a nested tree
or a JSON blob. The reason string is free-form but conventional values
are documented in the contract (admin path, non-cookie security,
missing schema, destructive-on-unowned, Opus-narrowed).

**Alternatives considered.**

- *Group excluded operations by reason category.* Rejected: increases
  the diff surface when a single operation changes category; flat list
  is the simplest diff-friendly shape.
- *Inline OpenAPI operation summaries in the excluded list.* Rejected:
  bloats the manifest; the Builder can always look up the summary in
  `openapi.json` if they need it.

---

## R11. How does an empty included-actions list surface?

**Decision.** The build step completes successfully, emits a single
warning banner on stderr, writes `action-executors.json` with an empty
`actions: []` array, and renders `tools.ts` with
`RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`. The widget at runtime
boots normally, the `executeAction()` path is never entered, and
`ACTION_TOOLS.length === 0` so the backend's Opus call receives an
empty tools list (no `tool_use` can be emitted).

**Rationale.** FR-014: graceful degradation is a hard requirement.
Failing the build on an empty catalog would make a perfectly valid
"chat-only deployment" impossible. The warning is the visible signal
that action capability is unavailable; the excluded-operations list
in the manifest tells the Builder which operations the classifier
considered and rejected.

**Alternatives considered.**

- *Fail the build on an empty catalog.* Rejected by FR-014 / SC-005.
- *Omit the `action-executors.json` file entirely.* Rejected: the
  widget's init code would then see a 404 on the catalog fetch,
  triggering a distinct "catalog unavailable" failure mode. Writing
  an empty but well-formed catalog is the clean graceful-degradation
  path.

---

## R12. Is there a race between `/atw.api` and `/atw.build`?

**Decision.** No. `/atw.api` is a standalone step that writes
`openapi.json` and extends `input-hashes.json`. `/atw.build`'s RENDER
step reads both files at the start. If `openapi.json` is missing,
RENDER falls to the FR-014 graceful-degradation branch. If
`action-manifest.md` is missing (first run after ingestion but before
classification), RENDER runs the classifier inline as a CLASSIFY
sub-step, produces the manifest, then continues. The classifier can
also be run standalone via `/atw.classify` (or re-run by deleting the
manifest and re-running `/atw.build`), but is NOT required as a
separate user-invoked step in the happy path.

**Rationale.** Principle III (Idempotent and Interruptible): each
slash command detects existing state and offers refinement. Running
`/atw.build` without first running `/atw.api` is a degradation (empty
catalog), not an error. Running `/atw.build` without first running
classification is not a degradation — it runs classification inline.

**Alternatives considered.**

- *Require `/atw.classify` to run before `/atw.build`.* Rejected:
  increases Builder friction for the common case; Principle III
  prefers implicit resumption.
- *Run `/atw.api` automatically as part of `/atw.build`.* Rejected:
  requires the Builder to have a source URL/path in `/atw.build`
  invocation, which conflicts with the pinned-snapshot model (FR-020).
  Ingestion is a deliberate Builder step.

---

## R13. What's the testing strategy — mock the OpenAPI or use a real fixture?

**Decision.** Hybrid.

- **Unit tests.** Small synthetic OpenAPI fixtures under
  `packages/scripts/test/fixtures/openapi-*.json`, each exercising one
  edge case (duplicate operationId, missing schema, oauth security,
  admin prefix, cross-origin server URL, etc.).
- **Contract tests.** The canonical Medusa `/store/*` OpenAPI (a
  trimmed subset committed to
  `packages/scripts/test/fixtures/medusa-store.openapi.json`) drives
  the classifier, render, and determinism tests. This mirrors the
  actual demo's input exactly.
- **Integration tests.** The full `/atw.api → /atw.build` orchestrator
  round-trip runs against the committed Medusa fixture and asserts:
  (a) `tools.ts` is non-empty, (b) `action-executors.json` matches the
  committed snapshot, (c) a re-run is byte-identical.
- **Reviewer demo (manual).** The acceptance scenario from US5 is a
  manual walkthrough; the quickstart.md tells the reviewer exactly
  what to type.
- **No live-API tests.** Per spec Assumptions, auto-generated
  integration tests that hit the live Medusa host are explicitly out
  of scope.

**Rationale.** Principle VIII wants a reproducible test suite that
runs anywhere without external dependencies. Committed fixtures give
byte-identical inputs across machines. The one Opus-touching test
(`classify-actions.anchored.contract.test.ts`) uses a mocked Opus
client so CI does not burn API budget on every run.

**Alternatives considered.**

- *Run the real Medusa OpenAPI live on every CI run.* Rejected by
  Principle VIII; external dependencies break reproducibility.
- *Skip contract tests entirely; rely on the reviewer demo.* Rejected:
  leaves determinism and anchored-generation invariants unverified.

---

## Summary

All `NEEDS CLARIFICATION` from the plan's Technical Context are
resolved. The decisions above, taken together, produce a feature that:

- Commits the ingested OpenAPI as a pinned canonical snapshot (R1, R9,
  R12).
- Classifies operations via a layered deterministic-then-Opus pipeline
  with a narrow-only anchored-generation invariant (R2).
- Surfaces everything Builder-reviewable in markdown + embedded JSON
  blocks (R3, R10).
- Emits a declarative JSON executors catalog the widget consumes with
  a fixed, audited interpreter (R4, R5).
- Detects cross-origin misconfiguration at both build time and runtime
  (R6).
- Preserves Builder edits across re-runs with a delta-merge strategy
  (R7).
- Relies on existing widget auth infrastructure to enforce Principle I
  structurally (R8).
- Tracks determinism via a three-input hash (OpenAPI + manifest +
  shared-lib) that short-circuits unchanged re-runs (R9).
- Gracefully degrades to chat-only on empty or missing catalogs (R11).
- Avoids live-API dependency in the test suite (R13).

Proceed to Phase 1.

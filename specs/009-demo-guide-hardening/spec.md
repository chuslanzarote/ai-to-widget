# Feature Specification: Demo-Guide Hardening (LLM-Native Action Pipeline + Integrator-Ready Output)

**Feature Branch**: `009-demo-guide-hardening`
**Created**: 2026-04-25
**Status**: Draft
**Input**: User description: "con lo que hemos estado hablando y sí, el item 5a debería ser un principio rector."

## Context

On 2026-04-25 the user ran the complete `/atw.*` flow end-to-end against
`demo/shop/atw-shop-host`, simulating an external integrator who had just
`git clone`'d the repo. The session surfaced 25+ distinct friction points
captured in `project_atw_demo_guide_friction_009.md` (auto-memory). Every
single one required either an agent-applied patch, a hand-edit to a
generated artifact, or terminal acrobatics to recover from. **An external
integrator without ATW context would not survive any of them.**

The deepest finding of that session was not a bug count — it was an
**architectural mistake**. ATW's scripts re-derive OpenAPI semantics
(operation purpose, input schemas, summary phrasing, parameter shapes)
through a chain of regex parsers, hardcoded heuristics, and fragile
intermediate markdown artifacts. Each re-derivation step is a place
where the truth in the source-of-truth (the OpenAPI document) gets
lossy-compressed into a derivative format that the next step then
mis-reads. The $ref bug (POST/PUT/PATCH manifests shipping with empty
`properties: {}`), the missing `summaryTemplate`, the brittle
field-extraction regexes, and the token-list "shopper-owned" heuristics
are all symptoms of the same root cause.

This feature replaces the re-derivation chain with **LLM-native API
understanding**: the LLM reads the OpenAPI/Swagger document directly, in
the context of the Builder's intent already captured in `/atw.init`, and
emits per-operation manifests with proper schemas, descriptions, and
summary templates. That is the **rector principle** governing the rest
of this spec.

## Rector Principle: LLM-Native API Understanding

**Statement.** ATW MUST NOT re-derive OpenAPI semantics inside its own
scripts. The OpenAPI/Swagger document is the contract; the LLM reads it
directly with the Builder's stated intent (`project.md`) as guidance and
emits per-operation manifests with the structural shape ATW's runtime
needs. No regex parsers extracting "shopper-owned-ness" from operation
IDs, no token allowlists for verb classification, no $ref-following code
that needs to keep up with OpenAPI 3.x edge cases, no markdown
parameter-extraction passes.

**Why this is the rector principle.** Every secondary friction item in
this spec is either (a) a downstream symptom of a re-derivation step
that lost information, or (b) a consequence of the integrator running
into the gaps that re-derivation left behind. Closing the gap at the
source — letting the LLM see the OpenAPI document with full context —
collapses the symptom surface area. Spec 009 acceptance is conditional
on this principle being implemented; no other thread is independently
shippable.

**Constraints on the implementation.**

1. **No pre-filtering for cost.** The full OpenAPI/Swagger document goes
   to the LLM. ATW MUST NOT introduce token-count guards, operation
   pre-filters, or "Stage 1 narrowing" passes intended to shrink the
   prompt. Builders pay for what they create; APIs with thousands of
   operations are the Builder's concern. (User: *"Creo que es mejor
   enviar el openapi o swagger entero sin preocuparse del coste. Si
   alguien quiere crear tantas acciones tendrá que pagarlo."*)
2. **Model selection is the cost lever.** Document that LLM-driven steps
   can run under alternate model snapshots. Constitution Principle VIII
   (Reproducibility) still requires pinning whichever snapshot was used.
   Builders who care about cost choose a smaller model; the architecture
   does not change.
3. **Stage-1 deterministic filters survive only for structural
   impossibilities** — `OPTIONS`/`HEAD` verbs, operations with no
   declared response, operations with malformed schemas. Anything
   semantic ("is this shopper-owned?", "is this safe to expose to a
   widget?", "what input does this need?") is the LLM's call.
4. **Markdown becomes prose-only.** Machine-readable fields move to
   YAML frontmatter (or fenced YAML blocks) inside the same files. No
   regex extraction of bold-bulleted-bracketed-backticked field lines.
5. **Anchored Generation (Constitution V) is preserved.** The LLM's
   manifest output MUST cite the source OpenAPI operation ID and
   schema reference for every field it emits, so the Builder can audit
   that no field was hallucinated.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — A confirmed write actually executes end-to-end (Priority: P1)

An external integrator runs the full `/atw.*` flow against an OpenAPI
document that contains write operations (POST/PUT/PATCH with request
bodies). At the end of the flow they paste the embed snippet into their
host page, open the widget, ask the assistant to perform a write, and
confirm the resulting ActionCard. The write reaches the host API with a
correctly-shaped body, the host API returns success, and the widget
renders a grounded confirmation message.

**Why this priority**: This is the demo's golden path. Every other piece
of polish is worthless if the basic confirmed-write flow doesn't work.
On 2026-04-25 it didn't — the manifest had `properties: {}`, Opus
emitted `arguments: {}`, and the API rejected the empty body. P1.

**Independent Test**: Run `/atw.*` against any OpenAPI document with at
least one POST-with-body endpoint marked as in-scope by the Builder's
brief. Inspect the resulting `action-manifest.md`/catalog: every
in-scope write MUST have a non-empty `properties` block matching the
OpenAPI request body schema. Drive the widget to confirm one such
write; the request body MUST contain all required fields populated from
the conversation context.

**Acceptance Scenarios**:

1. **Given** an OpenAPI doc where POST `/cart/items` uses
   `requestBody.content.application/json.schema.$ref: "#/components/schemas/CartItem"`
   and `CartItem` declares `required: [product_id, quantity]`,
   **When** the integrator runs `/atw.classify` followed by `/atw.build`,
   **Then** the resulting catalog entry for `add_cart_item` MUST contain
   `product_id` and `quantity` as input properties with the types and
   `required` flag declared in the source schema.
2. **Given** the widget has loaded the catalog from item 1, **When** the
   shopper says *"add one bag of decaf to my cart"* and confirms the
   ActionCard, **Then** the POST to the host API MUST contain a JSON body
   with both `product_id` and `quantity` populated.
3. **Given** the OpenAPI doc uses `allOf`/`oneOf`/`anyOf` composition or
   nested `$ref` chains in the request body, **When** the catalog is
   built, **Then** the resulting properties MUST reflect the composed
   shape (no empty objects, no half-resolved refs).

---

### User Story 2 — The ActionCard says what is about to happen, in plain language (Priority: P1)

When the assistant proposes a write, the ActionCard shows a
human-readable sentence describing the specific action with the
specific arguments — "Add 1× Decaf Swiss Water 500 g to your cart" —
not "Can you add a package to my cart?" plus a raw tool name. The
shopper can read the card and decide to confirm or cancel without
guessing what the buttons will do.

**Why this priority**: FR-026 already promised this in Feature 008. The
infrastructure was shipped on the widget side but never wired upstream;
the demo on 2026-04-25 showed Opus's vague description fallback because
no `summaryTemplate` reached the catalog. Without this story the
confirm/cancel gate is unsafe — shoppers approve actions they didn't
understand. P1.

**Independent Test**: For every write in the catalog, render the
ActionCard for a sample tool-call with realistic arguments. The card's
title row MUST be a complete English sentence containing at least one
argument value (e.g., the product name or quantity), not the raw tool
name and not a generic question.

**Acceptance Scenarios**:

1. **Given** the LLM-emitted manifest for `add_cart_item` includes a
   `summaryTemplate` like `"Add {{ quantity }}× {{ product_name }} to
   your cart"`, **When** the widget renders the ActionCard for an
   intent with `quantity=1` and `product_name="Decaf Swiss Water 500 g"`,
   **Then** the card MUST display "Add 1× Decaf Swiss Water 500 g to
   your cart" and MUST NOT display the raw tool name.
2. **Given** a `summaryTemplate` placeholder cannot be resolved (a key
   is missing from the intent's arguments), **When** the card renders,
   **Then** it MUST fall back to a deterministic sentence built from the
   tool name + present arguments, NOT to a vague Opus-authored question.

---

### User Story 3 — The embed guide produces a working integration on first paste (Priority: P1)

After `/atw.embed` runs, the integrator opens `embed-guide.md`, follows
its steps verbatim against their host project, and the widget loads
correctly on their storefront with the correct origins, tools, theming,
and host-API connectivity. No placeholder values to fill in by hand, no
"copy this to your public folder" without saying where that is, no
two-contradictory-script-snippets, no missing `data-api-base-url`.

**Why this priority**: A perfect manifest is invisible if the
integrator can't get the widget to load. Items 6–15, 14b, 14c, 15a, 15b
in the friction memory show that today's embed guide forces the
integrator to debug their way through a half-finished doc. The demo on
2026-04-25 needed manual edits to `index.html` (add `data-api-base-url`)
and `docker-compose.yml` (add `ALLOWED_ORIGINS`) before any write could
reach the host API. P1.

**Independent Test**: A fresh integrator with no ATW context follows
`embed-guide.md` step-by-step against a minimal host project (one HTML
page + a backend container). The widget MUST load, fetch the catalog,
accept a chat message, and reach the host API for at least one read and
one confirmed write — without any manual edit to the emitted snippets,
the host compose file, or the host API's CORS configuration beyond what
the guide tells them to do.

**Acceptance Scenarios**:

1. **Given** `/atw.init` captured the host page origin (e.g.
   `http://localhost:8080`) and the host API origin (e.g.
   `http://localhost:3200`) as separate values, **When** `/atw.embed`
   emits `embed-guide.md`, **Then** the `<script>` tag MUST include
   `data-api-base-url` populated with the host API origin and
   `data-backend-url` populated with the ATW backend origin, both
   inlined as concrete URLs (no `<your storefront origin>`
   placeholders).
2. **Given** the host page origin and host API origin differ (the
   common case), **When** the integrator follows the guide,
   **Then** the guide MUST contain a CORS section that names the host
   page origin verbatim, lists the exact headers the widget sends
   (`Authorization`, `Content-Type`, …), and either generates a
   framework-specific snippet (Express/cors, Fastify/@fastify/cors,
   Next.js middleware, …) keyed on what was detected during
   `/atw.init` OR provides a checklist the integrator can verify
   against their stack.
3. **Given** the integrator's stack uses a build-time-frozen frontend
   (Vite/Next.js/etc. served by nginx in a container), **When** they
   follow the guide's "copy assets to public/" step, **Then** the
   guide MUST tell them their frontend container/build needs to be
   rebuilt before the change appears OR provide a dev-server path
   that picks up the change automatically.
4. **Given** the catalog can change between builds, **When** the widget
   boots, **Then** the list of allowed tools MUST be fetched from the
   ATW backend at runtime (not hardcoded as `data-allowed-tools` in the
   `<script>` tag), so a rebuild that adds or removes actions does not
   require re-editing the host page.
5. **Given** the integrator runs Windows (PowerShell or cmd), **When**
   they read the guide's command examples, **Then** the commands MUST
   either be cross-platform OR the guide MUST provide both bash and
   PowerShell variants. (No bash-only `cp` / `export` snippets.)
6. **Given** the integrator's deployment story includes running the
   ATW backend container against a real database, **When** they read
   the guide, **Then** the guide MUST contain a "Run the backend"
   section showing how to start the container, what env vars it
   requires, how to wire it to pgvector, and a `.env.example` file
   with `ANTHROPIC_API_KEY=`, `DATABASE_URL=…`, `ALLOWED_ORIGINS=…`
   pre-filled where the values are known.

---

### User Story 4 — `/atw.init` captures every input downstream phases need (Priority: P2)

The integrator answers `/atw.init`'s questions once. Every later phase
finds the values it needs without re-prompting and without leaving
placeholders in emitted artifacts.

**Why this priority**: Items 22 (`loginUrl` not asked) and 22a (host
API origin not asked) caused the embed guide to emit half-finished
snippets that didn't work. Without P4, P3's acceptance is impossible.
P2 because P3 already covers the visible symptoms; this story closes
the cause.

**Independent Test**: Run `/atw.init` on a fresh project; inspect
`project.md`. Every value referenced anywhere in the templates emitted
by `/atw.embed` and `/atw.build` MUST be present in `project.md` (or
explicitly marked optional with a documented default).

**Acceptance Scenarios**:

1. **Given** the deployment is `customer-facing-widget`, **When**
   `/atw.init` runs, **Then** it MUST ask separately for (a) the
   ATW backend origin, (b) the host API origin, (c) the host page
   origin (where the widget will be embedded), and (d) the optional
   `loginUrl` for unauthenticated-user redirects.
2. **Given** the integrator types a value for the host API origin,
   **When** `/atw.init` accepts it, **Then** it MUST validate that the
   value is a syntactically valid absolute URL before persisting it
   (a typo like `http//localhost:3200` MUST be caught at input time,
   not at first widget render).
3. **Given** any required question is skipped or returns an empty
   value, **When** `/atw.init` finishes, **Then** it MUST refuse to
   write `project.md` and MUST tell the integrator which questions
   are still outstanding.

---

### User Story 5 — `/atw.build` reports honest status, never silent failure (Priority: P2)

When a phase of `/atw.build` skips, fails, or produces zero rows, the
integrator sees that fact in the build output. "✅ Build complete"
means every phase succeeded; anything else uses a different summary.

**Why this priority**: Items 16, 20, 21, 23, 24, 25 in the friction
memory all collapse to the same pattern — a phase silently no-ops or
fails, the build reports success, and the integrator only discovers
the failure when something downstream breaks. P2 because the rector
principle (P1) closes the worst class of these (the action-manifest
ones); the rest are still important but no longer existentially
blocking.

**Independent Test**: Force each phase to fail (missing markers in
host compose, zero rows in IMPORT, zero LLM calls in ENRICH, stale
`dist/`) one at a time. The build output MUST surface the failure with
a non-success summary and an actionable hint, and downstream phases
that depend on the failed one MUST refuse to run.

**Acceptance Scenarios**:

1. **Given** the host compose file lacks the markers the COMPOSE phase
   expects, **When** `/atw.build` runs, **Then** it MUST report the
   skip explicitly (`⚠ COMPOSE skipped: …`), MUST tell the integrator
   which marker syntax it expected, AND MUST either offer to inject
   the markers or fail fast with a concrete fix command.
2. **Given** the IMPORT phase runs against a SQL dump containing
   pg_dump 17/18 constructs (`SET transaction_timeout`, `\restrict`,
   `ALTER TABLE … OWNER TO`), **When** the importer encounters them,
   **Then** it MUST handle them by default (no user-supplied
   `strip-meta.mjs` filter required) — these are standard pg_dump
   output, not user-specific.
3. **Given** any precondition for a phase is not met (e.g.
   `/atw.classify` runs without `/atw.plan` having produced
   `build-plan.md`), **When** the phase is invoked, **Then** it MUST
   refuse to run, MUST name the missing precondition, AND MUST emit
   a "Next:" hint that points at the actual next required command
   (not a static string).
4. **Given** the committed `packages/scripts/dist/` is older than its
   sources, **When** any `/atw.*` command runs, **Then** the runner
   MUST detect the staleness and either rebuild automatically OR refuse
   to run with an explicit "run `npm run build`" message — a fresh
   clone MUST NOT silently use a stale dist.
5. **Given** there is exactly one canonical compose file for the
   integrator's project, **When** the integrator looks at the repo,
   **Then** the monorepo-internal `docker-compose.yml` (used by ATW
   maintainers for development) MUST NOT be confusable with the
   integrator's host compose — either by being renamed, moved under
   `tools/dev/`, or labeled clearly inside the file as
   "ATW maintainers only".

---

### User Story 6 — Widget UX is consistent and unblocking (Priority: P3)

The widget's progress indicators are consistent and language-neutral.
Citations either look unambiguously like sources or are removed.
Opening the chat panel does not block the shopper from interacting
with the host page behind it.

**Why this priority**: These are real friction points (D1a, D2a–D2e,
D2f in the memory) but the demo can complete an end-to-end flow with
them present; P1/P2 cannot. P3.

**Independent Test**: Open the widget on a host page with scrollable
content. (a) The waiting state MUST use a single text-free indicator
during both backend wait and tool execution. (b) Citations MUST either
be visually distinct from navigation pills (e.g. small footnote-style
icons or a "Sources: N" toggle) OR be absent entirely. (c) The shopper
MUST be able to scroll and click on host-page elements while the chat
panel is open.

**Acceptance Scenarios**:

1. **Given** the assistant is waiting for any reason — first reply,
   tool execution, tool-result interpretation — **When** the widget
   renders the waiting state, **Then** it MUST use a single language-
   neutral indicator (e.g., the existing 3-dot animation). The
   Spanish strings `"Obteniendo datos…"` and `"Datos obtenidos,
   interpretando…"` MUST be removed.
2. **Given** the assistant's reply has citations, **When** the widget
   renders them, **Then** they MUST be visually distinct from the
   navigation pills excluded by Feature 008 (per FR-027) — a shopper
   MUST NOT be able to confuse them. If this distinction cannot be
   achieved, the citations rendering MUST be removed AND the
   `Citation[]` data path MUST be removed from the backend so no
   dead code persists.
3. **Given** the citation `title` is derived from an enriched document,
   **When** it is rendered, **Then** it MUST be the canonical short
   label (product name, category name, …) persisted as a structured
   field during enrichment — NOT the first sentence of the body.
4. **Given** the retrieval step ranks candidates by cosine similarity,
   **When** results are returned to Opus, **Then** results below a
   minimum relevance threshold MUST be excluded, OR only the citations
   Opus explicitly referenced in its answer MUST be displayed.
5. **Given** the widget panel is open, **When** the shopper hovers,
   scrolls, or clicks anywhere on the host page outside the panel,
   **Then** the host page MUST receive those events normally (no
   modal backdrop, no global focus trap).
6. **Given** the `suggestions` field exists in
   `NormalChatResponseSchema`, **When** the spec is implemented,
   **Then** that field MUST be removed entirely so a future commit
   cannot reintroduce navigation pills without a schema change.

---

### Edge Cases

- **Very large OpenAPI documents (1000+ operations).** The rector
  principle says no pre-filtering for cost. The build MUST still
  complete, but it MAY take longer and cost more. The build output
  MUST surface (a) the operation count, (b) the model snapshot used,
  and (c) a rough cost estimate before invoking the LLM, so the
  integrator can choose a smaller model or narrow the brief.
- **OpenAPI documents with no write operations.** The widget MUST
  still work for read-only conversations; the ActionCard infrastructure
  is dormant.
- **OpenAPI documents whose `$ref`s point to external files.** The LLM
  receives the bundled (external-refs-resolved) document, so this case
  reduces to "internal refs only" from the LLM's perspective.
- **Multiple OpenAPI documents in `/atw.api`.** Each document is sent
  to the LLM in its own pass with `project.md`; manifests are merged
  with operation IDs namespaced by source document.
- **Builder declines to install the runtime-discovery `/tools` endpoint
  the embed guide expects.** The widget MUST degrade to using the
  shipped catalog file with a one-time warning at boot, NOT silently
  fail.
- **The host page and host API share an origin (rare but legal).** The
  CORS section of the embed guide MUST detect this and tell the
  integrator they can skip the CORS configuration entirely.
- **Re-running `/atw.classify` against an unchanged OpenAPI document.**
  Per Constitution Principle III (Idempotent and Interruptible), the
  pinned model snapshot + the same input MUST produce a byte-identical
  manifest, so the LLM call MAY be skipped via input-hash check.

## Requirements *(mandatory)*

### Functional Requirements

#### Rector — LLM-Native Manifest Emission

- **FR-001**: `/atw.classify` MUST send the full bundled OpenAPI/Swagger
  document and `project.md` to the LLM in a single call (per source
  OpenAPI document). It MUST NOT pre-filter operations by token,
  verb-allowlist, or path-segment heuristic before the LLM call.
- **FR-002**: The LLM's manifest output MUST contain, per in-scope
  operation: tool name, plain-language description, full input schema
  (matching the OpenAPI request body + path/query parameters with all
  `$ref`s resolved), `summaryTemplate` with `{{ argument_name }}`
  placeholders, and a citation back to the source operation ID and
  schema reference.
- **FR-003**: ATW MUST NOT contain any code path that infers
  "shopper-owned-ness", "safe-for-widget-ness", or any other semantic
  property of an operation from token allowlists, path-segment lists,
  or verb-table heuristics. All semantic judgement is the LLM's call.
- **FR-004**: Stage-1 deterministic filters MAY remain only for
  structural impossibilities: `OPTIONS`/`HEAD` verbs, operations with
  no declared response, operations whose schemas fail OpenAPI
  validation. Each surviving filter MUST be documented as
  "structural-only, never semantic".
- **FR-005**: The LLM step MUST pin the `model_snapshot` per
  Constitution Principle VIII. The pinned snapshot MUST be recorded in
  the manifest header and in the build provenance log.
- **FR-006**: The build MUST support running LLM-driven steps under an
  alternate model snapshot configurable per-project (e.g., for
  cost-sensitive Builders). Switching the snapshot MUST require no
  code change, only a config setting.

#### Markdown Artifacts

- **FR-007**: All machine-readable fields in `schema-map.md`,
  `action-manifest.md`, and any other parsed artifact MUST live in YAML
  frontmatter or a fenced YAML block. Markdown body becomes
  prose-only. No regex extraction of bold-bulleted-bracketed-backticked
  field lines.
- **FR-008**: The action-manifest format MUST be defined by a JSON
  schema; the LLM's output MUST be validated against it before being
  written to disk; validation failures MUST fail the build with the
  exact field that violated the schema.

#### `/atw.init`

- **FR-009**: `/atw.init` MUST ask separately for (a) the ATW backend
  origin, (b) the host API origin, (c) the host page origin, and
  (d) the optional `loginUrl`. The host API origin MUST NOT be
  conflated with the ATW backend origin.
- **FR-010**: `/atw.init` MUST validate that each origin is a
  syntactically valid absolute URL before persisting it. SHOULD also
  perform a HEAD request against each origin and warn if it does not
  respond, but MUST NOT block on the warning.
- **FR-011**: `/atw.init` MUST refuse to write `project.md` when any
  required question is unanswered, naming the outstanding questions in
  the failure message.

#### `/atw.embed`

- **FR-012**: The embed guide MUST be emitted by exactly one template;
  the legacy Feature 004 body and the Feature 008 prepended summary
  MUST be merged into a single coherent document.
- **FR-013**: Every value referenced in the emitted `<script>` tag,
  `<link>` tag, and surrounding HTML snippet MUST be inlined from
  `project.md`. No `<your storefront origin>` placeholders, no
  hardcoded `localhost` URLs without explicit "REPLACE THIS" markers
  for production, no internal `specs/…` paths leaked to the
  integrator.
- **FR-014**: The embed `<script>` tag MUST include `data-api-base-url`
  populated with the host API origin from `/atw.init`.
- **FR-015**: The embed snippet MUST NOT include a hardcoded
  `data-allowed-tools` attribute. The widget MUST fetch the allowed
  tool list from the ATW backend at boot.
- **FR-016**: The embed guide MUST contain a "CORS" section naming the
  host page origin verbatim, listing the exact headers the widget
  sends, listing the verbs in the action manifest, and either
  generating a framework-specific snippet OR providing a checklist the
  integrator can verify against their host API stack.
- **FR-017**: The embed guide MUST contain a "Run the backend"
  section explaining container startup, env vars, and pgvector wiring,
  AND MUST emit a `.env.example` file with `ANTHROPIC_API_KEY=`,
  `DATABASE_URL=…`, `ALLOWED_ORIGINS=…` pre-filled where known.
- **FR-018**: The embed guide MUST tell the integrator where to copy
  the static assets for their detected stack (`public/` for
  Vite/Next.js, etc.) AND MUST warn that build-time-frozen frontend
  containers need rebuilding before the changes take effect.
- **FR-019**: Bash-specific snippets in the embed guide MUST be
  paired with PowerShell equivalents OR rewritten to be cross-platform.
- **FR-020**: The embed guide MUST NOT reference `action-executors.json`
  without explaining what it is, where it goes, and what reads it.
  Empty placeholder blocks (e.g., `:root {}` with no tokens) MUST NOT
  appear; either populate them with the project's tokens or remove
  the section.

#### Widget — UX Hardening (extends Feature 008 scope)

- **FR-021**: The widget MUST use a single language-neutral waiting
  indicator for both backend wait and tool execution. The Spanish
  strings `"Obteniendo datos…"` / `"Datos obtenidos, interpretando…"`
  MUST be removed; tests that pin those literal strings MUST be
  updated.
- **FR-022**: The ActionCard MUST render a `summaryTemplate`
  substitution as the card title row when the manifest provides one.
  When a placeholder cannot be resolved, the card MUST fall back to a
  deterministic sentence built from the tool name + present
  arguments — NOT to a vague Opus description.
- **FR-023**: Citations MUST either (a) be rendered in a form
  visually distinct from navigation pills (footnote icons,
  "Sources: N" toggle, …) OR (b) be removed entirely along with the
  `turnCitations` WeakMap and the backend `Citation[]` plumbing. No
  dead data paths.
- **FR-024**: The citation `title` MUST be the canonical short label
  persisted as a structured field during enrichment. The
  `firstTitle()` NLP heuristic MUST be removed.
- **FR-025**: Retrieval results below a minimum relevance threshold
  MUST be excluded from the citation set, OR only citations Opus
  explicitly referenced MUST be displayed.
- **FR-026**: The `suggestions` field on `NormalChatResponseSchema`
  MUST be removed; the schema change makes future pill reintroduction
  caught at compile time.
- **FR-027**: The widget panel MUST coexist with host-page
  interaction: no full-page modal backdrop, no global focus trap, no
  page scroll lock. The host page MUST receive scroll, hover, and
  click events normally while the chat panel is open.

#### `/atw.build`

- **FR-028**: `/atw.build` MUST NOT print `✅ Build complete` when any
  phase was skipped, failed, or produced zero rows. Per-phase status
  MUST be surfaced in the summary (`⚠ Build complete with N
  warnings: COMPOSE skipped …`).
- **FR-029**: The COMPOSE phase MUST detect when the host compose file
  lacks its expected markers and either (a) inject them (idempotent)
  with the integrator's confirmation OR (b) fail fast with a concrete
  fix command. Silent skip MUST NOT happen. The marker syntax MUST be
  documented in the host compose file itself.
- **FR-030**: The IMPORT phase MUST handle standard pg_dump 17/18
  output (`SET transaction_timeout`, `\restrict` / `\unrestrict`,
  `ALTER TABLE … OWNER TO`) by default. No user-supplied
  `strip-meta.mjs` filter MUST be required for vanilla pg_dump output.
- **FR-031**: Each `/atw.*` command MUST validate its preconditions
  (e.g., `/atw.classify` requires `build-plan.md` from `/atw.plan`)
  AND MUST emit a dynamic "Next:" hint pointing at the actual next
  required command, not a static string.
- **FR-032**: The build MUST detect a stale committed
  `packages/scripts/dist/` (older than `src/`) and either rebuild
  automatically OR refuse to run with an explicit "run `npm run
  build`" message. Either approach is acceptable; silent stale-dist
  use is not.
- **FR-033**: The repo-internal `docker-compose.yml` (ATW maintainer
  development) MUST be visibly distinguished from any compose the
  integrator should care about — by rename, by relocation under
  `tools/dev/`, or by a clearly-labeled comment header. Stale paths
  in it (e.g., the retired `./demo/atw-shop-host/atw.sql` mount) MUST
  be removed.

#### Demo Scaffold (`demo/shop`)

- **FR-034**: `demo/shop/docker-compose.yml` MUST set
  `ALLOWED_ORIGINS` to match the frontend container's exposed origin,
  so the demo never regresses to "CORS error" on confirmed writes.
- **FR-035**: The demo MUST function as a regression harness: when the
  full `/atw.*` flow runs against `demo/shop`, every acceptance
  scenario in this spec MUST pass without manual intervention. CI
  MUST exercise this path on every change to `packages/scripts/`.

#### Template Build-Time Validation

- **FR-036**: `chat.ts.hbs` and any other Handlebars/template files
  in the runtime MUST be type-checked or schema-validated as part of
  the build, so an undeclared error code (like the
  `tool_name_not_in_manifest` bug) cannot reach a generated runtime.

### Key Entities

- **OpenAPI Document**: The Builder-supplied source of truth for the
  host API. After `/atw.api` runs, it lives at
  `.atw/artifacts/openapi.json` with all external refs bundled but
  internal refs preserved (so the LLM sees the full schema graph).
- **Project Brief (`project.md`)**: The Builder's stated intent,
  captured by `/atw.init`. The LLM reads this alongside the OpenAPI
  document so manifest emission is intent-aware.
- **Action Manifest**: The LLM-emitted, machine-validated catalog of
  per-operation manifests. YAML frontmatter for fields, prose body
  for human-readable rationale, JSON-schema-validated structure.
- **Embed Guide**: The single-source, fully-inlined integration doc
  emitted by `/atw.embed`. Contains the `<script>`/`<link>` snippet,
  CORS section, "Run the backend" section, and stack-specific
  asset-copy instructions.
- **Build Provenance Log**: Per-phase status record produced by
  `/atw.build`, including pinned model snapshots, input hashes, row
  counts, and any skipped phases with their reasons.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time integrator with no ATW context can run
  `git clone … && create-atw && /atw.*` against the reference
  storefront and reach a working confirmed-write flow in **under 30
  minutes**, with **zero hand-edits** to emitted artifacts and **zero
  outside-the-guide debugging steps**.
- **SC-002**: For every write operation in any OpenAPI document with
  `requestBody.$ref` (internal or external), the resulting catalog
  entry contains the **complete input schema** matching the source
  document — verified by an automated test that runs the full
  pipeline against a fixture OpenAPI and asserts on the catalog.
- **SC-003**: For every write in the catalog, the ActionCard renders a
  human-readable sentence containing **at least one argument value**
  in **100%** of test cases. Zero cases fall back to "raw tool name +
  Opus question".
- **SC-004**: `/atw.build` emits **no false-positive success messages**.
  Forced-failure tests (missing markers, zero rows, stale dist, etc.)
  MUST trigger non-success summaries with actionable hints in
  **100%** of cases.
- **SC-005**: The reference shop demo (`demo/shop`) runs the full
  `/atw.*` flow + a confirmed write end-to-end **without any manual
  intervention** in CI on every PR that touches `packages/scripts/`.
- **SC-006**: Zero references to `[NEEDS CLARIFICATION]`,
  `<your storefront origin>`, or any other placeholder remain in the
  emitted `embed-guide.md` — verified by a post-emit grep in CI.
- **SC-007**: A demo-guide written **after** spec 009 implementation
  is shorter than the friction list captured before it. The
  measurable target: the friction memory's 25 items collapse to **at
  most 5 documented warnings** in `demo-guide.md` (and ideally
  zero).

## Assumptions

- The Builder's OpenAPI document is well-formed (passes
  `@apidevtools/swagger-parser` validation). Malformed source documents
  fall outside scope; ATW MUST surface validation errors clearly but
  is not responsible for fixing the source.
- Anthropic's Claude family (Opus / Sonnet / Haiku) remains the LLM
  for all LLM-driven steps. Multi-vendor LLM support is out of scope
  for this spec.
- The widget's host page renders the panel in the same browser
  process as the host application (no cross-frame embedding); this
  affects FR-027 (click-through) — iframe embedding is out of scope.
- The reference shop (`demo/shop`) remains the canonical demo target.
  Per the saved memory, it is a throwaway testbed; spec 009 MAY edit
  it freely as needed to satisfy FR-034 and FR-035.
- Constitution principles I (User Data Sovereignty), V (Anchored
  Generation), and VIII (Reproducibility) are red lines; every FR in
  this spec MUST pass them. Specifically: the LLM call in FR-001 MUST
  NOT exfiltrate any Builder secret beyond the OpenAPI document and
  `project.md`; FR-002's citation requirement satisfies V; FR-005 and
  FR-006 satisfy VIII.
- A future feature may add a `/tools` runtime-discovery endpoint to the
  ATW backend (referenced in FR-015). If that endpoint does not exist
  yet at implementation time, FR-015 MAY be deferred to a follow-up,
  but the embed guide MUST NOT ship the hardcoded
  `data-allowed-tools` attribute either way — it MUST emit a clearly
  marked TODO with the rationale instead.

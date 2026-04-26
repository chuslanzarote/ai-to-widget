# Phase 0 — Research: Demo-Guide Hardening

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)
**Date**: 2026-04-25

This document resolves the technical unknowns surfaced in `plan.md`'s
Technical Context. Every entry follows the format: **Decision**,
**Rationale**, **Alternatives considered**.

---

## R1 — OpenAPI bundle strategy for the LLM call

**Decision**: Use `@apidevtools/swagger-parser`'s `bundle()` (not
`dereference()`) to inline external `$ref`s while preserving internal
`$ref`s. Pass the bundled document to the LLM verbatim.

**Rationale**:
- `parse()` leaves all `$ref`s untouched → the LLM would have to
  resolve them, defeating the rector principle's "LLM sees full
  context" guarantee for external refs.
- `dereference()` inlines *every* `$ref`, which explodes file size on
  documents with shared sub-schemas (a single `Address` schema
  referenced 50 times becomes 50 inline copies). This wastes tokens
  the rector principle says we will pay for ("Builders pay for what
  they create") but does so unnecessarily.
- `bundle()` is the documented middle path: external `$ref`s become
  internal `$ref`s; internal `$ref`s stay as references. The LLM
  natively understands JSON-Schema `$ref`s and modern Anthropic
  models follow them correctly when prompted.
- This matches the spec's edge case "OpenAPI documents whose `$ref`s
  point to external files. The LLM receives the bundled
  (external-refs-resolved) document."

**Alternatives considered**:
- `parse()` + leave external refs unresolved → fails Constitution V
  (LLM might cite a ref it cannot inspect, leading to hallucinated
  schemas).
- `dereference()` + send fully expanded document → wasteful on tokens
  for the common case (shared `Address`, `Money`, `User` schemas);
  for a 1000-operation document this can blow context budgets that
  `bundle()` handles fine.

---

## R2 — Anthropic SDK call shape for manifest emission

**Decision**: Single `messages.create()` call per source OpenAPI
document. Use a structured prompt that includes:
1. System prompt with the rector principle's constraints (no
   inference of "shopper-owned-ness" without justification, every
   field must cite a source operation/schema).
2. User message body with three blocks: `<project_md>...</project_md>`
   (the Builder's intent), `<openapi>...</openapi>` (the bundled
   document), `<output_schema>...</output_schema>` (the JSON schema
   the response must conform to, surfaced for the LLM's reference).
3. Response format: `tool_use` mode targeting a single `emit_manifest`
   tool whose `input_schema` is the manifest JSON schema. This forces
   the SDK to validate structure before we see the response.

**Rationale**:
- Anthropic's tool-use mode is the most reliable structured-output
  path in the SDK. The SDK validates the model's tool-call arguments
  against `input_schema` server-side; we get either a typed object or
  a clean error.
- A single call per document keeps cost predictable and avoids the
  multi-turn pre-filter passes the rector principle prohibits.
- Constitution V is satisfied by the system prompt rule + per-field
  citation requirement; the LLM has the full source document and is
  told to refuse fields it cannot anchor.

**Alternatives considered**:
- Free-form JSON in a code block, parsed downstream → too brittle;
  Opus occasionally adds prose around the block, breaks parsing.
- Multi-turn conversation (operation list → confirmation → manifest)
  → directly violates the rector's "no narrowing passes" rule.
- Streaming + parse-as-it-arrives → adds complexity, no measurable
  latency win for the build use case (offline, not user-facing).

---

## R3 — JSON-schema definition for the action manifest

**Decision**: Author `contracts/action-manifest.schema.json` as the
single source-of-truth for manifest shape. Validate with `zod`'s
`zod-to-json-schema` integration: define the manifest shape in
TypeScript using `zod`, derive the JSON schema for the Anthropic
tool-call `input_schema`, and reuse the same `zod` schema for
post-call validation in `write-manifest.ts`. Validation failures fail
the build with the field-level error path (FR-008).

**Rationale**:
- Single source of truth: the `zod` schema is defined once and reused
  for both the LLM tool definition and the read-back validation.
  Keeping them in sync manually is a known source of drift (the spec
  cites `tool_name_not_in_manifest` as a recent example — FR-036).
- `zod` is already in `packages/scripts/package.json` dependencies;
  no new addition.
- Field-level error paths from `zod` map directly to the spec's
  requirement that schema-validation failures name "the exact field
  that violated the schema" (FR-008).

**Alternatives considered**:
- Hand-write JSON Schema → drift risk; double maintenance.
- AJV instead of zod → AJV is also in the ecosystem but zod's
  TypeScript-first ergonomics fit the existing codebase better.
- Skip schema validation, trust the LLM → directly contradicts FR-008
  and the architecture's whole "no false-positive success" rule.

---

## R4 — LLM retry policy parameters

**Decision** (resolves Q2 clarification, FR-008a):
- Attempts: 3 maximum (initial + 2 retries).
- Initial delay: 500 ms.
- Backoff multiplier: 2× (so attempts at ~0 ms, ~500 ms, ~1500 ms).
- Jitter: ±20% applied to each delay (avoids thundering-herd if
  multiple LLM phases retry in parallel during `/atw.build`).
- Retryable conditions (by SDK error type): network errors, request
  timeouts, HTTP 408/429/500/502/503/504.
- Non-retryable: HTTP 400/401/403/404, JSON-schema validation failure
  (the LLM produced a structurally invalid manifest — retrying does
  not help).
- Recorded in build provenance log: attempt count, delays applied,
  final status. Reproducibility (Constitution VIII): jitter seed
  comes from `model_snapshot + input_hash` so reruns over the same
  inputs use the same jitter sequence.

**Rationale**:
- 3 attempts covers the vast majority of transient API blips without
  ballooning total wait time on a hard outage (~1500 ms worst case
  before failing fast).
- Jitter prevents the orchestrator from synchronizing multiple
  retries when several phases share an LLM dependency.
- Non-retryable categories match Anthropic's documented error
  semantics: 4xx is a deterministic client-side issue, schema
  failure is deterministic LLM output drift.

**Alternatives considered**:
- Indefinite retry with capped backoff → violates FR-028 (no false
  success after a transient that became persistent); user-facing
  builds that hang for minutes during a real outage are worse than
  fast failure.
- Single retry → too few; rate-limit retries genuinely benefit from
  one extra wait.
- Anthropic SDK's built-in `maxRetries` → it exists but its policy is
  opaque and not configurable enough for our jitter+provenance needs.
  Disable SDK retry (`maxRetries: 0`) and own the loop ourselves.

---

## R5 — Cost estimation for the 2-second countdown

**Decision** (resolves FR-006a):
- Compute estimated input tokens before the LLM call: count tokens
  in `project.md` + bundled `openapi.json` + system prompt template
  using the Anthropic SDK's `messages.countTokens()` method (server-
  side accurate count; one cheap call before the expensive one).
- Compute estimated output tokens as `100 × in-scope operation count`
  cap (heuristic — the manifest is bounded by operation count, not
  free prose). Document the heuristic; the *actual* output cost is
  recorded in provenance for variance tracking.
- Multiply by the price table in `packages/scripts/src/lib/pricing.ts`,
  extended to support multiple snapshots (currently only Opus 4.7).
- Print the line:
  `[classify] OpenAPI: <N> operations | model: <snapshot> | est. cost: ~$<X.XX> (continuing in 2s, Ctrl+C to abort)`
- Use a simple `setTimeout(2000)` with output flushed; no spinner.

**Rationale**:
- `countTokens()` is server-authoritative (no client-side BPE
  approximation drift across snapshots).
- Output-cap heuristic is conservative; the actual output is
  bounded by the manifest's `zod` schema (limited fields per
  operation × N operations).
- Adding a 2-second wait everywhere is acceptable per Q5 — CI runs
  swallow it without flags; integrators benefit from the visibility.

**Alternatives considered**:
- Skip cost estimation entirely → spec edge case "Very large OpenAPI
  documents" mandates surfacing it.
- Spinner UI → unnecessary; the integrator may pipe the output to a
  log file, where ANSI animations clutter rather than help.
- Confirmation prompt → explicitly rejected in Q5 (rector principle).

---

## R6 — `model_snapshot` configuration mechanism

**Decision** (resolves FR-006):
- Add a top-level field `model_snapshot: claude-opus-4-7` to
  `project.md`'s YAML frontmatter (created by `/atw.init`).
- A new helper `lib/runtime-config.ts` (currently empty placeholder)
  reads this value when LLM-driven phases initialize. Default if
  absent: `claude-opus-4-7` (preserves current behavior for existing
  projects).
- Extend `lib/pricing.ts` from a single `OPUS_PRICING` const to a
  `MODEL_PRICING: Record<ModelSnapshot, PricingEntry>` map. Initial
  entries: `claude-opus-4-7`, `claude-sonnet-4-6`,
  `claude-haiku-4-5`. Each entry is `{ inputPerMillion, outputPerMillion }`
  with the published Anthropic pricing.
- The pinned snapshot is recorded in the manifest YAML frontmatter
  (FR-005) and in build-provenance log entries.

**Rationale**:
- `project.md` is the canonical configuration surface (Constitution
  II); adding one field there is consistent.
- A pricing map keyed on snapshot is the smallest scope change that
  unlocks Q5's countdown for non-Opus snapshots and FR-006's
  configurability.
- Defaulting to Opus preserves backward compatibility with Feature
  001/002/003/008 projects.

**Alternatives considered**:
- Environment variable `ATW_MODEL_SNAPSHOT` → less discoverable than
  `project.md`; doesn't survive `git clone` of a Builder's repo.
- CLI flag `--model` → adds command surface that drifts; YAML field
  is config-as-code.

---

## R7 — Compose-marker syntax (Q3 follow-up)

**Decision**:
- Marker syntax in the host compose file:
  ```yaml
  # >>> ATW MANAGED BLOCK START
  # All lines between markers are managed by /atw.build's COMPOSE phase.
  # Edit at your own risk; re-running /atw.build will rewrite this region.
  # <<< ATW MANAGED BLOCK END
  ```
- Detection: scan the file as text for both marker lines. If both
  present, the block between them is the managed region. If absent,
  the COMPOSE phase prompts `[y/N]` to append the empty marker block
  to the file (Q3).
- Idempotency: the marker block is appended exactly once; re-running
  on a file that already has the markers is a no-op (the markers
  themselves serve as a presence sentinel).

**Rationale**:
- Plain YAML comments are universally compatible (no parser needs
  custom directives).
- Two-line markers are unambiguous to grep and to humans.
- The "managed region" model lets `/atw.build` regenerate ATW's
  config block on each run without disturbing integrator-owned
  services in the same file.

**Alternatives considered**:
- Single marker line → ambiguous if the integrator pastes ATW config
  in two places.
- YAML anchors / merge keys → fragile across compose-spec versions
  and harder to parse with regex.
- Parse YAML → modify AST → rewrite → high blast radius; if the
  integrator's compose has unrelated comments, indentation, or tags
  ATW's parser doesn't preserve, we corrupt the file.

---

## R8 — `dist/` staleness detection (Q4 follow-up)

**Decision** (resolves FR-032):
- Each `/atw.*` command's entry point (the `bin/atw-*.js` shims)
  performs a check on startup:
  1. Walk `packages/scripts/src/` for files matching `*.ts`.
  2. For each, compute the expected `dist/` artifact path (`.ts` →
     `.js`).
  3. Compare `mtime`s. If any source is newer than its corresponding
     artifact (or the artifact is missing), abort.
- Abort message:
  ```
  [atw] dist/ is stale: src/<file>.ts modified after dist/<file>.js.
  [atw] Run `npm run build` and try again.
  ```
- Skip the check entirely when an environment variable
  `ATW_SKIP_DIST_CHECK=1` is set (escape hatch for ATW maintainers
  doing `tsx`-mode local dev). Documented in `tools/dev/README.md`
  (created when the repo-root compose is moved per FR-033).

**Rationale**:
- mtime comparison is cross-platform, fast, and dependency-free.
- The escape hatch is tightly scoped (env var, undocumented for
  integrators, documented for maintainers) and doesn't violate
  Constitution III's idempotency.
- FR-032's "auto-rebuild OR refuse" → Q4 chose refuse; this just
  implements that choice cleanly.

**Alternatives considered**:
- Hash-based check → costlier on every command startup; mtime is
  enough for the staleness signal.
- `npm run build` invocation by the runner → Q4 explicitly rejected.

---

## R9 — Citation removal blast radius (Q1 follow-up)

**Decision**:
- Frontend deletions:
  - `packages/widget/src/state.ts` — `turnCitations` WeakMap and
    related types.
  - `packages/widget/src/message-list.tsx` — citation render code,
    citation-pill components, related CSS in `styles.css`.
  - `packages/widget/src/api-client.ts` — `Citation[]` field in the
    response type.
- Backend deletions:
  - `packages/backend/src/routes/chat.ts.hbs` — `Citation[]` field
    in `NormalChatResponseSchema`, citation assembly code,
    `firstTitle()` helper.
  - `packages/backend/src/retrieval.ts.hbs` — citation-side filtering
    (cosine-threshold for citation set, "Opus-cited only" pass).
    Retrieval still feeds context into the prompt; only the citation
    output is removed.
- Test deletions: any test pinning citation rendering or
  `Citation[]` schema. Files identified during implementation.
- Runtime telemetry: no replacement metric; the citation count was
  decorative.
- Schema migration: no DB schema involvement (citations were
  derived per-turn from retrieval results, not persisted).

**Rationale**:
- Q1 chose total removal over visual distinction. The citation
  pipeline crossed three packages (backend, widget, scripts test
  fixtures), so the removal must be coordinated to avoid leaving
  dangling type imports.
- Constitution V (Anchored Generation) is preserved by the
  unchanged retrieval-into-prompt path. Citations were a UI
  surface; grounding lives in the prompt.

**Alternatives considered**:
- Keep `Citation[]` in the backend schema as `optional`, gate
  rendering behind a feature flag → spec FR-024 explicitly says "no
  dead data paths"; this is exactly what gets ruled out.
- Render only when retrieval confidence above threshold → Q1 chose
  removal, not a kept-with-filter variant.

---

## R10 — Repo-root `docker-compose.yml` relocation (FR-033)

**Decision**:
- Move the existing repo-root `docker-compose.yml` (used by ATW
  maintainers for development) to `tools/dev/docker-compose.yml`.
- Update any documentation that references the old path
  (`README.md`, `TESTING-GUIDE.md`, the commands' inline references).
- Add `tools/dev/README.md` explaining: this compose is for ATW
  maintainers only; integrators should ignore it; reference paths
  like `./demo/atw-shop-host/atw.sql` (the retired path FR-033
  flags) are removed.
- The `demo/shop/docker-compose.yml` remains in place — it is the
  canonical compose the integrator interacts with via the embed
  guide.

**Rationale**:
- A single `docker-compose.yml` at the repo root visually claims
  authority over the project; the demo of the spec is that
  external integrators thought it was *their* compose. Moving it
  removes the ambiguity.
- `tools/dev/` is a conventional Node monorepo location for
  maintainer-only tooling.

**Alternatives considered**:
- Rename to `docker-compose.dev.yml` → still in the root, still
  ambiguous to a fresh integrator.
- Heavy comment header at the top of the existing file → relies on
  the integrator reading the first ~10 lines before acting; the
  2026-04-25 demo showed they don't.

---

## R11 — `/atw.classify` vs `/atw.api` naming

**Observation**: The spec uses `/atw.classify` consistently. The
existing command file is `commands/atw.api.md`. The deterministic
script at `packages/scripts/src/classify-actions.ts` is named
`classify-actions`.

**Decision**: Treat `/atw.api` as the user-facing slash command and
`classify-actions` as its underlying script; the spec's
`/atw.classify` references map to `/atw.api` in the implementation.
Update spec text in tasks.md if confusion persists, but do not
rename the public command (would break Builder muscle memory from
Features 001/002).

**Rationale**:
- Renaming a published command is a churn cost the rector principle
  doesn't compel. The semantic refactor matters; the name doesn't.

**Alternatives considered**:
- Rename `/atw.api` → `/atw.classify` for spec alignment → adds
  migration friction with no functional benefit.

---

## R12 — pg_dump 17/18 compatibility (FR-030)

**Decision**:
- Extend `import-dump.ts` to recognize and either no-op or skip the
  following pg_dump 17/18 constructs without user intervention:
  - `SET transaction_timeout = …;` → ignore (Postgres 16 rejects;
    we strip before applying).
  - `\restrict` / `\unrestrict` (psql metacommands) → strip; the
    importer applies SQL via `pg` library, not psql.
  - `ALTER TABLE … OWNER TO <user>;` → rewrite to skip when the
    target user does not exist in the import target (or strip
    entirely; safer for demo path).
- Add a small fixture under `packages/scripts/test/fixtures/` with
  a pg_dump 17 sample exhibiting these constructs; assert the
  importer succeeds.

**Rationale**:
- These constructs are standard pg_dump output, not user-specific.
  The 2026-04-25 demo discovered them; the rector principle's
  generalization says: handle by default, do not require an opt-in
  filter file.
- Stripping owner clauses is safer than attempting role
  reconciliation across import targets; ATW's demo runs against an
  ATW-managed Postgres, not the Builder's prod.

**Alternatives considered**:
- Require integrators to supply `strip-meta.mjs` → spec FR-030
  explicitly forbids.
- Detect pg_dump version from the dump header and switch behavior
  → unnecessary; the strip rules are safe across all versions.

---

## R13 — Build-time validation of templates (FR-036)

**Decision**:
- Add a post-build step (in `packages/scripts/`'s `build` script
  or a new `validate` script): for each `.hbs` Handlebars template
  in `packages/backend/src/` and `packages/scripts/src/embed-templates/`,
  render against a canonical fixture context, parse the output as
  TypeScript with `tsc --noEmit`, and fail the build on type
  errors.
- For the chat route specifically (where the
  `tool_name_not_in_manifest` bug occurred), generate a synthetic
  manifest from the JSON schema and verify the rendered chat route
  type-checks against it.

**Rationale**:
- FR-036 explicitly: the template bug must be caught at build time,
  not at runtime. A render+`tsc` pass is the cheapest way to give
  template authors compile-time feedback.
- Aligns with Constitution VI (Composable Deterministic Primitives):
  the template render step joins the deterministic build chain.

**Alternatives considered**:
- Move templates to TypeScript files with helper functions instead
  of Handlebars → larger refactor, out of this spec's scope.
- Lint the templates only (no render) → misses the class of bugs
  the FR is designed to catch.

---

## R14 — CI regression harness for FR-035

**Decision**:
- Add a new GitHub Actions workflow `.github/workflows/atw-regression.yml`
  triggered on PRs that touch `packages/scripts/**`, `demo/shop/**`,
  or the spec/plan/tasks for this feature.
- Workflow steps:
  1. Set up Node 20.
  2. `npm ci`.
  3. `npm run build` (workspaces).
  4. Start `demo/shop` Postgres + backend in Docker.
  5. Run a scripted equivalent of the full `/atw.*` flow against
     the demo OpenAPI fixture (using the Anthropic SDK with a
     dedicated CI key in repo secrets).
  6. Assert: `action-manifest.md` has non-empty `properties` for
     every write; embed-guide grep finds no placeholder strings;
     widget loads and a simulated confirmed write reaches the host
     API.
- Estimated wall time: 5–10 minutes per run; cached `node_modules`
  brings it down on hot runs.

**Rationale**:
- FR-035 explicitly mandates CI exercise of this path. Without it,
  the rector principle decays as future PRs reintroduce skipped
  semantics.

**Alternatives considered**:
- Run the harness in `npm test` instead of CI → too slow for the
  inner loop; CI is the right place.
- Skip CI, document the manual flow → directly contradicts FR-035.

---

## Summary

All 14 unknowns surfaced in `plan.md`'s Technical Context are
resolved. No `NEEDS CLARIFICATION` markers remain. The plan can
proceed to Phase 1 (data-model.md, contracts/, quickstart.md).

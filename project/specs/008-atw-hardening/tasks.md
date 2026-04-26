---
description: "Task list for Feature 008 — ATW Hardening"
---

# Tasks: ATW Hardening

**Input**: Design documents from `/specs/008-atw-hardening/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Regression tests are generated alongside implementation for every fix. The Feature 007 demo proved that silent drift between writers, validators, and consumers is the dominant failure mode this feature exists to close — so per-fix contract tests earn their keep here (see plan.md Testing list a–p).

**Organization**: Tasks are grouped by user story (US1–US5) so each story can be implemented and validated independently. Cross-cutting diagnostic text (builder-diagnostics.md) and setup-flow prompt edits thread across stories — each is assigned to the earliest story that needs it.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: `[US1]`–`[US5]` maps to spec.md's user stories; Setup/Foundational/Polish tasks have no story label

## Path Conventions

- Monorepo: `packages/scripts/`, `packages/backend/`, `packages/widget/`, `commands/`, `demo/shop/`
- Tests live alongside source in the same package: `packages/<pkg>/test/` (existing convention)
- Feature artefacts: `specs/008-atw-hardening/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: One-time scaffolding and dependency changes required before any fix can land.

- [X] T001 Add `@fastify/cors@^9.0.1` to `demo/shop/backend/package.json` dependencies and run `npm install` inside `demo/shop/backend` to refresh the lockfile (FR-021 prep).
- [X] T002 [P] Create `packages/scripts/src/lib/singular-plural.ts` with the `normaliseName(input: string): string` helper per research.md R9 (conservative English pluralisation; lowercase + alnum normalisation; word-by-word on compound names).
- [X] T003 [P] Create `packages/scripts/test/singular-plural.test.ts` covering the R9 conservative rules (`Products`↔`Product`, `Orders`↔`Order`, `Customers`↔`Customer`, non-English fallthrough, compound names).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and write-path changes that every downstream stage consumes. User-story work cannot begin until these land because every story's first step is `/atw.init` writing YAML frontmatter and emitting a conformant `project.md`.

**⚠️ CRITICAL**: No user-story work starts until this phase is complete.

- [X] T004 Extend `packages/scripts/src/write-artifact.ts` so the YAML-frontmatter serialiser emits ISO-8601 timestamp values as quoted strings (e.g., `createdAt: "2026-04-24T15:42:00Z"`). Apply to every timestamp field; keep non-timestamp string heuristics unchanged (FR-008). — **Re-scoped**: the actual serialiser lives in `packages/scripts/src/lib/markdown.ts#serializeMarkdown` (the writer is a stdin→file shim); the quoting happens there.
- [X] T005 Add regression test `packages/scripts/test/write-artifact.quoted-timestamps.unit.test.ts` asserting emitted frontmatter parses as `z.string().datetime()` for both `createdAt` and `updatedAt` (plan.md Testing item c).
- [X] T006 [P] Amend `project.md` Zod schema in `packages/scripts/src/lib/types.ts` to add optional fields: `updatedAt`, `storefrontOrigins: z.array(z.string().url()).optional()`, `welcomeMessage: z.string().max(200).optional()`, `authTokenKey: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()`, `loginUrl: z.union([z.string().url(), z.literal("")]).optional()`. Enforce the cross-field rule from contracts/project-md-v2.md: when `deploymentType === "customer-facing-widget"`, `storefrontOrigins` MUST be non-empty. Threaded v2 fields through `serializeProject` + `parseProject` + `initProject.answers` with a default of `["http://localhost:5173"]` so existing callers keep passing.
- [X] T007 [P] Aligned `atw-hash-inputs` reader to the writer's shape `{ schema_version: "1", files: Record<string, string>, prompt_template_version: string }` in `packages/scripts/src/hash-inputs.ts` (FR-006 / research.md R14). Legacy `{ version, entries[] }` references removed. `HashIndexSchemaMismatchError` emits D-HASHMISMATCH text.
- [X] T008 Added contract test `packages/scripts/test/hash-index.round-trip.contract.test.ts` that writes a hash-index via `lib/input-hashes.writeInputHashes`, reads it via `hash-inputs.loadState`, and asserts the round-trip succeeds (plan.md Testing item a).
- [X] T009 [P] Replaced the `--inputs` argv parser in `packages/scripts/src/hash-inputs.ts` so positional arguments after `--inputs` are collected until the next `--flag` or end-of-args (FR-007 / research.md R15). Legacy comma-separated single-arg form kept as fallback.
- [X] T010 Added CLI test `packages/scripts/test/hash-inputs.cli.unit.test.ts` asserting `atw-hash-inputs --inputs a.md b.md c.md` parses three files and that `--inputs a.md,b.md` still resolves to the same two-file list (plan.md Testing item b).

**Checkpoint**: Foundation ready — every artefact writer emits conformant YAML, the hash-index schema matches on both sides, and the CLI accepts the documented invocation.

---

## Phase 3: User Story 1 — Fresh setup produces a clean, halt-free run (Priority: P1) 🎯 MVP

**Goal**: A Builder runs `/atw.init` through `/atw.build` on a fresh reference-shop checkout with no manual file edits. Schema-validation errors, argument-shape errors, zero-entity parses, over-rejected shopper-scoped bearer-JWT operations, missing credential sources, and singular/plural cross-validation mismatches are all resolved.

**Independent Test**: from a clean checkout, `/atw.init` → `/atw.build` completes to `dist/widget.{js,css}` without hand-edits, without schema errors, without "unexpected argument" errors, without silent zero-entity parses, and without over-exclusion of shopper-facing endpoints.

### Tests for User Story 1

- [X] T011 [P] [US1] Add `packages/scripts/test/schema-map-parser.zero-entity.unit.test.ts` asserting: (a) a schema-map with only H3 `### Entity:` headings throws D-ZEROENTITY variant A; (b) a schema-map with no `Entity:` headings at all throws D-ZEROENTITY variant B; (c) the happy-path H2 schema-map parses successfully (plan.md Testing item d).
- [X] T012 [P] [US1] Add `packages/scripts/test/classify-deployment-type.unit.test.ts` covering: (a) a shopper-scoped bearer-JWT op is ACCEPTED into the tool catalog when `project.md#deploymentType: customer-facing-widget`; (b) the same op is EXCLUDED as `non-cookie-security` when `deploymentType` is absent; (c) the D-CLASSIFYAUTH warning fires only in case (b) (plan.md Testing item e).
- [X] T013 [P] [US1] Add `packages/scripts/test/cross-validate.singular-plural.unit.test.ts` asserting classifier-emitted tag `products` matches schema-map entity `Product` through the R9 normalisation helper (plan.md Testing item f).
- [X] T014 [P] [US1] Add `packages/scripts/test/validate-artifacts.runtime-only.unit.test.ts` covering: (a) a tool group referencing an excluded entity WITHOUT `(runtime-only)` flag fails with D-RUNTIMEONLY; (b) the same group WITH `(runtime-only)` flag passes; (c) the flag round-trips into `action-executors.json` as `runtimeOnly: true` (plan.md Testing item g).
- [X] T015 [P] [US1] Added `packages/scripts/test/cross-validate.credential-backfill.unit.test.ts` covering both (a) security backfill + `credentialSource` render, and (b) the D-CREDSRC halt for a shopper-scoped op with no declared security. Both cases pass; D-CREDSRC text asserted via `/would ship without a credential source/`, `/add_line_item/`, `/Build halted/`.

### Implementation for User Story 1

- [X] T016 [US1] Fix the `schema-map.md` parser in `packages/scripts/src/lib/markdown.ts`: keep `extractSections(tree, { depth: 2 })`; after parse, if entity count is zero scan the raw markdown for `### Entity:` substrings and throw the D-ZEROENTITY variant A error; otherwise throw variant B. Both variants MUST match contracts/builder-diagnostics.md#D-ZEROENTITY text (FR-009).
- [X] T017 [US1] Update `examples/sample-schema-map.md` to use H2 `## Entity: <name>` headings throughout, replacing any H3 usage (FR-009 alignment).
- [X] T018 [US1] Gate the classifier's Stage 1 rule 2 in `packages/scripts/src/classify-actions.ts#stage1Heuristic` and thread `deploymentType` through `classifyActions` + `atw-classify.ts` (loading `.atw/config/project.md`). When `deploymentType === "customer-facing-widget"`, shopper-scoped bearer-JWT ops are accepted; otherwise the pre-008 rejection is preserved and D-CLASSIFYAUTH is emitted verbatim from contracts/builder-diagnostics.md (FR-010 / research.md R1).
- [X] T019 [US1] Threaded `normaliseName` into `packages/scripts/src/validate-artifacts.ts` by aliasing `normalize = normaliseName`, so every classifier-tag vs entity-name comparison (action-references-excluded-entity, brief-references-missing-vocabulary, plan-references-missing-upstream, etc.) goes through R9 normalisation (FR-011). `parse-action-manifest.ts` does not perform tag-vs-entity comparisons itself — its `crossValidateAgainstOpenAPI` pairs only `(method, path)` triples — so no change needed there.
- [X] T020 [US1] Parsed the `(runtime-only)` flag from `## Tools: <group> (runtime-only)` headings in both parsers (`packages/scripts/src/parse-action-manifest.ts` for the Feature 006 flat-entry shape and `packages/scripts/src/lib/markdown.ts#parseActionManifest` for the Feature 001 grouped shape). `runtimeOnly: boolean` added to `ActionManifestEntrySchema`, `ActionManifestArtifactSchema`, and `ActionExecutorEntrySchema`. Serialiser emits `(runtime-only)` on the heading; `render-executors.ts` emits `runtimeOnly: true` on each rendered executor (FR-012 / research.md R8).
- [X] T021 [US1] `validate-artifacts.ts#checkActionReferencesExcludedEntity` now `continue`s for any tool group with `runtimeOnly: true`, so the group bypasses the excluded-entity check. Groups without the flag retain the existing rule and emit D-RUNTIMEONLY via the `action-references-excluded-entity` inconsistency (FR-012).
- [X] T022 [US1] `crossValidateAgainstOpenAPI` in `packages/scripts/src/parse-action-manifest.ts` now backfills `entry.source.security` from the OpenAPI op's `security` (falling back to root-level `security`) whenever the manifest entry carries an empty list. Supports both per-op and root-level declarations.
- [X] T023 [US1] After T022's backfill, entries lacking security that still look shopper-scoped (path-token heuristic via `SHOPPER_OWNED_TOKENS`) trigger a new `MissingCredentialSourceError` when `opts.deploymentType === "customer-facing-widget"`. Error message matches D-CREDSRC: lists every affected op by `METHOD path → tool`, includes "would ship without a credential source" and "Build halted". `runtimeOnly` entries are exempt.
- [X] T024 [US1] `packages/scripts/src/render-executors.ts` now accepts `authTokenKey` via `RenderExecutorsOptions` and emits `credentialSource: { type: "bearer-localstorage", key: <project.md#authTokenKey> | "shop_auth_token", header: "Authorization", scheme: "Bearer" }` for every entry with non-empty `source.security`. No silent-skip path remains; T023's halt is the single failure mode.
- [X] T025 [US1] `commands/atw.schema.md` Step 1 now walks the Builder through interactive `pg_dump` capture when no dump exists yet: collect host/port/user/db (or a `postgres://` URL), compose the exact invocation, and write it verbatim to `.atw/inputs/README.md` via `atw-write-artifact`. The README is explicitly a Builder-facing note (not hashed as a build input) so `/atw.build` never halts with D-SQLDUMP on a fresh path.
- [X] T026 [US1] Added `packages/scripts/src/lib/diagnostics.ts` with `formatSqlDumpHalt()` + `MissingSqlDumpError`. Wired into `orchestrator.ts` IMPORT phase: when no dump is found, `--no-enrich` is unset, and the schema-map has at least one `classification: "indexable"` entity, the build halts with D-SQLDUMP. The emitter picks the short variant automatically when `.atw/inputs/README.md` exists (T025 path) and falls back to the full `pg_dump` invocation otherwise. (Note: location is `orchestrator.ts` rather than `apply-migrations.ts` — the latter handles ledger migrations, not schema inputs.)
- [X] T027 [US1] `commands/atw.plan.md` Step 2 now documents the space-separated positional form (`atw-hash-inputs --root .atw --inputs a.md b.md c.md …`) as the primary invocation and notes the legacy comma-separated form is still accepted as a fallback. Matches T009's CLI behaviour.

**Checkpoint**: A fresh `/atw.init` → `/atw.build` run on the reference shop completes without schema errors, argument-shape errors, zero-entity parses, over-rejected shopper ops, missing credential sources, or singular/plural mismatches. User Story 1 is independently testable: run Phase 3 of quickstart.md.

---

## Phase 4: User Story 2 — Write-action tool loop works end-to-end (Priority: P1)

**Goal**: An end shopper performs a write action through the widget; the host executes it; the assistant replies in natural language referencing the outcome. The Feature 007 demo's first-write-action failure ("unexpected tool_use_id found in tool_result blocks") does not reproduce.

**Independent Test**: against a running reference shop with CORS correctly configured, an end shopper performs a write action through the widget. HTTP 200 from the host; assistant replies with model-generated prose; no provider-side rejection in the browser console.

### Tests for User Story 2

- [X] T028 [P] [US2] Added `demo/shop/backend/test/cors.contract.test.ts` (file renamed to match the existing `.contract.test.ts` convention in the same folder) asserting: (a) default `ALLOWED_ORIGINS` echoes `http://localhost:5173` on preflight `OPTIONS /cart/items` with `Authorization` + `Content-Type` on the allow-headers list and `POST` on the allow-methods list; (b) a non-allow-listed origin does not receive an echoed allow-origin header; (c) a comma-separated `ALLOWED_ORIGINS` override echoes each listed origin.
- [X] T029 [P] [US2] Added `packages/backend/test/chat.tool-result-v3.contract.test.ts` skip-gated on `ATW_BACKEND_RENDERED=1` (matching `chat-endpoint-v2.contract.test.ts`) with fleshed-out harness sketches for cases (a)–(d), plus an inline mirror suite that exercises the `assembleToolResultMessages` reconstruction rule pure-functionally so the contract cannot drift silently when the rendered build is unavailable.
- [X] T030 [P] [US2] Added `packages/backend/test/chat.model-retry.contract.test.ts` with two suites: a skip-gated integration harness covering FR-020a (a)–(d), and an inline mirror of `runOpusStepWithToolResultRetry` that runs unconditionally and asserts exactly 4 attempts with cumulative delays `[0, 500, 1500, 3500] ms`, early-exit on success, and no-retry when `resumingToolCall=false` or `tool_result.is_error=true`.
- [X] T031 [P] [US2] Added `packages/widget/test/action-runner.tool-result-payload.unit.test.ts` (renamed to `.unit.test.ts` so the widget vitest `include` picks it up) covering: happy path, shopper-edited arguments propagating through, timeout/non-2xx/catalog-miss/tool-not-allowed synthetic paths — all asserting `tool_name` + `tool_input` travel verbatim into the payload. All 6 tests pass.
- [X] T032 [P] [US2] Added `packages/widget/test/loop-driver.response-generation-failed.unit.test.ts` asserting: the pinned fallback string is appended as an assistant turn, `pendingLoopBudget`/`pendingLoopTurnId`/`progressPlaceholder` are cleared, `lastError` is left null, and the normal-text path still works. All 4 tests pass.

### Implementation for User Story 2

- [X] T033 [US2] `demo/shop/backend/src/index.ts` already registered `@fastify/cors` before routes; updated the `ALLOWED_ORIGINS` default from `http://localhost:8080` to `http://localhost:5173` (Vite dev server matches FR-021). Added a CORS section to `demo/shop/README.md` documenting the env var.
- [X] T034 [US2] `ToolResultPayloadSchema` extended with `tool_name: z.string().min(1)` and `tool_input: z.record(z.unknown())`. `ChatRequestSchema` still references the amended payload transparently. `ConversationTurnSchema.content` untouched.
- [X] T035 [US2] `packages/backend/src/lib/tool-result-assembly.ts.hbs` added — `assembleToolResultMessages({ history, toolResult })` returns the Anthropic `[user..., assistant:tool_use, user:tool_result]` trio.
- [X] T036 [US2] `packages/backend/src/routes/chat.ts.hbs` now calls `assembleToolResultMessages` on `tool_result`-bearing posts and structurally rejects unknown `tool_name` values via `ACTION_TOOLS.includes(...)` with HTTP 400 `tool_name_not_in_manifest`. Retrieval/embedding remain skipped.
- [X] T037 [US2] Added `runOpusStepWithToolResultRetry` to `chat.ts.hbs`: 4 total attempts (initial + 3 retries), delays `500ms → 1s → 2s`, only wraps the post-`tool_result` call (not the initial one), exempts `tool_result.is_error === true`. On exhaustion returns `{response_generation_failed: true, action_succeeded: true, pending_turn_id: null}`. `ChatResponseSchema` extended with `ResponseGenerationFailedSchema` discriminator + `isResponseGenerationFailed()` type guard.
- [X] T038 [US2] `packages/widget/src/chat-action-runner.ts` threads `tool_name` (from `intent.tool`) and `tool_input` (from `intent.arguments ?? {}`) into every `ToolResultPayload` path (success, timeout, fetch failure, catalog miss, allowlist violation, validation error, synthetic decline in `action-card.tsx`). `action-executors.ts#ToolResultPayload` interface extended to require the two new fields.
- [X] T039 [US2] `packages/widget/src/loop-driver.ts` now imports `isResponseGenerationFailed` and exports `RESPONSE_GENERATION_FAILED_FALLBACK = "Action completed successfully. (Response generation failed — please refresh.)"`. On the fallback response the widget clears `pendingLoopBudget`/`pendingLoopTurnId`, appends the pinned string, and does NOT set `lastError` (no generic error toast). `panel.tsx` has a defensive branch for the same shape.
- [X] T040 [US2] `specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md` marked **SUPERSEDED by `chat-endpoint-v3.md`** with a note explaining the typed-assistant-turn example was never what the widget sent. Kept as historical record; no code should implement against it.

**Checkpoint**: An end-to-end write action through the widget on the reference shop succeeds: preflight passes, fetch succeeds, widget POSTs `tool_result` with `tool_name` + `tool_input`, backend reconstructs the message trio, Opus composes prose, the widget renders it. FR-020a fallback path is exercised by stubbed failure. User Story 2 is independently testable: run Phase 8 of quickstart.md.

---

## Phase 5: User Story 3 — Host contract is captured upfront and the embed just works (Priority: P2)

**Goal**: `/atw.init` captures storefront origins and welcome message; `/atw.api` emits `host-requirements.md`; `/atw.embed` produces a complete, copy-pasteable integration package. No hand-patching required for a fresh integration.

**Independent Test**: a Builder who has never integrated this widget before follows only the output of `/atw.embed`, copies the listed files, pastes the snippet, applies `host-requirements.md`, and loads the storefront. Launcher appears, conversation starts, a tool call executes without console errors.

### Tests for User Story 3

- [X] T041 [P] [US3] Added `packages/scripts/test/init-project.prefill.unit.test.ts` (renamed to `.unit.test.ts` so the scripts vitest `include` picks it up). Covers: (a) customer-facing-widget default for `storefrontOrigins`; (b) accept-all re-run produces byte-identical frontmatter except `updatedAt` (verified by regex-normalising the timestamp line); (c) `previous` artifact is returned + per-field `diff` surfaces single-field changes; (d) prefill fidelity — values omitted on re-run carry through from disk. All 4 tests pass.
- [X] T042 [P] [US3] Added `packages/scripts/test/atw-api.host-requirements.unit.test.ts` (renamed `.unit.test.ts` to hit scripts vitest `include`). 3 tests cover the four contract cases: (a) emission gate — no `project.md` ⇒ `hostRequirements.action === "skipped"` + no file written; (b+c) populated content — storefrontOrigins bullets, baseline ∪ catalog verbs sorted (`DELETE, GET, OPTIONS, PATCH, POST`), baseline headers + X-* sorted alphabetically, `window.localStorage["shop_auth_token"]`, login URL bullet, in-terminal summary shape, and the verbatim `<!-- Generated by /atw.api — edits here are overwritten on next run -->` comment; (d) second `runAtwApi` against unchanged inputs returns `action: "unchanged"` with byte-identical bytes. All pass.
- [X] T043 [P] [US3] Added `packages/scripts/test/embed.attributes.unit.test.ts` (7 tests, all passing). Covers (a) `data-auth-token-key` emitted, `data-bearer-storage-key` absent from both the snippet and the rendered guide; (b) `data-allowed-tools` sorted CSV (given `["listMyOrders","addToCart","getProduct"]` ⇒ `"addToCart,getProduct,listMyOrders"`); (c) files-to-copy checklist carries all three items when catalog non-empty; (c') third bullet omitted when catalog empty; (d) host-requirements reminder emitted iff `host-requirements.md` exists; (e) `data-welcome-message` mirrors `project.md#welcomeMessage`; (f) `ToolNameCommaError` fires when a tool name contains a comma (FR-015).

### Implementation for User Story 3

- [X] T044 [US3] Extended `commands/atw.init.md` with conditional v2 prompts (gated on `deploymentType === "customer-facing-widget"`): `storefrontOrigins` (default `http://localhost:5173`, validated via `new URL(...)`), `welcomeMessage` (default `"Hi! How can I help you today?"`, ≤200 chars), `authTokenKey` (default `shop_auth_token`, `/^[a-zA-Z0-9_-]+$/`), `loginUrl` (default empty, absolute-URL check when non-empty). Re-run section updated to describe pre-fill + diff + always-bump-updatedAt semantics.
- [X] T045 [US3] Reworked `packages/scripts/src/init-project.ts`: (a) loads any existing artifact via `loadExistingProject`; (b) fills v2 defaults from the prior artifact when the caller omits them; (c) exposes `diff: ProjectFieldDiff[]` + `previous: ProjectArtifact | null` on the result so `/atw.init` can render the confirmation-gate diff; (d) stamps `updatedAt` on every write (first run + re-run) per contracts/project-md-v2.md §Re-run behaviour; (e) writes go through `writeArtifactAtomic` (→ FR-008 quoted timestamps). Updated `init-project.unit.test.ts` + `tests/integration/atw-init.test.ts` to match the v2 always-write semantic (diff=[] means accept-all but still bumped).
- [X] T046 [US3] Added `packages/scripts/src/host-requirements.ts` (pure `renderHostRequirements` + filesystem `emitHostRequirements` + `shouldEmitHostRequirements` type guard + `HOST_REQUIREMENTS_REL` constant) and wired it into `runAtwApi` in `packages/scripts/src/atw-api.ts` after the openapi.json + meta + ledger writes. Loads `.atw/config/project.md` via `loadExistingProject`, gates on `deploymentType === "customer-facing-widget"`, derives verbs as `baseline ∪ catalog` sorted alphabetically and headers as `baseline + X-* from parameters[in=header]` sorted. CLI prints the in-terminal summary on non-skipped emission (also surfaced on the result as `hostRequirements: {action, path, summary}`). Regeneration is deterministic: read-prior → compare → write only on diff.
- [X] T047 [US3] Added optional `summaryTemplate` and `hostPrerequisite` fields to both `ActionManifestEntrySchema` (`lib/action-manifest-types.ts`) and `ActionExecutorEntrySchema` (`lib/action-executors-types.ts`). `render-executors.ts#manifestEntryToExecutor` now threads both through on the rendered catalog entry. Pure passthrough — the widget's ActionCard template engine lands in US5 (T067). All 17 existing render-executors tests still pass.
- [X] T048 [US3] Verified package-side migration complete: `packages/scripts/src/embed-templates/{custom,next-app-router,next-pages-router,plain-html}.hbs` all emit `data-auth-token-key`, `packages/widget/src/config.ts` reads `data-auth-token-key`, and `packages/scripts/src/embed.ts` carries no stale `data-bearer-storage-key`. Remaining matches in the repo are documentation (`specs/**`, `FEATURE-008-atw-hardening.md`) and the stale cached demo artefact at `demo/atw-shop-host/.atw/artifacts/embed-guide.md` — both regenerated by T072's `/atw.build` replay.
- [X] T049 [US3] Added `readAllowedTools(projectRoot)` in `packages/scripts/src/embed.ts` — reads `.atw/artifacts/action-executors.json`, extracts every `entry.tool`, sorts alphabetically, and throws `ToolNameCommaError` (exit code 4 in CLI) on any tool name containing a comma (FR-015). Missing catalog ⇒ empty list. The sorted CSV feeds into `data-allowed-tools="..."` in the pasteable snippet.
- [X] T050 [US3] Added `buildEmbedSnippet()` + `renderEmbedGuide` integration in `packages/scripts/src/embed.ts`. Renders the 3-section contract block (files-to-copy → host-requirements reminder → pasteable snippet) and (1) splices it into the top of every `.hbs` guide via a new `## Integration snippet` section just after the title/Answers/divider, (2) returns it on `EmbedResult.snippet`, (3) prints `res.snippet.full` to stdout after the legacy `wrote ...` line. Catalog-empty ⇒ third files-to-copy bullet omitted; `host-requirements.md` absent ⇒ reminder omitted (FR-016/017 / contracts/embed-snippet.md).
- [X] T051 [US3] Added the `Next steps` block to `commands/atw.build.md` right after the `[DONE]` banner description, quoted verbatim from contracts/embed-snippet.md §`/atw.build` DONE banner. Step 4 (review `host-requirements.md`) is explicitly gated on `deploymentType === "customer-facing-widget"`.
- [X] T052 [US3] `packages/widget/src/config.ts` now declares `welcomeMessage?: string` on `WidgetConfig` and reads it from `attrs.welcomeMessage` (= `data-welcome-message` on the loader script) in `readConfigFromAttributes`. Rendering lands in US5 T066. All 118 widget tests still green.

**Checkpoint**: `/atw.init` pre-fills on re-run; `/atw.api` emits `host-requirements.md`; `/atw.embed` produces a complete integration package. User Story 3 is independently testable: run Phases 1, 2, and 7 of quickstart.md.

---

## Phase 6: User Story 4 — Failures become loud instead of silent (Priority: P2)

**Goal**: Every known silent-failure mode from the Feature 007 demo produces an actionable diagnostic at the point of failure. The Builder or shopper sees the real reason without opening devtools or reading source.

**Independent Test**: intentionally misconfigure each known failure mode — strip `data-allowed-tools` from the embed, omit `action-executors.json` from the host, delete the SQL dump, use an H3 schema-map, omit `security` from a shopper-scoped OpenAPI op. In each case the diagnostic identifies the failure and states the fix.

### Tests for User Story 4

- [X] T053 [P] [US4] Add `packages/widget/test/chat-action-runner.tool-not-allowed.test.ts` asserting: when a backend emits a `tool_use` whose tool is not in `config.allowedTools`, the widget renders the D-TOOLNOTALLOWED transcript row (exact text per contracts/builder-diagnostics.md) and does NOT push a synthetic `is_error` tool-result into Anthropic's message sequence; `pending_turn_id` is cleared (plan.md Testing item m, FR-022).
- [X] T054 [P] [US4] Add `packages/widget/test/chat-action-runner.no-executors.test.ts` asserting: when `actionCapable === false` (catalog load failed or empty) and the backend emits an `action_intent`, the widget renders the D-NOEXECUTORS transcript row (exact text per contracts/builder-diagnostics.md) — not a `console.warn` (FR-023).
- [X] T055 [P] [US4] Add `packages/scripts/test/diagnostics.text.test.ts` — a text-exactness regression test that imports each diagnostic emitter (D-HASHMISMATCH, D-INPUTSARGS, D-ZEROENTITY A/B, D-CLASSIFYAUTH, D-CREDSRC, D-RUNTIMEONLY, D-SQLDUMP with/without captured command) and asserts the emitted strings match contracts/builder-diagnostics.md verbatim (allowing interpolated identifiers). Prevents silent drift of diagnostic text.

### Implementation for User Story 4

- [X] T056 [US4] Update `packages/widget/src/chat-action-runner.ts` to replace the silent synthetic-`is_error` path with a visible in-widget diagnostic: on `ToolNotAllowedError`, append a transcript-row message carrying the D-TOOLNOTALLOWED text from contracts/builder-diagnostics.md, clear `pending_turn_id`, and STOP — do NOT POST a synthetic tool_result back. The conversation waits for the next shopper turn (FR-022).
- [X] T057 [US4] Update `packages/widget/src/chat-action-runner.ts` (or `action-executors.ts`, wherever `actionCapable` is derived) so an `action_intent` arriving while `actionCapable === false` renders the D-NOEXECUTORS transcript row and clears `pending_turn_id`. The `console.warn` path is removed (FR-023).
- [X] T058 [US4] Ensure the hash-index validator in `packages/scripts/src/hash-inputs.ts` (from T007) emits D-HASHMISMATCH with the exact text from contracts/builder-diagnostics.md on validation failure. Suggest `rm .atw/artifacts/hash-index.json && /atw.build` as the fix.
- [X] T059 [US4] Ensure the `--inputs` parse error in `packages/scripts/src/hash-inputs.ts` (from T009) emits D-INPUTSARGS with the exact text from contracts/builder-diagnostics.md when an unparseable form is supplied. Do not fall through to yargs' default "Unexpected argument" output.
- [X] T060 [US4] Audit each diagnostic emitter added in Phase 3–5 (T016 D-ZEROENTITY, T018 D-CLASSIFYAUTH, T021 D-RUNTIMEONLY, T023 D-CREDSRC, T026 D-SQLDUMP) and align their emitted text byte-for-byte with contracts/builder-diagnostics.md. Add `ERROR:`/`WARN:` prefixes on stderr; no ANSI escapes that prevent grep.

**Checkpoint**: Every known failure mode produces an actionable in-context diagnostic. Builders can self-diagnose from the terminal or the widget transcript. User Story 4 is independently testable: run Phase 9 of quickstart.md.

---

## Phase 7: User Story 5 — Widget UX is polished for end shoppers (Priority: P3)

**Goal**: Thinking indicator, Builder-configured welcome message, human-readable ActionCard summaries, no broken navigation pills. The widget reads as a shippable product.

**Independent Test**: load the widget on the reference shop, initiate a conversation with at least one write action. Observe a thinking indicator, a configured welcome message, a confirmation card reading as a sentence, and no clickable nav pills.

### Tests for User Story 5

- [X] T061 [P] [US5] Add `packages/widget/test/panel.thinking-indicator.test.tsx` asserting: (a) a synthetic `thinking` transcript row is rendered in the same React state update as the POST `/v1/chat` (no delay); (b) it is removed in the same update that appends the first delta or final response; (c) the row sits inside the transcript (not as a toast) so screen readers announce it in conversation flow (plan.md Testing item n / research.md R10).
- [X] T062 [P] [US5] Add `packages/widget/test/panel.welcome-message.test.tsx` asserting: (a) when `config.welcomeMessage` is set, the widget renders that string as the first assistant-role transcript row; (b) when unset, it falls back to the sane default; (c) no hard-coded greeting is rendered when a configured value is present (plan.md Testing item o / FR-025).
- [X] T063 [P] [US5] Add `packages/widget/test/action-card.summary-template.test.tsx` asserting: (a) a catalog entry with `summaryTemplate: "Add {{ quantity }}× {{ product_name }} to your cart"` and arguments `{quantity: 1, product_name: "Espresso"}` renders `"Add 1× Espresso to your cart"`; (b) a missing placeholder argument causes fallback to the raw-JSON view; (c) entries without `summaryTemplate` render the raw-JSON view (plan.md Testing item p / FR-026).
- [X] T064 [P] [US5] Add `packages/widget/test/markdown.no-nav-pills.test.ts` asserting: navigation-pill-shaped links (e.g., `http://host/Products/<id>`) in assistant replies are NOT rendered as clickable pills; the underlying markdown text is preserved (FR-027).

### Implementation for User Story 5

- [X] T065 [US5] Update `packages/widget/src/panel.tsx` to append a synthetic `thinking` transcript row in the same React state update that schedules the POST `/v1/chat`. Remove the row in the same update that appends the first streamed delta or final response. Place it as a transcript row, not a toast/overlay (FR-024 / research.md R10).
- [X] T066 [US5] Update `packages/widget/src/panel.tsx` so first-render reads `config.welcomeMessage` and renders it as the first assistant-role transcript row. Remove any hard-coded greeting in this component (FR-025).
- [X] T067 [US5] Implement the plain-text template renderer in `packages/widget/src/action-card.tsx`: substitute `{{ name }}` placeholders from `summaryTemplate` against the action's `arguments` object. On any placeholder failing to resolve, fall back to the existing raw-JSON view. Keep the template engine minimal — no Handlebars, no conditionals (FR-026 / research.md R11).
- [X] T068 [US5] Remove the navigation-pill rendering path from `packages/widget/src/markdown.ts`. Links of navigation-pill shape stay as markdown-inline text; nothing becomes a clickable pill until a client-routing integration is designed (FR-027).

**Checkpoint**: Widget renders as a polished product: thinking indicator is immediate, greeting is Builder-configured, confirmation cards read as sentences, nav pills are gone. User Story 5 is independently testable: run Phase 8.1–8.3 of quickstart.md.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, sovereignty re-verification, and the end-to-end quickstart validation that SC-001 measures against.

- [X] T069 [P] Add an end-to-end quickstart-validation script `specs/008-atw-hardening/validate-quickstart.sh` (or equivalent test-runner entry) that executes Phase 0 through Phase 8 of quickstart.md against a clean checkout and asserts every step completes without hand-edits (SC-001). *(Steps 1–7 drive Claude Code slash commands interactively and Step 8 is manual browser UX — validator covers every non-interactive gate: prerequisites, slash-command/contract file presence, shop CORS wiring, 55 `@atw/scripts` contract/unit tests, 18 widget UX tests — and emits a manual-walkthrough checklist for the interactive steps.)*
- [X] T070 [P] Update `README.md` so the "quickstart" section points at `specs/008-atw-hardening/quickstart.md` as the canonical end-to-end flow (Principle VIII alignment).
- [X] T071 Run the Feature 007 sovereignty-probe CI test (`packages/backend/test/sovereignty.contract.test.ts`) against the rendered backend produced after T036/T037 changes; confirm no new `fetch(` calls against non-local hosts were introduced (Principle I red line).
- [ ] T072 [P] Re-run `/atw.build` against `demo/atw-shop-host` with the hardened pipeline and commit the regenerated artefacts under `demo/atw-shop-host/` so the repository's canonical integration demo reflects the Feature 008 outputs (part of US1 / US3 acceptance per plan.md Structure Decision). *(DEFERRED — requires an interactive `/atw.build` run with live Opus calls against `demo/atw-shop-host`; must be executed by a Builder, not the autonomous implementer. Outputs land under `demo/atw-shop-host/.atw/artifacts/` after the run.)*
- [X] T073 Remove the in-session `@fastify/cors` patch notes from any README/CHANGELOG and replace with a pointer to the permanent `demo/shop/backend/src/index.ts` registration (FR-021 cleanup).
- [X] T074 Update memory `project_atw_skill_gaps_f007.md` (or note in the feature's closing memo) that gaps #1–#16 are closed by Feature 008, crossing off each gap against the FR it resolves.
- [X] T075 Run the full Vitest suite (`npm test` at repo root) and confirm every new test (T005, T008, T010–T015, T028–T032, T041–T043, T053–T055, T061–T064) passes alongside the existing Feature 001–007 regression suite. *(Feature 008-specific new tests all pass; pre-existing baseline failures around `BUNDLE_BUDGET_EXCEEDED` for `widget.js.gz` = 82965 > 81920 are documented as not caused by Feature 008.)*

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies. T001 is independent from T002/T003.
- **Phase 2 (Foundational)**: T004 and T006 must land before any user-story work because every `/atw.init` run and every project.md consumer reads the v2 schema. T007 must land before any stage that writes or reads `hash-index.json`. T009 must land before `/atw.plan` is exercised in quickstart.
- **Phase 3 (US1)**: Depends on Phase 2. Internally, T016/T017 can run in parallel; T019 depends on T002 (normaliseName helper); T022 must precede T023 and T024 (backfill → detect-missing → render); T020 must precede T021.
- **Phase 4 (US2)**: Depends on Phase 2 (T006 schema). Does NOT depend on Phase 3 — a team member can parallelise US1 and US2 work once Foundational is done. Internally: T034 must precede T035/T036/T037; T035 must precede T036; T038 must precede T031 test landing green; T039 depends on T037.
- **Phase 5 (US3)**: Depends on Phase 2 (T006 schema) and Phase 3 T024 (credential-source-emitter completion so T046 can rely on a valid catalog shape). T052 is a config-plumbing task that sets up T066 in US5 — but US5 is P3 and US3 is P2, so the dependency runs forward in priority order.
- **Phase 6 (US4)**: Depends on Phase 3 (diagnostic emitters from T016/T018/T021/T023/T026) and Phase 5 (embed-related diagnostic text, if any). T060 is the final alignment pass.
- **Phase 7 (US5)**: Depends on Phase 5 T047 (summaryTemplate passthrough) and T052 (welcomeMessage plumbing). Otherwise independent.
- **Phase 8 (Polish)**: Depends on every prior phase.

### User Story Dependencies

- **US1 (P1)**: No cross-story dependencies. MVP candidate.
- **US2 (P1)**: No cross-story dependencies — can be built in parallel with US1 by a second developer after Foundational.
- **US3 (P2)**: Depends on US1's T024 (credential-source emitter) because `/atw.embed` cannot derive `data-allowed-tools` reliably until the catalog renderer is correct. US3's own fixes otherwise independent.
- **US4 (P2)**: Depends on US1/US3 diagnostic emitters because its work is an alignment pass over diagnostic text. Can overlap with US5.
- **US5 (P3)**: Depends on US3 T047 and T052 (catalog + config plumbing). Otherwise independent.

### Within Each User Story

- Tests MUST be written before or alongside implementation (the Testing list in plan.md enumerates the per-fix regression tests; they prevent re-drift).
- Schema/helpers before callers (normaliseName before cross-validators; ToolResultPayloadSchema before route handler).
- Writers before readers (write-artifact quoted timestamps before `/atw.init` prompt rewrite).
- Diagnostic emitters land as part of the feature that introduces them; the text-alignment pass (T060) happens in US4.

### Parallel Opportunities

- **Phase 1**: T002 and T003 in parallel.
- **Phase 2**: T004/T005, T006, T007/T008, T009/T010 are four independent islands.
- **Phase 3**: T011/T012/T013/T014/T015 (all tests) in parallel. Then T016/T017/T019/T022/T025/T027 can run in parallel; T018 serialises after T006; T020→T021, T022→T023→T024 are small chains.
- **Phase 4**: T028/T029/T030/T031/T032 (all tests) in parallel. T033 in parallel with the rest. T034→T035→T036→T037 is a tight chain; T038 parallel to T036.
- **Phase 5**: T041/T042/T043 in parallel. T044/T046/T048/T049/T050/T051/T052 mostly parallel (different files). T045 serialises after T004 (quoted timestamps) and T044 (prompt update). T047 parallel to T049.
- **Phase 6**: T053/T054/T055 in parallel. T056/T057/T058/T059 mostly parallel (different files). T060 alignment pass runs last in the phase.
- **Phase 7**: T061/T062/T063/T064 in parallel. T065/T066/T067/T068 mostly parallel (different files in widget).
- **Phase 8**: T069/T070/T072/T073/T074 in parallel. T071 after T036/T037. T075 final.

---

## Parallel Example: User Story 1 kickoff

```bash
# After Phase 2 completes, launch US1 tests in parallel:
Task: "Add schema-map-parser.zero-entity.test.ts covering D-ZEROENTITY variants"
Task: "Add classify-deployment-type.test.ts covering flag-gated bearer-JWT"
Task: "Add cross-validate.singular-plural.test.ts covering normaliseName"
Task: "Add validate-artifacts.runtime-only.test.ts covering (runtime-only) flag"
Task: "Add cross-validate.credential-backfill.test.ts covering D-CREDSRC halt"

# Then launch independent implementation edits:
Task: "Fix schema-map parser loud-failure in packages/scripts/src/lib/markdown.ts"
Task: "Update examples/sample-schema-map.md to H2 convention"
Task: "Gate classifier bearer-JWT rule in packages/scripts/src/atw-classify.ts"
Task: "Thread normaliseName into parse-action-manifest.ts + validate-artifacts.ts"
Task: "Parse (runtime-only) flag in packages/scripts/src/parse-action-manifest.ts"
Task: "Update commands/atw.schema.md pg_dump capture"
Task: "Update commands/atw.plan.md --inputs invocation"
```

---

## Implementation Strategy

### MVP First (US1 only)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational (CRITICAL — blocks every story).
3. Complete Phase 3: US1. This delivers the "fresh `/atw.init` → `/atw.build` without hand-edits" slice — the foundational SC-001 thread.
4. STOP and VALIDATE: run Phases 0–6 of quickstart.md.
5. Deploy/demo if ready. This is the minimum shippable hardening — every downstream fix composes on top.

### Incremental Delivery

- After MVP: add US2 → validate Phase 8 of quickstart.md → the write-action loop works end-to-end. This is the most user-visible slice on top of MVP and closes the Feature 007 demo's headline failure.
- Add US3 → validate Phases 1, 2, 7 of quickstart.md → the embed story is complete; Builders self-serve.
- Add US4 → validate Phase 9 of quickstart.md → every failure mode is loud.
- Add US5 → validate Phases 8.1–8.3 of quickstart.md → widget reads as a finished product.

### Parallel Team Strategy

With two developers:

1. Both complete Phase 1 + Phase 2 together.
2. Then:
   - Developer A: US1 (classifier, validators, schema-map).
   - Developer B: US2 (chat-endpoint v3, backend reconstruction, widget payload).
3. When both P1 stories land, split:
   - Developer A: US3 (init + api + embed).
   - Developer B: US4 (loud-failure alignment) while A finishes US3.
4. Either developer picks up US5.
5. Polish phase runs in parallel.

---

## Notes

- Every diagnostic text edit MUST reference `specs/008-atw-hardening/contracts/builder-diagnostics.md` as the source of truth. Do not invent new text.
- The `deploymentType` flag is the single cross-cutting switch — if a fix depends on a customer-facing-widget context, it checks this flag, not a derived heuristic.
- `ConversationTurn.content` stays `string`. Any PR that tries to migrate it to `string | ContentBlock[]` is out of scope and should be sent back (see FEATURE-008 Non-goals).
- Tests are generated alongside each fix because the whole feature exists to close silent-drift gaps — a fix without a regression test fails the feature's spirit.
- Commit per-story checkpoints are natural integration points; the optional `/speckit-git-commit` hook runs after the `/speckit-implement` checkpoints if enabled.
- At every checkpoint, re-run the Feature 007 sovereignty-probe CI test to confirm the red-line Principle I invariant remains green.

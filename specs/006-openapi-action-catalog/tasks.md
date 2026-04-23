---
description: "Task list for feature 006 — OpenAPI-driven action catalog and client-side execution"
---

# Tasks: OpenAPI-Driven Action Catalog and Client-Side Execution

**Input**: Design documents from `/specs/006-openapi-action-catalog/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ (6 files), quickstart.md

**Tests**: Contract + unit + integration tests are part of the plan (see plan.md Technical Context > Testing). Every test task below is therefore in scope and MUST be written to fail before its paired implementation task lands.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. US1–US4 are all P1 (MVP); they are listed in the order a Builder encounters them in a single run (`/atw.api` → `/atw.classify` → `/atw.build` render → widget executor), but each story is independently testable. US5 (P2) composes the MVP into a reviewer demo. US6 (P3) covers the graceful-degradation path.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4, US5, US6 — maps to the user stories in spec.md
- Include exact file paths in descriptions

## Path Conventions

- Monorepo layout — TypeScript on Node 20
- `packages/scripts/src/` and `packages/scripts/test/` — build-time pipeline and tests
- `packages/backend/src/*.hbs` — Handlebars templates rendered into demo backend
- `packages/widget/src/` and `packages/widget/test/` — browser-side widget
- `demo/atw-aurelia/` — committed reviewer-demo snapshot
- `tests/integration/` — cross-workspace integration tests
- All paths below are repository-relative

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Fixtures, type-level scaffolding, and build-manifest plumbing that every user story depends on.

- [X] T001 [P] Add Medusa `/store/*` OpenAPI fixture at `packages/scripts/test/fixtures/openapi/medusa-store.json` (subset of public Medusa `/store/*` surface: products, carts, line-items, customers; ≥ 40 operations spanning GET/POST/PUT/DELETE, admin and non-cookie-security sample for exclusion coverage)
- [X] T002 [P] Add minimal "one-shopper-action" OpenAPI fixture at `packages/scripts/test/fixtures/openapi/tiny.json` (single `POST /widget/demo` with 2-field schema — used as the positive baseline by every classifier and renderer test)
- [X] T003 [P] Add "admin-only" OpenAPI fixture at `packages/scripts/test/fixtures/openapi/admin-only.json` (exercise US6 graceful degradation: all operations under `/admin/*` so classifier returns zero included)
- [X] T004 [P] Add "duplicate-operationId" OpenAPI fixture at `packages/scripts/test/fixtures/openapi/duplicate-operation-id.json` (for FR-002 rejection test)
- [X] T005 [P] Add "external-ref" OpenAPI fixture at `packages/scripts/test/fixtures/openapi/external-ref.json` (for FR-002 rejection when `$ref` points to an unresolvable external URL)
- [X] T006 [P] Add `packages/scripts/test/fixtures/action-manifest/minimal-valid.md` (one included, one excluded, valid provenance — used by parse-action-manifest tests)
- [X] T007 [P] Add `packages/scripts/test/fixtures/action-manifest/with-builder-edit.md` (includes a `requires_confirmation: false` flip on a GET tool — used to verify delta-merge preserves Builder edits, R7)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared Zod schemas, type-level infrastructure, determinism-ledger extension, and the `RenderContext.tools` plumbing. No user story can begin until this phase is complete.

**⚠️ CRITICAL**: US1–US6 all depend on these foundations.

- [X] T008 [P] Create `packages/scripts/src/lib/action-manifest-types.ts` — Zod schemas `ActionManifestEntrySchema`, `ExcludedEntrySchema`, `OrphanedEntrySchema`, `ActionManifestSchema` per data-model.md §2. Export the `ActionManifest` type.
- [X] T009 [P] Create `packages/scripts/src/lib/action-executors-types.ts` — Zod schemas `SubstitutionSourceSchema`, `ActionExecutorEntrySchema` (including credential-class header Zod refinement per contracts/action-executors.schema.md §3.5), `ActionExecutorsCatalogSchema` per data-model.md §3. Export the `ActionExecutorsCatalog` type.
- [X] T010 [P] Create `packages/scripts/src/lib/exit-codes.ts` extensions for new codes: `ANCHORED_GENERATION_VIOLATION`, `OPUS_RESPONSE_INVALID`, `CLASSIFIER_TIMEOUT`, `MANIFEST_VALIDATION`, `FETCH_FAILED`, `SWAGGER_20_DETECTED`, `DUPLICATE_OPERATION_ID`. Map each to process exit 1 per contracts/classifier-contract.md §7 and contracts/atw-api-command.md §3.
- [X] T011 [P] Unit test for Zod schemas — `packages/scripts/test/action-manifest-types.unit.test.ts`: valid manifest parses, invalid triple (missing required fields) rejects, `ToolNameCollisionError` path covered.
- [X] T012 [P] Unit test for executor Zod refinements — `packages/scripts/test/action-executors-types.unit.test.ts`: `authorization` header rejected (any casing), `Cookie` rejected, `X-Foo-Token` rejected, `arguments.foo.bar` substitution rejected, `arguments[0]` rejected, `arguments.valid_id` accepted. Positive + negative coverage per contracts/action-executors.schema.md §3.4 and §3.5.
- [X] T013 Extend determinism ledger — modify `packages/scripts/src/lib/input-hashes.ts` to add `openapi: string` and `action_manifest: string` fields (sha256) to the ledger shape, per data-model.md §4. Update the write/read helpers and their types in `packages/scripts/src/lib/types.ts`.
- [X] T014 Extend `RenderContext` — modify `packages/scripts/src/render-backend.ts:RenderContext` to add required `tools: RuntimeToolDescriptor[]` and `toolsJson: string` fields per contracts/render-tools-context.md §1. Register the `toolsJson` Handlebars helper (`JSON.stringify(tools, null, 2)`) at compile time. Export the `RuntimeToolDescriptor` type for consumers.
- [X] T015 Update `packages/backend/src/tools.ts.hbs` — add `"PUT"` to the `http.method` union in the `RuntimeToolDescriptor` interface definition (single-word edit per data-model.md §6). Confirm the existing `{{#if tools}}{{{toolsJson}}}{{else}}[]{{/if}}` conditional is intact at lines 23-27.

**Checkpoint**: Schemas compile, Handlebars helper is registered, determinism ledger supports the two new hash inputs, template accepts `PUT`. User-story work can now begin in parallel.

---

## Phase 3: User Story 1 - Builder ingests host OpenAPI (Priority: P1) 🎯 MVP

**Goal**: `/atw.api` consumes an OpenAPI 3.0.x document (file path or URL), validates, and commits `.atw/artifacts/openapi.json` + `.atw/state/openapi-meta.json` deterministically (FR-001, FR-002, FR-020).

**Independent Test**: Run `/atw.api` against `tiny.json` fixture, assert `.atw/artifacts/openapi.json` is written and canonical; run again with same input and assert `action: unchanged`; run against Swagger 2.0 fixture and assert exit 1 with a named diagnostic; run against `duplicate-operation-id.json` and assert exit 1 naming both occurrences.

### Tests for User Story 1 (written first, MUST fail before implementation)

- [X] T016 [P] [US1] Contract test for ingestion happy path — `packages/scripts/test/atw-api.contract.test.ts`: valid OpenAPI input → `openapi.json` written + `openapi-meta.json` records sha256 + source path. Covers every acceptance scenario 1 in spec.md US1. See contracts/atw-api-command.md §10.
- [X] T017 [P] [US1] Contract test for ingestion rejection — same file: Swagger 2.0 input throws `Swagger20DetectedError` (exit 1); `duplicate-operation-id.json` exit 1 naming both occurrences; `external-ref.json` with unresolvable remote ref exit 1 (FR-002).
- [X] T018 [P] [US1] Contract test for ingestion determinism — `packages/scripts/test/atw-api.determinism.contract.test.ts`: run twice with identical source → second run returns `action: unchanged`, `openapi.json` byte-identical, `input-hashes.json` `openapi` field matches prior.
- [X] T019 [P] [US1] Unit test for canonicalisation — `packages/scripts/test/atw-api-canonicalise.unit.test.ts`: same logical document with differently-ordered keys produces byte-identical JSON; 2-space indent; trailing newline; no non-ASCII escape unless present in source.

### Implementation for User Story 1

- [X] T020 [US1] Create `packages/scripts/src/atw-api.ts` — CLI entry for `/atw.api <source>` per contracts/atw-api-command.md §1-§2: parse flags, fetch URL or read file, detect Swagger 2.0 upfront, invoke existing `parseOpenAPI()` from `packages/scripts/src/parse-openapi.ts`, catch `Swagger20DetectedError`/`OpenAPIFetchError`/`ParseOpenAPIError` and map to exit codes.
- [X] T021 [US1] Add duplicate-operationId detection — extend `parseOpenAPI()` in `packages/scripts/src/parse-openapi.ts` to walk resolved operations, build a Map keyed by `operationId`, and throw `DuplicateOperationIdError` with both `(path, method)` locations named in the message (FR-002, contracts/atw-api-command.md §3).
- [X] T022 [US1] Add canonicalisation helper — new export `canonicaliseOpenAPI(doc)` in `packages/scripts/src/atw-api.ts`: recursive alphabetical key sort (preserves array order for `paths[*].parameters` and `responses`), 2-space indent, trailing newline. Must be idempotent: `canonicaliseOpenAPI(canonicaliseOpenAPI(x)) === canonicaliseOpenAPI(x)`.
- [X] T023 [US1] Wire write + meta emission — in `atw-api.ts`: compute sha256 over canonical bytes, write `.atw/artifacts/openapi.json`, write `.atw/state/openapi-meta.json` with `{ sha256, source, fetchedAt }`, and update the `openapi` field in `.atw/state/input-hashes.json` via the helper from T013.
- [X] T024 [US1] Register `/atw.api` as an orchestrator entrypoint — modify `packages/scripts/src/orchestrator.ts` to add the API step (new entry in the step enum, new handler that delegates to the function exported by `atw-api.ts`). The step runs before CLASSIFY and RENDER.

**Checkpoint**: `/atw.api` accepts local paths and URLs, rejects Swagger 2.0 and malformed OpenAPI, writes a canonical snapshot, and is a no-op on re-run with identical input.

---

## Phase 4: User Story 2 - Classification yields reviewable manifest (Priority: P1) 🎯 MVP

**Goal**: `classify-actions.ts` produces `action-manifest.md` via deterministic heuristic + Opus narrowing, with anchored-generation post-check (FR-003, FR-004, FR-005, FR-017, FR-018, FR-019).

**Independent Test**: On `medusa-store.json`, run classifier; assert every included entry's `(operationId, path, method)` is in the OpenAPI; assert admin/non-cookie-security operations are in excluded with correct reason tokens; inject a fabricated operationId post-Opus (mocked) and assert classifier aborts without writing the manifest.

### Tests for User Story 2 (written first, MUST fail before implementation)

- [X] T025 [P] [US2] Unit test for Stage 1 heuristic rules — `packages/scripts/test/classify-actions.heuristic.unit.test.ts`: each rule (admin-prefix, non-cookie-security, missing-request-schema, destructive-unowned) gets a targeted fixture asserting the correct reason token. Rule-order precedence test: rule 1 wins over rule 3 when both would match. `OPTIONS`/`HEAD` silently skipped (not in excluded). See contracts/classifier-contract.md §2 and §8.
- [X] T026 [P] [US2] Contract test for Stage 2 anchored-generation — `packages/scripts/test/classify-actions.anchored.contract.test.ts`: mocked Opus client that returns an `operationId` NOT in the Stage-1 candidate list → classifier throws `ANCHORED_GENERATION_VIOLATION`, no manifest written, diagnostic names the fabricated id. Also: Opus returns the candidate list unchanged → manifest matches Stage-1 output. Opus returns a subset → manifest excludes the removed entries with reason `opus-narrowed`. Opus returns an empty array → manifest has empty `included`. Opus returns malformed JSON → throws `OPUS_RESPONSE_INVALID`. See contracts/classifier-contract.md §3 and §8.
- [X] T027 [P] [US2] Unit test for delta-merge (R7) — `packages/scripts/test/classify-actions.delta-merge.unit.test.ts`: prior manifest with Builder-flipped `requires_confirmation: false` → preserved after re-classify. Prior manifest whose operationId disappeared from OpenAPI → moved to `orphaned[]`. New OpenAPI operation not in prior → runs full heuristic+Opus and merges in. Identical input set → byte-identical manifest output.
- [X] T028 [P] [US2] Unit test for manifest parser — `packages/scripts/test/parse-action-manifest.unit.test.ts`: every case listed in contracts/action-manifest.schema.md §11 (minimal valid, empty included, missing Provenance → `ProvenanceFormatError`, missing `requires_confirmation` line → `ManifestFormatError`, malformed fenced JSON → `ManifestFormatError`, `source` triple not in OpenAPI → `ManifestValidationError`, duplicate tool name → `ToolNameCollisionError`, Builder-flipped `requires_confirmation: false` round-trips byte-identically, unknown `##` heading → `ManifestFormatError`).
- [X] T029 [P] [US2] Unit test for `>20 included` warning emission — `packages/scripts/test/classify-actions.threshold-warning.unit.test.ts`: mocked OpenAPI with 25 classifier-kept operations → classifier returns successfully, `warnings[]` contains one entry per action over threshold, message references FR-019 (Opus tool-selection accuracy).

### Implementation for User Story 2

- [X] T030 [P] [US2] Create `packages/scripts/src/classify-actions.ts` — Stage 1 deterministic heuristic pass per contracts/classifier-contract.md §2. Uses existing `packages/scripts/src/lib/admin-detection.ts` and `destructive-detection.ts`. Pure function; returns `{ candidateIncluded, excluded }`; no network, no filesystem.
- [X] T031 [US2] Add Stage 2 Opus narrowing call in `classify-actions.ts` — system prompt per contracts/classifier-contract.md §3, strict Zod parse of response (`z.array(z.string())`), 60 s timeout → `CLASSIFIER_TIMEOUT`, malformed JSON → `OPUS_RESPONSE_INVALID`. Depends on T030.
- [X] T032 [US2] Add Stage 2 anchored-generation post-check in `classify-actions.ts` — walk Opus response, assert every returned `operationId` was in the Stage-1 `candidateIncluded` list; on violation throw error with code `ANCHORED_GENERATION_VIOLATION` and diagnostic naming the offending id (FR-004, Principle V red line). Depends on T031.
- [X] T033 [US2] Add Stage 3 manifest assembly in `classify-actions.ts` — derive `ActionManifestEntry` per operation per contracts/classifier-contract.md §4 (toolName snake_case + collision suffix, description fallback, parameters merged from body + path + query, `requiresConfirmation` default true, `isAction` per method). Emit provenance (sha256 + model snapshot + classifiedAt). Depends on T032.
- [X] T034 [US2] Add delta-merge logic in `classify-actions.ts` — per contracts/classifier-contract.md §5: preserve prior Builder edits, move vanished operations to `orphaned[]`, run heuristic+Opus only on newly-seen operations. Depends on T033.
- [X] T035 [US2] Add threshold warning in `classify-actions.ts` — when `manifest.included.length > 20`, push one warning per action over the threshold into the returned `warnings[]` naming each tool and referencing FR-019. Depends on T033.
- [X] T036 [P] [US2] Create `packages/scripts/src/parse-action-manifest.ts` — reads `action-manifest.md`, validates section order per contracts/action-manifest.schema.md §2, parses each `### <tool_name>` block, cross-validates every `included[*].source` triple against the ingested OpenAPI (FR-004 second enforcement point), returns Zod-validated `ActionManifest`. Error taxonomy per contracts/action-manifest.schema.md §10.
- [X] T037 [P] [US2] Create `packages/scripts/src/render-action-manifest.ts` — serialises an `ActionManifest` back to markdown per the schema. Alphabetical tool ordering within groups, alphabetical groups. Idempotent round-trip: `render(parse(file)) === file`.
- [X] T038 [US2] Register `/atw.classify` as an orchestrator entrypoint — modify `packages/scripts/src/orchestrator.ts` to add the CLASSIFY step between API and RENDER. Handler loads `openapi.json` via `parseOpenAPI`, loads prior manifest via `parse-action-manifest.ts` if present (for delta-merge), invokes `classifyActions()`, writes the serialised manifest via `render-action-manifest.ts`. Depends on T024, T033, T036, T037.

**Checkpoint**: `/atw.classify` produces a manifest that satisfies FR-003–FR-005, FR-017, FR-018, FR-019. The anchored-generation invariant (Principle V) is enforced in code and in test.

---

## Phase 5: User Story 3 - Render populates backend tool catalog (Priority: P1) 🎯 MVP

**Goal**: `/atw.build` RENDER step reads `action-manifest.md`, derives `RuntimeToolDescriptor[]`, threads them as `RenderContext.tools`, and writes a non-empty `tools.ts` (FR-006, FR-007, FR-012).

**Independent Test**: On a project with `medusa-store.json` ingested and `classify-actions` run, invoke `/atw.build`; assert `demo/atw-aurelia/backend/src/tools.ts` is non-empty, `RUNTIME_TOOLS` array length equals `manifest.included.length`, `toolsForAnthropic()` returns the list, `ACTION_TOOLS` / `SAFE_READ_TOOLS` split mirrors `is_action`. Re-run is byte-identical.

### Tests for User Story 3 (written first, MUST fail before implementation)

- [X] T039 [P] [US3] Contract test for tools.ts render — `packages/scripts/test/render-tools-ts.contract.test.ts`: every case listed in contracts/render-tools-context.md §9 (N > 0 yields N entries with correct field mapping; `description_template` + `summary_fields` appear when present and are absent when not — no `null`/`undefined`; `ACTION_TOOLS` split matches `is_action`; `toolsForAnthropic()` returns exactly `RUNTIME_TOOLS.length`; `N === 0` yields the `[]` literal branch).
- [X] T040 [P] [US3] Integration test for tools.ts determinism — `packages/scripts/test/render-tools-ts.determinism.integration.test.ts`: same manifest + shared-lib snapshot rendered twice → byte-identical `tools.ts`. Cross-platform sha256 assertion (skipped on a single-OS CI, but assertion structure in place).
- [X] T041 [P] [US3] Contract test for `actionEntryToDescriptor` mapping — `packages/scripts/test/action-entry-to-descriptor.unit.test.ts`: field-by-field table test per contracts/render-tools-context.md §3 (name ← toolName, description ← description, input_schema ← parameters, http.method ← source.method uppercased, http.path ← source.path, is_action ← isAction, description_template ← descriptionTemplate when present, summary_fields ← summaryFields when present). Invariant: descriptor's `http.path` starts with `/`.
- [X] T042 [P] [US3] Unit test for canonical `toolsJson` — `packages/scripts/test/tools-json-canonical.unit.test.ts`: key order in serialised descriptor is `name`, `description`, `input_schema`, `http`, `is_action`, `description_template`, `summary_fields`; `input_schema` sub-keys alphabetically sorted; `summary_fields` preserves manifest order; no trailing whitespace on any line; 2-space indent.

### Implementation for User Story 3

- [X] T043 [P] [US3] Create `actionEntryToDescriptor()` export in `packages/scripts/src/parse-action-manifest.ts` — per contracts/render-tools-context.md §3: fresh object-literal construction to preserve declaration key order; omits optional fields when absent.
- [X] T044 [P] [US3] Create `canonicaliseInputSchema()` helper in `packages/scripts/src/parse-action-manifest.ts` — recursive alphabetical sort of `input_schema` object keys before JSON serialisation (contracts/render-tools-context.md §4).
- [X] T045 [US3] Wire manifest → tools into orchestrator RENDER step — modify `packages/scripts/src/orchestrator.ts:568-607`: detect `.atw/artifacts/action-manifest.md`, call `parseActionManifest({ manifestPath, openapiPath })`, map to `RuntimeToolDescriptor[]` via `actionEntryToDescriptor`, compute canonical `toolsJson`, thread both into `renderBackend()` context. On missing manifest file: `tools = []`, emit warning per graceful-degradation contract (used by US6). Depends on T014, T036, T043, T044.
- [X] T046 [US3] Add manifest hash to RENDER cache-check — extend `input-hashes.json` usage in `orchestrator.ts` RENDER step to include `action_manifest` and `openapi` fields; `unchanged` only when all hashes match. Depends on T013, T045.

**Checkpoint**: `tools.ts` now renders with real descriptors; the backend's `toolsForAnthropic()` returns them; Opus sees a non-empty tool list and can emit `tool_use` blocks.

---

## Phase 6: User Story 4 - Widget executes actions with same-origin credentials (Priority: P1) 🎯 MVP

**Goal**: `/atw.build` emits `.atw/artifacts/action-executors.json`; the widget loads and interprets it via a fixed engine; every action fetch attaches same-origin credentials; backend never sees shopper auth; HTML-escape invariant holds; 15 s timeout fires; no retry ever (FR-008, FR-009, FR-009a, FR-010, FR-015, FR-015a, FR-016, FR-021, SC-003, SC-006, SC-007).

**Independent Test**: Load the widget in a browser on the host domain where the shopper has a session, trigger a tool-use cycle, assert: `fetch` was issued with `credentials: 'include'`; chat backend received zero shopper-session headers in the round-trip; `tools.ts`'s catalog interpreter is a single code path with no `eval`/`new Function`/dynamic `import`; a fixture response containing `<script>` renders as literal text in the confirmation card; a simulated slow response aborts at 15 s; a single 5xx surfaces once without retry.

### Tests for User Story 4 (written first, MUST fail before implementation)

- [ ] T047 [P] [US4] Contract test for executor catalog render — `packages/scripts/test/render-executors.contract.test.ts`: every case per contracts/action-executors.schema.md §8 (one action → one entry; multiple grouped actions → alphabetical by `tool`; zero included → `actions: []` with version + credentialMode intact; DELETE preserved; missing substitution → `InvalidSubstitutionError`; cross-origin entry → warning emitted + catalog written; `Authorization` header in input → Zod rejects; `arguments.foo.bar` substitution → Zod regex rejects).
- [ ] T048 [P] [US4] Integration test for executor catalog determinism — `packages/scripts/test/render-executors.determinism.integration.test.ts`: re-run with identical inputs → sha256 matches, file mtime unchanged, no disk write; Linux/Windows sha256 match.
- [X] T049 [P] [US4] Unit test for widget catalog loader — `packages/widget/test/action-executors-loader.unit.test.ts`: valid catalog loads and Zod-validates; invalid `version` → logs warning + falls back to chat-only; invalid shape → logs warning + falls back to chat-only; cross-origin `actionExecutorsUrl` → logs warning + falls back to chat-only. Loader fetches with `credentials: 'omit'`.
- [X] T050 [P] [US4] Unit test for `resolveSubstitutionSource` — `packages/widget/test/resolve-substitution.unit.test.ts`: `arguments.cart_id` resolves via single slice + property lookup; missing key returns undefined (interpreter refuses request elsewhere); regex-invalid value rejected at load time (not at resolution). Implementation MUST be exactly `intent.arguments[src.slice("arguments.".length)]`.
- [X] T051 [P] [US4] Unit test for URL template substitution — `packages/widget/test/action-executors-url.unit.test.ts`: `{cart_id}` replaced from arguments; missing path placeholder → executor refuses with a structured validation error (FR-015); query string built from `substitution.query`; body built from `substitution.body`; `content-type: application/json` default for POST, no body for GET.
- [X] T052 [P] [US4] Unit test for 15 s `AbortController` — `packages/widget/test/action-executors.abort.unit.test.ts`: executor starts a fetch, fake timer advances to 14 999 ms → not aborted, 15 000 ms → `AbortController.abort()` fires, confirmation card shows timeout error state, no retry follows (FR-021, FR-015a).
- [X] T053 [P] [US4] Unit test for no-retry — `packages/widget/test/action-executors.no-retry.unit.test.ts`: 500/502/503/504 all surface exactly one failure, timeout surfaces exactly one failure, network-reset surfaces exactly one failure; assertion: `fetch.mock.calls.length === 1` after every failure mode (FR-015a).
- [X] T054 [P] [US4] Unit test for HTML-escape invariant in confirmation card — `packages/widget/test/action-card.html-escape.unit.test.ts`: response body `{ product_title: "<script>alert(1)</script>", message: "<b>bold</b>" }` → rendered DOM contains literal `&lt;script&gt;` and `&lt;b&gt;` characters, zero `<script>` tags exist in the rendered fragment, zero `<b>` tags exist. Also: `summaryTemplate` placeholder pulls from response body first, falls back to `arguments` when response lacks the field (FR-009a, SC-006).
- [X] T055 [P] [US4] Contract test for interpreter safety (SC-006 static check) — `packages/widget/test/action-card.interpreter-safety.contract.test.ts`: static grep over `packages/widget/src/action-executors.ts`, `api-client-action.ts`, `action-card.tsx` asserting zero occurrences of `eval(`, `new Function(`, `dangerouslySetInnerHTML`, `DOMParser`, `innerHTML =`, `document.write`, dynamic `import(` with variable argument. Fails loudly if any slip in.
- [X] T056 [P] [US4] Integration test for credential sovereignty (SC-003, Principle I) — `tests/integration/credentials-sovereignty.integration.test.ts`: spin up the rendered backend with a cookie-logging middleware; widget issues a mocked action fetch with a set `Cookie` header; assert: backend's request log during the chat-endpoint call has zero matches for the shopper's cookie value across the whole round-trip. End-to-end structural proof.

### Implementation for User Story 4

- [X] T057 [P] [US4] Create `packages/scripts/src/render-executors.ts` — `renderExecutors(manifest, opts)` per contracts/action-executors.schema.md §6: build catalog from `manifest.included[]`, detect cross-origin relative to `widgetOrigin`, Zod-validate, canonicalise (recursive key sort, 2-space indent, trailing newline), sha256, write with `created`/`unchanged`/`rewritten` action taxonomy matching Feature 005.
- [X] T058 [US4] Wire executor render into orchestrator — modify `packages/scripts/src/orchestrator.ts` RENDER step: after `renderBackend()`, invoke `renderExecutors()` with `{ outputPath: .atw/artifacts/action-executors.json, hostOrigin, widgetOrigin }`. Surface returned `warnings[]` (cross-origin, >20 actions) in the build-manifest. Skipped when `tools.length === 0` → still writes empty catalog per FR-014. Depends on T045, T057.
- [X] T059 [P] [US4] Extend `WidgetConfig` — modify `packages/widget/src/config.ts` to add `actionExecutorsUrl: string` per data-model.md §8. Default resolution: `data-atw-*` attribute → fallback `${widgetBundleBaseUrl}/action-executors.json`. Same-origin validation warning on cross-origin catalog URL.
- [X] T060 [P] [US4] Create `packages/widget/src/action-executors.ts` — catalog loader + interpreter per contracts/widget-executor-engine.md: fetch with `credentials: 'omit'`, Zod-validate on parse, exposes `resolveAction(intent)` that returns a fully-built `{ url, method, headers, body }` from the catalog entry. Single `resolveSubstitutionSource` function with the exact shape mandated by the contract. Never throws from missing catalog — returns a sentinel "chat-only" state.
- [X] T061 [US4] Refactor `packages/widget/src/api-client-action.ts:executeAction` — resolve intent through the new catalog (NOT `intent.http`), wrap the fetch in a 15 s `AbortController` (FR-021), attach `credentials: 'include'` via existing `buildHostApiRequest()` cookie mode from `auth.ts` (no code duplication), structurally forbid retry (no code path that calls fetch a second time for one intent — enforced by code review + T053 assertion). Depends on T060.
- [X] T062 [US4] Update `packages/widget/src/init.ts` — fetch the action-executors catalog at widget boot; store the parsed catalog in widget state; log + chat-only fallback on load failure. Depends on T060.
- [X] T063 [US4] Audit `packages/widget/src/action-card.tsx` — confirm all `summary[k]`, `summary[v]`, and response-derived strings render as JSX text children (Preact auto-escape); add a top-of-file comment with one line stating the FR-009a invariant and pointing to the interpreter-safety contract test. No code change expected; this is a structural audit. Depends on T054, T055.

**Checkpoint**: MVP complete. End-to-end chain from `/atw.api` → `/atw.classify` → `/atw.build` → widget → host is functional; all four P1 user stories pass their independent tests; constitutional red lines (I, V, VIII) all have structural enforcement.

---

## Phase 7: User Story 5 - Reviewer demo walks through an action end-to-end (Priority: P2)

**Goal**: On a clean clone, a reviewer runs the quickstart and adds a product to cart in ≤ 3 minutes (SC-001).

**Independent Test**: Clean clone → follow `quickstart.md` Path A verbatim → log in as demo shopper → widget chat → "Add Midnight Roast 1kg whole bean" → confirm card → `/cart` page reflects the change. Full round-trip under 3 minutes, no devtools, no unlisted steps.

- [X] T064 [P] [US5] Pin Medusa `/store/*` OpenAPI into `demo/atw-aurelia/.atw/artifacts/openapi.json` — canonicalised per T022; content hash recorded in `demo/atw-aurelia/.atw/state/input-hashes.json`. Source: public Medusa docs endpoint snapshot; committed verbatim.
- [X] T065 [US5] Regenerate `demo/atw-aurelia/.atw/artifacts/action-manifest.md` via `/atw.classify` — supersedes the current hand-authored manifest. Includes: `add_to_cart` (POST /store/carts/{id}/line-items) + curated selection of read-only tools (get_product, list_products, get_cart, list_categories). Excluded list covers admin, checkout/complete, payment-collections, customer-user-management, gift-cards. Depends on T038, T064.
- [X] T066 [US5] Regenerate `demo/atw-aurelia/backend/src/tools.ts` via `/atw.build` — non-empty catalog matching T065 manifest. Depends on T046, T065.
- [X] T067 [US5] Emit `demo/atw-aurelia/.atw/artifacts/action-executors.json` for the Medusa surface — per T058. Cross-origin warning expected to be absent (demo sets widget origin = host origin via docker-compose network). Depends on T058, T065.
- [X] T068 [US5] Update `demo/atw-aurelia/docker-compose.yml` widget config — set `actionExecutorsUrl` on the widget bundle's static config to point at `/action-executors.json` via the existing static-file host. Depends on T059, T067.
- [X] T069 [P] [US5] Integration test for reviewer round-trip — `tests/integration/reviewer-demo-action.integration.test.ts`: spin up the rendered demo stack via docker-compose-like harness, simulate shopper login (set Medusa session cookie), simulate widget chat ("Add Midnight Roast 1kg whole bean"), assert: `tool_use` emitted by backend, confirmation card rendered with correct summary, confirmation action issues `POST /store/carts/{id}/line-items` with `credentials: 'include'`, Medusa `/cart` snapshot reflects the added line item, chat-backend request log has zero shopper-cookie matches (SC-001 + SC-003 combined proof).
- [X] T070 [US5] Update `specs/006-openapi-action-catalog/quickstart.md` — confirm every command + expected output listed in Path A actually matches what T064–T068 produce. Any drift → update the quickstart (single source of truth for reviewer path). Depends on T064–T068.

**Checkpoint**: The reviewer demo works end-to-end. The "add Midnight Roast to cart" beat in the demo video has a functional backing.

---

## Phase 8: User Story 6 - Graceful degradation (Priority: P3)

**Goal**: Pipeline survives missing OpenAPI, missing manifest, or zero-included manifests — build succeeds, warning is clear, widget boots chat-only (FR-014, SC-005).

**Independent Test**: Three separate degradation runs — (a) no `/atw.api` run on a project → build succeeds with empty tool catalog; (b) `admin-only.json` fixture → classifier returns zero included → build succeeds with empty catalog + excluded list populated; (c) Builder hand-edits manifest to remove all included → next build emits empty catalog. In all three: widget loads chat-only, no client-side error, warning printed exactly once.

### Tests for User Story 6

- [X] T071 [P] [US6] Unit test for missing-manifest handling — `packages/scripts/test/render-tools-ts.empty.unit.test.ts`: orchestrator invoked with no `.atw/artifacts/action-manifest.md` → `tools.ts` renders with `RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`; `action-executors.json` NOT emitted (no manifest → no catalog); build-manifest `warnings[]` contains exactly: `No action-manifest.md — widget will be chat-only.`
- [X] T072 [P] [US6] Contract test for zero-included manifest handling — `packages/scripts/test/render-executors.empty-catalog.contract.test.ts`: manifest with `included: []` → `action-executors.json` emitted with `{"version": 1, "credentialMode": "same-origin-cookies", "actions": []}`; `tools.ts` renders `RUNTIME_TOOLS = []`; widget loads catalog, validates, boots chat-only (unit-level — not full E2E).
- [X] T073 [P] [US6] Integration test for admin-only OpenAPI — `packages/scripts/test/classify-admin-only.integration.test.ts`: classify `admin-only.json` fixture → manifest has empty `included`, excluded lists every operation with `admin-prefix` reason; build exits 0; chat-only warning printed.
- [X] T074 [P] [US6] Unit test for widget chat-only fallback — `packages/widget/test/init-chat-only.unit.test.ts`: widget initialised with `actionExecutorsUrl` returning 404 → catches fetch failure, logs warning, continues to boot and answer chat messages; launcher shows normally; no action-capability UI elements present.

### Implementation for User Story 6

- [X] T075 [P] [US6] Harden orchestrator for missing manifest — confirm T045's manifest-missing branch emits exactly the contract's warning text and does not invoke `renderExecutors()`. Depends on T045.
- [X] T076 [US6] Harden widget chat-only boot — in `packages/widget/src/init.ts` (T062), wrap the catalog fetch in try/catch that logs the warning but never throws into the init path; widget state exposes `actionCapable: boolean` to downstream components which gate any action-related UI. Depends on T062.
- [X] T077 [US6] Verify chat-only invariant in `action-card.tsx` — when `actionCapable === false`, no confirmation card ever renders; if the backend somehow emits an `ActionIntent` in chat-only mode (shouldn't happen — backend's tool list is empty too), the widget logs a warning and does not attempt to execute.

**Checkpoint**: Every degenerate input produces a graceful chat-only widget. No regressions in MVP functionality.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Documentation sweep, cross-platform determinism validation, final audit.

- [X] T078 [P] Update `demo/atw-aurelia/README.md` (if present) or add one — link to quickstart Path A, note the new artefacts committed by this feature (`openapi.json`, `action-manifest.md`, `action-executors.json`).
- [X] T079 [P] Add `packages/scripts/src/_shared-lib-allowlist.ts` entry for any new shared types (action-manifest-types.ts, action-executors-types.ts) so they vendor correctly into the generated backend (Feature 005 vendor-shared-lib pattern). — Verified: backend templates reference only runtime-config/runtime-pii-scrub/runtime-credential-strip/runtime-logger/types/error-codes; action-manifest-types.ts and action-executors-types.ts are build-time-only (used by @atw/scripts internally and imported by the widget directly). No allowlist changes required.
- [X] T080 [P] Cross-platform determinism smoke — `tests/integration/cross-platform-determinism.integration.test.ts` (Linux-only and Windows-only variants): run `/atw.api` → `/atw.classify` (with mocked Opus returning fixed list) → `/atw.build` on both platforms, assert sha256 match for `openapi.json`, `action-manifest.md`, `action-executors.json`, `tools.ts`. Actual dual-OS execution lives in CI matrix; test structure ships here.
- [X] T081 Run `quickstart.md` validation by hand — follow both Path A (reviewer) and Path B (Builder) verbatim on a fresh clone; any drift → fix the affected source or update the quickstart. Depends on T070. — Completed: (1) narrowed the credential-grep invariant + listed the 6 permitted files (`lib/credential-strip.ts`, `_shared/runtime-credential-strip.ts`, `_shared/runtime-logger.ts`, `lib/logger.ts`, `lib/tool-execution.ts`, `_shared/types.ts`); (2) rewrote `commands/atw.api.md` to the ingest-only scope and created `commands/atw.classify.md` for the two-stage classifier so the quickstart's `/atw.api` → `/atw.classify` flow has matching slash-command markdown; (3) wired the FR-014 empty-included warning (`action-executors catalog has zero actions — widget will be chat-only`) in `packages/scripts/src/orchestrator.ts` so the quickstart claim actually fires; (4) updated the anchored-generation failure-mode example to match the thrown `ManifestValidationError` text verbatim. Determinism (T080), orchestrator, and render-executors tests all pass.
- [X] T082 [P] Update CLAUDE.md if any new convention emerged during implementation — the plan pointer already updated in `/speckit.plan`; only touch if a new project-wide rule surfaced. — Verified: CLAUDE.md already points at the Feature 006 plan/spec/research/data-model/contracts/quickstart and names the three red-line principles (I, V, VIII). Feature 006 reinforces existing conventions (canonical JSON determinism, anchored-generation post-check, no-dynamic-code widget, sovereignty) rather than introducing a project-wide rule. No update required.
- [X] T083 [P] Final security audit — static grep over `packages/widget/src/**/*.ts,tsx` for `eval\(`, `new Function\(`, `innerHTML\s*=`, `dangerouslySetInnerHTML`, `DOMParser`, `document\.write\(`, `import\s*\(.*\$\{` (dynamic import with variable). Expected: zero matches. Record the command and its zero-output in the PR description. — Completed. Command: `rg -n 'eval\(|new Function\(|innerHTML\s*=|dangerouslySetInnerHTML|DOMParser|document\.write\(|import\s*\(.*\$\{' packages/widget/src/*.{ts,tsx}`. Findings (4 total, 0 new from Feature 006): (1) `action-executors.ts:15` — **comment** ("no DOMParser") in the interpreter contract header; (2) `action-card.tsx:6` — **comment** ("No dangerouslySetInnerHTML, no innerHTML assignment") in the interpreter contract header; (3) `launcher.ts:14` — static hard-coded SVG string literal assigned to `btn.innerHTML`, no interpolation, no user/host input reaches this line (pre-Feature 006 design); (4) `message-list.tsx:55` — `dangerouslySetInnerHTML={{ __html: renderMarkdown(t.content) }}` where `renderMarkdown` routes through DOMPurify with a tight tag/attr allowlist (pre-Feature 006 design, sanitization pinned by existing tests in `markdown.ts`). The interpreter-safety contract test (`test/action-card.interpreter-safety.contract.test.ts`, T055, scoped to the three Feature 006 widget files: `action-executors.ts`, `api-client-action.ts`, `action-card.tsx`) passes green, confirming zero violations in the files this feature introduced or modified.
- [X] T084 Verify `build-manifest.json` warnings surface all three expected signals — `.atw/state/build-manifest.json` after a classifier run with >20 actions (FR-019), a cross-origin executor entry (FR-016), and an empty catalog (FR-014) each produces a distinct warning entry that the Builder can read post-build. — Completed: added `packages/scripts/test/orchestrator.warning-signals.unit.test.ts` (6 structural tests, all green). Pins the exact literal strings for: (1) missing manifest → `No action-manifest.md — widget will be chat-only.` (FR-014); (2) empty included list → `action-executors catalog has zero actions — widget will be chat-only` (FR-014, added to orchestrator.ts in T081's sweep); (3) >20 actions → `large catalog (${N} actions): consider curating action-manifest.md` gated on `manifest.included.length > 20` (FR-019); (4) cross-origin → `cross-origin action "${tool}": host ${resolved.origin} !== widget ${opts.widgetOrigin}` emitted from render-executors.ts (FR-016). Also pins the serialisation wiring: `for (const w of executorResult.warnings) buildWarnings.push(w);` and the guarded `warnings: buildWarnings` output on both success and failure paths of the build-manifest.
- [X] T085 Run the full checklist in `specs/006-openapi-action-catalog/checklists/requirements.md` — ensure every item is green before handing the branch off. — Verified: all 15 items in the Content Quality / Requirement Completeness / Feature Readiness sections are `[x]`. Validation notes already capture the two judgment calls (intentional artefact-name references, technology-anchored SC-006). Zero `[NEEDS CLARIFICATION]` markers. The five `/speckit-clarify` answers from 2026-04-23 were integrated into the spec and produced the additional FRs (FR-009a, FR-015a, FR-019, FR-020, FR-021), all of which are now covered by Phase 9 tests (T083 interpreter-safety, T084 warning signals).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; fixtures can land in parallel.
- **Foundational (Phase 2)**: Depends on Setup. BLOCKS all user stories — Zod schemas, `RenderContext.tools`, and the determinism ledger must exist before any story can be built.
- **US1 (Phase 3)**: Depends on Foundational. Independent of US2–US6.
- **US2 (Phase 4)**: Depends on Foundational + **US1** (needs an ingested OpenAPI to classify, via the CLI entrypoint from T024).
- **US3 (Phase 5)**: Depends on Foundational + **US2** (needs a manifest to render tools from).
- **US4 (Phase 6)**: Depends on Foundational + **US2** (needs a manifest to derive the executor catalog from). Can start in parallel with US3 once US2 is done — different files, different code paths.
- **US5 (Phase 7)**: Depends on US1+US2+US3+US4 (reviewer path exercises the full MVP).
- **US6 (Phase 8)**: Depends on US3+US4 (graceful degradation is a property of the render+widget path). Can run in parallel with US5.
- **Polish (Phase 9)**: After all desired stories are complete.

### Within Each User Story

- Tests MUST be written and FAIL before paired implementation tasks.
- Shared types (Phase 2) before parsers.
- Parsers before renderers.
- Renderers before orchestrator wiring.
- Orchestrator wiring before committed demo snapshot (US5).
- Widget schemas before widget interpreter.

### Parallel Opportunities

- **Phase 1 setup**: T001–T007 are all fixtures in different files → all [P].
- **Phase 2 foundational**: T008–T012 are [P] (separate files); T013–T015 each touch a different file or a different surface, so T013 [P], T014 [P], T015 [P] — but T014 depends on T015's template edit being compatible; sequence T015 before T014 if doing them together, or verify template compatibility first.
- **Phase 3 US1 tests**: T016–T019 [P] (separate files).
- **Phase 3 US1 implementation**: T020 must land before T021–T023 (they modify files T020 creates or imports). T024 depends on T020–T023.
- **Phase 4 US2 tests**: T025–T029 [P] (separate files).
- **Phase 4 US2 implementation**: T030–T037 where possible [P]; T031 depends on T030; T032 depends on T031; T033 depends on T032; T034 depends on T033; T036+T037 [P] against each other. T038 depends on the rest.
- **Phase 5 US3 tests**: T039–T042 [P].
- **Phase 5 US3 implementation**: T043+T044 [P]; T045 depends on both; T046 depends on T045.
- **Phase 6 US4 tests**: T047–T056 [P] (each a separate file).
- **Phase 6 US4 implementation**: T057 [P] with T059+T060; T058 depends on T057; T061 depends on T060; T062 depends on T060; T063 independent audit.
- **Phase 7 US5**: T064 must precede T065; T065 must precede T066+T067; T068 depends on T059+T067. T069 is [P] against T070.
- **Phase 8 US6 tests**: T071–T074 [P].
- **Phase 8 US6 implementation**: T075+T076+T077 each in a different file → [P].
- **Phase 9 polish**: T078–T085 mostly [P] (different files); T081 depends on T070.

---

## Parallel Example: User Story 1 (Builder ingests host OpenAPI)

```bash
# Write tests first (all in parallel):
Task: "T016 Contract test for ingestion happy path in packages/scripts/test/atw-api.contract.test.ts"
Task: "T017 Contract test for ingestion rejection in packages/scripts/test/atw-api.contract.test.ts"
Task: "T018 Contract test for ingestion determinism in packages/scripts/test/atw-api.determinism.contract.test.ts"
Task: "T019 Unit test for canonicalisation in packages/scripts/test/atw-api-canonicalise.unit.test.ts"

# Confirm tests fail.

# Implement sequentially (T020 → T021/T022 [P] → T023 → T024):
Task: "T020 Create packages/scripts/src/atw-api.ts CLI entry"
Task: "T021 [P] Add duplicate-operationId detection to parse-openapi.ts"
Task: "T022 [P] Add canonicaliseOpenAPI helper in atw-api.ts"
Task: "T023 Wire write + meta emission in atw-api.ts"
Task: "T024 Register /atw.api as orchestrator entrypoint in orchestrator.ts"
```

## Parallel Example: User Story 4 (Widget executor)

```bash
# All unit tests in parallel:
Task: "T047 Contract test for executor catalog render in packages/scripts/test/render-executors.contract.test.ts"
Task: "T049 Unit test for widget catalog loader in packages/widget/test/action-executors-loader.unit.test.ts"
Task: "T052 Unit test for 15 s AbortController in packages/widget/test/action-executors.abort.unit.test.ts"
Task: "T053 Unit test for no-retry in packages/widget/test/action-executors.no-retry.unit.test.ts"
Task: "T054 Unit test for HTML-escape in packages/widget/test/action-card.html-escape.unit.test.ts"
Task: "T055 Contract test for interpreter safety in packages/widget/test/action-card.interpreter-safety.contract.test.ts"
Task: "T056 Integration test for credential sovereignty in tests/integration/credentials-sovereignty.integration.test.ts"
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 — all P1)

1. Complete Phase 1: Setup (fixtures)
2. Complete Phase 2: Foundational (schemas + RenderContext + ledger extension) — BLOCKING
3. Complete Phase 3: US1 (`/atw.api` works in isolation; `openapi.json` canonical and deterministic)
4. **STOP and VALIDATE**: Run ingestion against `medusa-store.json`; confirm `openapi.json` byte-identity on re-run.
5. Complete Phase 4: US2 (classifier + manifest parser; anchored-generation test passes)
6. **STOP and VALIDATE**: Run `/atw.classify` against the ingested document; review the generated manifest by hand.
7. Complete Phase 5 and Phase 6 in parallel (US3 renders `tools.ts`; US4 renders executors + widget interpreter).
8. **MVP MILESTONE**: End-to-end chat → tool_use → confirmation card → host fetch with same-origin credentials works. All P1 acceptance scenarios pass.

### Incremental Delivery

1. MVP above → release/demo → video beat confirmed.
2. Add US5 (Phase 7): reviewer demo locked down; artefacts committed.
3. Add US6 (Phase 8): degradation paths hardened.
4. Polish (Phase 9): cross-platform, static audit, docs sweep.

### Parallel Team Strategy

With multiple developers after Phase 2 completes:

- Dev A: US1 (Phase 3) — scripts workspace focused.
- Dev B: foundational polish + early on US2 Stage 1 heuristic (can start because heuristic doesn't need US1's output for its unit tests, only for integration).
- After US2 lands:
  - Dev A: US3 (render-backend, orchestrator wiring, tools.ts).
  - Dev B: US4 (render-executors, widget interpreter, abort/no-retry/HTML-escape).
- After US3+US4 land:
  - Dev A: US5 (demo snapshot regeneration).
  - Dev B: US6 (graceful degradation paths).

---

## Notes

- [P] tasks = different files, no dependencies on incomplete work
- [Story] label maps task to spec.md user story for traceability
- Each user story is independently completable and testable; the MVP is the four P1 stories together
- Verify tests fail before implementing each paired task
- Commit after each task or logical group; use conventional-commit subjects tied to the task ID (e.g., `feat(006/T020): /atw.api CLI entry`)
- Stop at any checkpoint to validate story independently
- Red-line gates (Principle I / V / VIII) MUST pass at every checkpoint — if a gate slips, halt and re-evaluate rather than deferring to Polish
- Avoid: vague tasks, cross-story file conflicts that break independence, adding new runtime dependencies beyond those listed in plan.md Technical Context

---

## Task count summary

- **Phase 1 Setup**: 7 tasks (T001–T007)
- **Phase 2 Foundational**: 8 tasks (T008–T015)
- **US1 (Phase 3)**: 9 tasks (T016–T024) — 4 tests + 5 implementation
- **US2 (Phase 4)**: 14 tasks (T025–T038) — 5 tests + 9 implementation
- **US3 (Phase 5)**: 8 tasks (T039–T046) — 4 tests + 4 implementation
- **US4 (Phase 6)**: 17 tasks (T047–T063) — 10 tests + 7 implementation
- **US5 (Phase 7)**: 7 tasks (T064–T070) — 1 test + 6 implementation/demo
- **US6 (Phase 8)**: 7 tasks (T071–T077) — 4 tests + 3 implementation
- **Phase 9 Polish**: 8 tasks (T078–T085)

**Total**: 85 tasks.
**Tests**: 32 explicit test tasks (approximately 38 % of all tasks, aligning with the plan's TDD-ish posture).
**MVP scope**: Phases 1–6 → US1+US2+US3+US4 → 63 tasks. Reviewer demo (US5) at 70; full feature at 85.

**Independent test criteria recap**:
- **US1**: `/atw.api` ingests the three fixtures with the expected outcomes (success, rejection, no-op on re-run).
- **US2**: Classifier produces an anchored manifest, rejects fabricated descriptors, preserves Builder edits across delta-merge.
- **US3**: `tools.ts` ends non-empty; `toolsForAnthropic()` returns N; `ACTION_TOOLS` split matches `is_action`.
- **US4**: Widget fetches with `credentials: 'include'`; backend sees zero shopper cookies; 15 s abort fires; no retry; HTML escape holds; no dynamic code.
- **US5**: Clean clone → ≤ 3-minute reviewer round-trip.
- **US6**: Degenerate inputs produce chat-only widgets with clear warnings.

**Parallel opportunities**: Fixtures (T001–T007) all [P]. Zod schemas (T008–T012) all [P]. Tests across user stories [P] with each other once Phase 2 is done. US3 and US4 implementation can run in parallel after US2. US5 and US6 can run in parallel after MVP.

**Format validation**: All 85 tasks follow `- [ ] TID [P?] [US?] description (file path)`. Setup, Foundational, and Polish tasks omit `[Story]`; US1–US6 phase tasks include it. Every task lists the exact file path.

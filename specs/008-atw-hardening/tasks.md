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

- [ ] T001 Add `@fastify/cors@^9.0.1` to `demo/shop/backend/package.json` dependencies and run `npm install` inside `demo/shop/backend` to refresh the lockfile (FR-021 prep).
- [ ] T002 [P] Create `packages/scripts/src/lib/singular-plural.ts` with the `normaliseName(input: string): string` helper per research.md R9 (conservative English pluralisation; lowercase + alnum normalisation; word-by-word on compound names).
- [ ] T003 [P] Create `packages/scripts/test/singular-plural.test.ts` covering the R9 conservative rules (`Products`↔`Product`, `Orders`↔`Order`, `Customers`↔`Customer`, non-English fallthrough, compound names).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema and write-path changes that every downstream stage consumes. User-story work cannot begin until these land because every story's first step is `/atw.init` writing YAML frontmatter and emitting a conformant `project.md`.

**⚠️ CRITICAL**: No user-story work starts until this phase is complete.

- [ ] T004 Extend `packages/scripts/src/write-artifact.ts` so the YAML-frontmatter serialiser emits ISO-8601 timestamp values as quoted strings (e.g., `createdAt: "2026-04-24T15:42:00Z"`). Apply to every timestamp field; keep non-timestamp string heuristics unchanged (FR-008).
- [ ] T005 Add regression test `packages/scripts/test/write-artifact.quoted-timestamps.test.ts` asserting emitted frontmatter parses as `z.string().datetime()` for both `createdAt` and `updatedAt` (plan.md Testing item c).
- [ ] T006 [P] Amend `project.md` Zod schema in `packages/scripts/src/lib/` (locate the existing project-config schema) to add optional fields: `deploymentType: z.literal("customer-facing-widget").optional()`, `storefrontOrigins: z.array(z.string().url()).optional()`, `welcomeMessage: z.string().max(200).optional()`, `authTokenKey: z.string().regex(/^[a-zA-Z0-9_-]+$/).optional()`, `loginUrl: z.union([z.string().url(), z.literal("")]).optional()`. Enforce the cross-field rule from contracts/project-md-v2.md: when `deploymentType === "customer-facing-widget"`, `storefrontOrigins` MUST be non-empty.
- [ ] T007 [P] Align `atw-hash-inputs` reader to the writer's shape `{ schema_version: "1", files: Record<string, string> }` by updating the Zod validator in `packages/scripts/src/hash-inputs.ts` (FR-006 / research.md R14). Remove any remaining `{ version, entries[] }` references from `hash-inputs.ts`.
- [ ] T008 Add contract test `packages/scripts/test/hash-index.round-trip.test.ts` that writes a hash-index via `atw-api.ts`' writer path, reads it via `hash-inputs.ts`' validator, and asserts the round-trip succeeds (plan.md Testing item a).
- [ ] T009 [P] Replace the `--inputs` argv parser in `packages/scripts/src/hash-inputs.ts` so positional arguments after `--inputs` are collected until the next `--flag` or end-of-args (FR-007 / research.md R15). Keep legacy comma-separated single-arg form as a fallback by splitting any single-arg value on `,`.
- [ ] T010 Add CLI test `packages/scripts/test/hash-inputs.cli.test.ts` asserting `atw-hash-inputs --inputs a.md b.md c.md` parses the three files and that `--inputs a.md,b.md` still resolves to the same two-file list (plan.md Testing item b).

**Checkpoint**: Foundation ready — every artefact writer emits conformant YAML, the hash-index schema matches on both sides, and the CLI accepts the documented invocation.

---

## Phase 3: User Story 1 — Fresh setup produces a clean, halt-free run (Priority: P1) 🎯 MVP

**Goal**: A Builder runs `/atw.init` through `/atw.build` on a fresh reference-shop checkout with no manual file edits. Schema-validation errors, argument-shape errors, zero-entity parses, over-rejected shopper-scoped bearer-JWT operations, missing credential sources, and singular/plural cross-validation mismatches are all resolved.

**Independent Test**: from a clean checkout, `/atw.init` → `/atw.build` completes to `dist/widget.{js,css}` without hand-edits, without schema errors, without "unexpected argument" errors, without silent zero-entity parses, and without over-exclusion of shopper-facing endpoints.

### Tests for User Story 1

- [ ] T011 [P] [US1] Add `packages/scripts/test/schema-map-parser.zero-entity.test.ts` asserting: (a) a schema-map with only H3 `### Entity:` headings throws D-ZEROENTITY variant A; (b) a schema-map with no `Entity:` headings at all throws D-ZEROENTITY variant B; (c) the happy-path H2 schema-map parses successfully (plan.md Testing item d).
- [ ] T012 [P] [US1] Add `packages/scripts/test/classify-deployment-type.test.ts` covering: (a) a shopper-scoped bearer-JWT op is ACCEPTED into the tool catalog when `project.md#deploymentType: customer-facing-widget`; (b) the same op is EXCLUDED as `non-cookie-security` when `deploymentType` is absent; (c) the D-CLASSIFYAUTH warning fires only in case (b) (plan.md Testing item e).
- [ ] T013 [P] [US1] Add `packages/scripts/test/cross-validate.singular-plural.test.ts` asserting classifier-emitted tag `products` matches schema-map entity `Product` through the R9 normalisation helper (plan.md Testing item f).
- [ ] T014 [P] [US1] Add `packages/scripts/test/validate-artifacts.runtime-only.test.ts` covering: (a) a tool group referencing an excluded entity WITHOUT `(runtime-only)` flag fails with D-RUNTIMEONLY; (b) the same group WITH `(runtime-only)` flag passes; (c) the flag round-trips into `action-executors.json` as `runtimeOnly: true` (plan.md Testing item g).
- [ ] T015 [P] [US1] Add `packages/scripts/test/cross-validate.credential-backfill.test.ts` covering: (a) an OpenAPI op declaring `security: [{bearerAuth: []}]` causes `entry.source.security` to be populated and the rendered catalog entry to carry a well-formed `credentialSource`; (b) a shopper-scoped op with NO declared security halts the build with D-CREDSRC text matching contracts/builder-diagnostics.md (plan.md Testing item h).

### Implementation for User Story 1

- [ ] T016 [US1] Fix the `schema-map.md` parser in `packages/scripts/src/lib/markdown.ts`: keep `extractSections(tree, { depth: 2 })`; after parse, if entity count is zero scan the raw markdown for `### Entity:` substrings and throw the D-ZEROENTITY variant A error; otherwise throw variant B. Both variants MUST match contracts/builder-diagnostics.md#D-ZEROENTITY text (FR-009).
- [ ] T017 [US1] Update `examples/sample-schema-map.md` to use H2 `## Entity: <name>` headings throughout, replacing any H3 usage (FR-009 alignment).
- [ ] T018 [US1] Gate the classifier's Stage 1 rule 2 in `packages/scripts/src/atw-classify.ts` (+ `lib/admin-detection.ts` if the rule lives there): when the loaded `project.md#deploymentType === "customer-facing-widget"`, skip the bearer-JWT `non-cookie-security` rejection for shopper-scoped operations and accept them into the manifest; when the flag is absent or any other value, preserve the pre-008 rejection rule unchanged. Emit the D-CLASSIFYAUTH warning per contracts/builder-diagnostics.md only in the unset-flag path (FR-010 / research.md R1).
- [ ] T019 [US1] Thread the `normaliseName` helper from `packages/scripts/src/lib/singular-plural.ts` into `packages/scripts/src/parse-action-manifest.ts` cross-validation call sites (`:134` and anywhere classifier-tag vs entity-name comparison happens) and into `validate-artifacts.ts` where the same comparison runs. Replace exact-match `normalize(a) === normalize(b)` calls with `normaliseName(a) === normaliseName(b)` (FR-011).
- [ ] T020 [US1] Parse the `(runtime-only)` inline flag from `## Tools: <group> (runtime-only)` headers in `packages/scripts/src/parse-action-manifest.ts`. Store the flag on the parsed group model and round-trip it through `render-executors.ts` as `runtimeOnly: true` on every entry of that group (FR-012 / research.md R8).
- [ ] T021 [US1] Update `packages/scripts/src/validate-artifacts.ts`' `action-references-excluded-entity` rule so groups flagged `runtime-only` bypass the excluded-entity check. Groups WITHOUT the flag retain the existing rule and emit D-RUNTIMEONLY on violation (FR-012).
- [ ] T022 [US1] Extend `crossValidateAgainstOpenAPI` in `packages/scripts/src/parse-action-manifest.ts` (`:433-460` + `:523-553`): for every catalog entry whose underlying OpenAPI operation declares `security`, copy the operation's `security` list onto `entry.source.security`. Also copy any root-level `security` from the OpenAPI document when operations do not override (FR-013 / research.md R3).
- [ ] T023 [US1] After the T022 backfill runs, detect catalog entries where `entry.source.security` remains empty AND the entry targets an operation that would require auth (shopper-scoped in a `deploymentType: customer-facing-widget` project). Halt the validate stage with the exact D-CREDSRC text from contracts/builder-diagnostics.md, listing each affected operation by HTTP verb, path, and tool name (FR-013 / Clarification Q3 "halt with actionable diagnostic").
- [ ] T024 [US1] Update `packages/scripts/src/render-executors.ts` (`:168-184`) so every entry with a non-empty `entry.source.security` emits a populated `credentialSource: { type: "bearer-localstorage", key: <project.md#authTokenKey>, header: "Authorization", scheme: "Bearer" }` block. Remove any remaining silent-skip path; T023's halt is the single failure mode (FR-013).
- [ ] T025 [US1] Update `commands/atw.schema.md` slash-command prompt to ask the Builder for the SQL dump location interactively, derive the `pg_dump` invocation from the shop connection info captured in `project.md`, and store the exact command in `.atw/inputs/README.md` (FR-004 / research.md).
- [ ] T026 [US1] Update `packages/scripts/src/apply-migrations.ts` (and any `/atw.build` pre-flight SQL-dump check) so a missing `.atw/inputs/<name>.sql` halts with the D-SQLDUMP diagnostic from contracts/builder-diagnostics.md. When `.atw/inputs/README.md` exists from T025, the shortened variant is used; otherwise the full `pg_dump` invocation is emitted (FR-004).
- [ ] T027 [US1] Update `commands/atw.plan.md` slash-command prompt so the documented `/atw.plan --inputs a.md b.md c.md` invocation matches the CLI's behaviour from T009 (FR-007 alignment).

**Checkpoint**: A fresh `/atw.init` → `/atw.build` run on the reference shop completes without schema errors, argument-shape errors, zero-entity parses, over-rejected shopper ops, missing credential sources, or singular/plural mismatches. User Story 1 is independently testable: run Phase 3 of quickstart.md.

---

## Phase 4: User Story 2 — Write-action tool loop works end-to-end (Priority: P1)

**Goal**: An end shopper performs a write action through the widget; the host executes it; the assistant replies in natural language referencing the outcome. The Feature 007 demo's first-write-action failure ("unexpected tool_use_id found in tool_result blocks") does not reproduce.

**Independent Test**: against a running reference shop with CORS correctly configured, an end shopper performs a write action through the widget. HTTP 200 from the host; assistant replies with model-generated prose; no provider-side rejection in the browser console.

### Tests for User Story 2

- [ ] T028 [P] [US2] Add `demo/shop/backend/test/cors.test.ts` asserting a `docker compose up` fresh-boot Fastify instance serves `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Headers: Authorization, Content-Type` on a preflight `OPTIONS /cart/items` (plan.md Testing item l / SC-007).
- [ ] T029 [P] [US2] Add `packages/backend/test/chat.tool-result-v3.contract.test.ts` covering: (a) a v3 POST carrying `tool_result.tool_name` + `tool_result.tool_input` is accepted and the backend reconstructs the `[user, assistant:tool_use, user:tool_result]` Anthropic message sequence (Anthropic client stubbed); (b) a v3 POST missing `tool_name` or `tool_input` returns HTTP 400 with a descriptive body; (c) retrieval and embedding are NOT invoked when `tool_result` is present (plan.md Testing item i).
- [ ] T030 [P] [US2] Add `packages/backend/test/chat.model-retry.contract.test.ts` covering FR-020a: (a) when the post-`tool_result` Opus call fails 3 consecutive times, the backend returns `{response_generation_failed: true, action_succeeded: true, pending_turn_id: null}`; (b) when the 2nd attempt succeeds, the text response is returned normally; (c) initial (pre-`tool_use`) Opus failures retain the pre-existing error-response shape, not this new fallback (plan.md Testing item j).
- [ ] T031 [P] [US2] Add `packages/widget/test/action-runner.tool-result-payload.test.ts` asserting the widget's POST to `/v1/chat` includes `tool_name` and `tool_input` in `tool_result`, with `tool_input` reflecting the arguments actually executed against the host (including any shopper edits from the confirmation card, not the original Opus proposal).
- [ ] T032 [P] [US2] Add `packages/widget/test/loop-driver.response-generation-failed.test.ts` asserting: on receipt of `{response_generation_failed: true, action_succeeded: true}`, the widget renders the exact pinned string *"Action completed successfully. (Response generation failed — please refresh.)"* and does NOT render the generic error toast; `pending_turn_id` is cleared.

### Implementation for User Story 2

- [ ] T033 [US2] Register `@fastify/cors` in `demo/shop/backend/src/index.ts` before any route using `app.register(cors, { origin: (process.env.ALLOWED_ORIGINS ?? "http://localhost:5173").split(","), allowedHeaders: ["Authorization", "Content-Type"], methods: ["GET","POST","PATCH","DELETE","OPTIONS"] })`. Document the env var in `demo/shop/README.md` (FR-021 / research.md R13).
- [ ] T034 [US2] Extend `ToolResultPayloadSchema` in `packages/scripts/src/lib/types.ts` (`:747-766`) with `tool_name: z.string().min(1)` and `tool_input: z.record(z.unknown())`. Update `ChatRequestSchema` to use the amended payload. `ConversationTurnSchema.content` MUST remain `z.string()` (no migration — research.md R4 / FEATURE-008 Non-goals).
- [ ] T035 [US2] Create `packages/backend/src/lib/tool-result-assembly.ts.hbs` — a pure helper that accepts a `ToolResultPayload` plus the widget-supplied `messages` and returns the Anthropic `[user, assistant:tool_use, user:tool_result]` message array per contracts/chat-endpoint-v3.md#backend-message-sequence-reconstruction.
- [ ] T036 [US2] Update `packages/backend/src/routes/chat.ts.hbs` (`:109-124`): when `tool_result` is present, call the T035 helper to build `messagesForAnthropic`, invoke `anthropic.messages.create({ messages: messagesForAnthropic, tools, ... })`, stream the resulting text/citations back to the widget (FR-018/019/020 / research.md R4). Retrieval and embedding MUST be skipped on `tool_result`-bearing posts.
- [ ] T037 [US2] Add the FR-020a retry policy to the post-`tool_result` Opus call in `packages/backend/src/routes/chat.ts.hbs`: on any failure (network, timeout, provider error, rate-limit), retry up to 2 additional times with exponential backoff (500 ms → 1 s → 2 s). On exhaustion, return HTTP 200 with body `{ response_generation_failed: true, action_succeeded: true, pending_turn_id: null }`. The retry loop only wraps the post-tool-result second Opus call; the initial pre-`tool_use` call retains its existing error handling (research.md R5).
- [ ] T038 [US2] Update `packages/widget/src/chat-action-runner.ts` so the POST it sends after a shop-API fetch includes `tool_result.tool_name` (the operationId it executed) and `tool_result.tool_input` (the arguments it actually fetched with, reflecting any confirmation-card edits). This closes the Feature 007 D1 contract drift (FR-018/019).
- [ ] T039 [US2] Update `packages/widget/src/loop-driver.ts` to branch on response shape: `text`/`action_intent`/`response_generation_failed`. On `response_generation_failed: true && action_succeeded: true`, render the pinned D-FR020AFALLBACK string in the transcript, clear `pending_turn_id`, and do NOT surface the generic error toast (FR-020a / research.md R5).
- [ ] T040 [US2] Rewrite `specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md` (or supersede it via the new `specs/008-atw-hardening/contracts/chat-endpoint-v3.md`) so the documented request shape matches what the widget actually sends — string-content messages plus `tool_result.tool_name` + `tool_result.tool_input`. The typed-assistant-turn example must be removed (FR-018 / SC-006).

**Checkpoint**: An end-to-end write action through the widget on the reference shop succeeds: preflight passes, fetch succeeds, widget POSTs `tool_result` with `tool_name` + `tool_input`, backend reconstructs the message trio, Opus composes prose, the widget renders it. FR-020a fallback path is exercised by stubbed failure. User Story 2 is independently testable: run Phase 8 of quickstart.md.

---

## Phase 5: User Story 3 — Host contract is captured upfront and the embed just works (Priority: P2)

**Goal**: `/atw.init` captures storefront origins and welcome message; `/atw.api` emits `host-requirements.md`; `/atw.embed` produces a complete, copy-pasteable integration package. No hand-patching required for a fresh integration.

**Independent Test**: a Builder who has never integrated this widget before follows only the output of `/atw.embed`, copies the listed files, pastes the snippet, applies `host-requirements.md`, and loads the storefront. Launcher appears, conversation starts, a tool call executes without console errors.

### Tests for User Story 3

- [ ] T041 [P] [US3] Add `packages/scripts/test/init-project.prefill.test.ts` asserting: (a) first-run `/atw.init` defaults `deploymentType` to `customer-facing-widget`; (b) re-running `/atw.init` with every prompt accepted produces byte-identical frontmatter except `updatedAt`; (c) each prompt's pre-filled default is the previously-captured value (FR-005a / research.md R6).
- [ ] T042 [P] [US3] Add `packages/scripts/test/atw-api.host-requirements.test.ts` covering: (a) `host-requirements.md` is emitted only when `deploymentType === "customer-facing-widget"`; (b) emitted content contains CORS origins from `project.md#storefrontOrigins`, localStorage key from `authTokenKey`, login URL from `loginUrl`, and all discovered allowed headers/verbs; (c) the file carries the `<!-- Generated by /atw.api — edits here are overwritten on next run -->` comment; (d) regeneration is byte-identical on unchanged inputs (contracts/host-requirements.md contract tests).
- [ ] T043 [P] [US3] Add `packages/scripts/test/embed.attributes.test.ts` covering: (a) `/atw.embed` output contains `data-auth-token-key="<authTokenKey>"` and NOT `data-bearer-storage-key`; (b) `data-allowed-tools` is an alphabetically-sorted, comma-separated list derived from `action-executors.json#tool` fields; (c) the files-to-copy markdown task-list appears and includes `.atw/artifacts/action-executors.json`; (d) the host-requirements reminder appears iff `host-requirements.md` exists; (e) `data-welcome-message` matches `project.md#welcomeMessage` (plan.md Testing item k / contracts/embed-snippet.md).

### Implementation for User Story 3

- [ ] T044 [US3] Update `commands/atw.init.md` slash-command prompt to add interactive prompts for (in order): `deploymentType` (default `customer-facing-widget`), `storefrontOrigins` (default `["http://localhost:5173"]`), `welcomeMessage` (default `"Hi! How can I help you today?"`), `authTokenKey` (default `shop_auth_token`), `loginUrl` (default empty). Include a validation pass for URLs and the alnum-key regex (contracts/project-md-v2.md).
- [ ] T045 [US3] Update `packages/scripts/src/init-project.ts` to: (a) read any existing `.atw/config/project.md` frontmatter before prompting; (b) present each prompt's pre-filled default as the previously-captured value; (c) show a diff of old vs. new frontmatter before writing; (d) bump `updatedAt`; (e) preserve unchanged values byte-for-byte (FR-001/002/005a / research.md R6). Every write goes through `write-artifact.ts` (T004) so timestamps are quoted.
- [ ] T046 [US3] Create a new emission path in `packages/scripts/src/atw-api.ts` that writes `.atw/artifacts/host-requirements.md` per contracts/host-requirements.md. Gate on `project.md#deploymentType === "customer-facing-widget"`. Derive allowed headers/verbs from the loaded OpenAPI document (distinct HTTP verbs across catalog entries + any `X-*` headers discovered in parameters). Print the in-terminal summary at emission time (FR-003).
- [ ] T047 [US3] Extend `packages/scripts/src/render-executors.ts` to carry optional `summaryTemplate: string` and optional `hostPrerequisite: string` from the manifest onto each rendered catalog entry (FR-026 / FR-003 tool-specific-prerequisites section). These are declarative passthroughs — no runtime template engine is added in the widget yet; that lands in US5.
- [ ] T048 [US3] Rename the embed attribute from `data-bearer-storage-key` to `data-auth-token-key` across `packages/scripts/src/embed-templates/` and `packages/scripts/src/embed.ts` (FR-014 / research.md R12). Widget-side `config.ts` already reads `authTokenKey` — no widget change needed for this rename.
- [ ] T049 [US3] Extend `packages/scripts/src/embed.ts` to read `.atw/artifacts/action-executors.json`, extract every `entry.tool`, sort alphabetically, and emit as `data-allowed-tools="<csv>"` on the generated script tag (FR-015 / research.md R12). A tool name containing a comma MUST fail the build with a descriptive error.
- [ ] T050 [US3] Extend `packages/scripts/src/embed.ts` to emit, in order: (1) a files-to-copy markdown task-list including `dist/widget.js`, `dist/widget.css`, and `.atw/artifacts/action-executors.json` (the third item omitted iff the catalog is empty); (2) a host-requirements reminder pointing at `.atw/artifacts/host-requirements.md` (emitted iff that file exists); (3) the pasteable snippet with `data-auth-token-key`, `data-allowed-tools`, `data-welcome-message` (FR-016/017 / contracts/embed-snippet.md).
- [ ] T051 [US3] Update `commands/atw.build.md` slash-command prompt so the DONE banner includes the Next Steps section from contracts/embed-snippet.md#atwbuild-done-banner (FR-005).
- [ ] T052 [US3] Wire `welcomeMessage` through the widget config: update `packages/widget/src/config.ts` to read `data-welcome-message` from the loader attributes and expose it on the config object (FR-025 plumbing — rendering lands in US5).

**Checkpoint**: `/atw.init` pre-fills on re-run; `/atw.api` emits `host-requirements.md`; `/atw.embed` produces a complete integration package. User Story 3 is independently testable: run Phases 1, 2, and 7 of quickstart.md.

---

## Phase 6: User Story 4 — Failures become loud instead of silent (Priority: P2)

**Goal**: Every known silent-failure mode from the Feature 007 demo produces an actionable diagnostic at the point of failure. The Builder or shopper sees the real reason without opening devtools or reading source.

**Independent Test**: intentionally misconfigure each known failure mode — strip `data-allowed-tools` from the embed, omit `action-executors.json` from the host, delete the SQL dump, use an H3 schema-map, omit `security` from a shopper-scoped OpenAPI op. In each case the diagnostic identifies the failure and states the fix.

### Tests for User Story 4

- [ ] T053 [P] [US4] Add `packages/widget/test/chat-action-runner.tool-not-allowed.test.ts` asserting: when a backend emits a `tool_use` whose tool is not in `config.allowedTools`, the widget renders the D-TOOLNOTALLOWED transcript row (exact text per contracts/builder-diagnostics.md) and does NOT push a synthetic `is_error` tool-result into Anthropic's message sequence; `pending_turn_id` is cleared (plan.md Testing item m, FR-022).
- [ ] T054 [P] [US4] Add `packages/widget/test/chat-action-runner.no-executors.test.ts` asserting: when `actionCapable === false` (catalog load failed or empty) and the backend emits an `action_intent`, the widget renders the D-NOEXECUTORS transcript row (exact text per contracts/builder-diagnostics.md) — not a `console.warn` (FR-023).
- [ ] T055 [P] [US4] Add `packages/scripts/test/diagnostics.text.test.ts` — a text-exactness regression test that imports each diagnostic emitter (D-HASHMISMATCH, D-INPUTSARGS, D-ZEROENTITY A/B, D-CLASSIFYAUTH, D-CREDSRC, D-RUNTIMEONLY, D-SQLDUMP with/without captured command) and asserts the emitted strings match contracts/builder-diagnostics.md verbatim (allowing interpolated identifiers). Prevents silent drift of diagnostic text.

### Implementation for User Story 4

- [ ] T056 [US4] Update `packages/widget/src/chat-action-runner.ts` to replace the silent synthetic-`is_error` path with a visible in-widget diagnostic: on `ToolNotAllowedError`, append a transcript-row message carrying the D-TOOLNOTALLOWED text from contracts/builder-diagnostics.md, clear `pending_turn_id`, and STOP — do NOT POST a synthetic tool_result back. The conversation waits for the next shopper turn (FR-022).
- [ ] T057 [US4] Update `packages/widget/src/chat-action-runner.ts` (or `action-executors.ts`, wherever `actionCapable` is derived) so an `action_intent` arriving while `actionCapable === false` renders the D-NOEXECUTORS transcript row and clears `pending_turn_id`. The `console.warn` path is removed (FR-023).
- [ ] T058 [US4] Ensure the hash-index validator in `packages/scripts/src/hash-inputs.ts` (from T007) emits D-HASHMISMATCH with the exact text from contracts/builder-diagnostics.md on validation failure. Suggest `rm .atw/artifacts/hash-index.json && /atw.build` as the fix.
- [ ] T059 [US4] Ensure the `--inputs` parse error in `packages/scripts/src/hash-inputs.ts` (from T009) emits D-INPUTSARGS with the exact text from contracts/builder-diagnostics.md when an unparseable form is supplied. Do not fall through to yargs' default "Unexpected argument" output.
- [ ] T060 [US4] Audit each diagnostic emitter added in Phase 3–5 (T016 D-ZEROENTITY, T018 D-CLASSIFYAUTH, T021 D-RUNTIMEONLY, T023 D-CREDSRC, T026 D-SQLDUMP) and align their emitted text byte-for-byte with contracts/builder-diagnostics.md. Add `ERROR:`/`WARN:` prefixes on stderr; no ANSI escapes that prevent grep.

**Checkpoint**: Every known failure mode produces an actionable in-context diagnostic. Builders can self-diagnose from the terminal or the widget transcript. User Story 4 is independently testable: run Phase 9 of quickstart.md.

---

## Phase 7: User Story 5 — Widget UX is polished for end shoppers (Priority: P3)

**Goal**: Thinking indicator, Builder-configured welcome message, human-readable ActionCard summaries, no broken navigation pills. The widget reads as a shippable product.

**Independent Test**: load the widget on the reference shop, initiate a conversation with at least one write action. Observe a thinking indicator, a configured welcome message, a confirmation card reading as a sentence, and no clickable nav pills.

### Tests for User Story 5

- [ ] T061 [P] [US5] Add `packages/widget/test/panel.thinking-indicator.test.tsx` asserting: (a) a synthetic `thinking` transcript row is rendered in the same React state update as the POST `/v1/chat` (no delay); (b) it is removed in the same update that appends the first delta or final response; (c) the row sits inside the transcript (not as a toast) so screen readers announce it in conversation flow (plan.md Testing item n / research.md R10).
- [ ] T062 [P] [US5] Add `packages/widget/test/panel.welcome-message.test.tsx` asserting: (a) when `config.welcomeMessage` is set, the widget renders that string as the first assistant-role transcript row; (b) when unset, it falls back to the sane default; (c) no hard-coded greeting is rendered when a configured value is present (plan.md Testing item o / FR-025).
- [ ] T063 [P] [US5] Add `packages/widget/test/action-card.summary-template.test.tsx` asserting: (a) a catalog entry with `summaryTemplate: "Add {{ quantity }}× {{ product_name }} to your cart"` and arguments `{quantity: 1, product_name: "Espresso"}` renders `"Add 1× Espresso to your cart"`; (b) a missing placeholder argument causes fallback to the raw-JSON view; (c) entries without `summaryTemplate` render the raw-JSON view (plan.md Testing item p / FR-026).
- [ ] T064 [P] [US5] Add `packages/widget/test/markdown.no-nav-pills.test.ts` asserting: navigation-pill-shaped links (e.g., `http://host/Products/<id>`) in assistant replies are NOT rendered as clickable pills; the underlying markdown text is preserved (FR-027).

### Implementation for User Story 5

- [ ] T065 [US5] Update `packages/widget/src/panel.tsx` to append a synthetic `thinking` transcript row in the same React state update that schedules the POST `/v1/chat`. Remove the row in the same update that appends the first streamed delta or final response. Place it as a transcript row, not a toast/overlay (FR-024 / research.md R10).
- [ ] T066 [US5] Update `packages/widget/src/panel.tsx` so first-render reads `config.welcomeMessage` and renders it as the first assistant-role transcript row. Remove any hard-coded greeting in this component (FR-025).
- [ ] T067 [US5] Implement the plain-text template renderer in `packages/widget/src/action-card.tsx`: substitute `{{ name }}` placeholders from `summaryTemplate` against the action's `arguments` object. On any placeholder failing to resolve, fall back to the existing raw-JSON view. Keep the template engine minimal — no Handlebars, no conditionals (FR-026 / research.md R11).
- [ ] T068 [US5] Remove the navigation-pill rendering path from `packages/widget/src/markdown.ts`. Links of navigation-pill shape stay as markdown-inline text; nothing becomes a clickable pill until a client-routing integration is designed (FR-027).

**Checkpoint**: Widget renders as a polished product: thinking indicator is immediate, greeting is Builder-configured, confirmation cards read as sentences, nav pills are gone. User Story 5 is independently testable: run Phase 8.1–8.3 of quickstart.md.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation updates, sovereignty re-verification, and the end-to-end quickstart validation that SC-001 measures against.

- [ ] T069 [P] Add an end-to-end quickstart-validation script `specs/008-atw-hardening/validate-quickstart.sh` (or equivalent test-runner entry) that executes Phase 0 through Phase 8 of quickstart.md against a clean checkout and asserts every step completes without hand-edits (SC-001).
- [ ] T070 [P] Update `README.md` so the "quickstart" section points at `specs/008-atw-hardening/quickstart.md` as the canonical end-to-end flow (Principle VIII alignment).
- [ ] T071 Run the Feature 007 sovereignty-probe CI test (`packages/backend/test/sovereignty.contract.test.ts`) against the rendered backend produced after T036/T037 changes; confirm no new `fetch(` calls against non-local hosts were introduced (Principle I red line).
- [ ] T072 [P] Re-run `/atw.build` against `demo/atw-shop-host` with the hardened pipeline and commit the regenerated artefacts under `demo/atw-shop-host/` so the repository's canonical integration demo reflects the Feature 008 outputs (part of US1 / US3 acceptance per plan.md Structure Decision).
- [ ] T073 Remove the in-session `@fastify/cors` patch notes from any README/CHANGELOG and replace with a pointer to the permanent `demo/shop/backend/src/index.ts` registration (FR-021 cleanup).
- [ ] T074 Update memory `project_atw_skill_gaps_f007.md` (or note in the feature's closing memo) that gaps #1–#16 are closed by Feature 008, crossing off each gap against the FR it resolves.
- [ ] T075 Run the full Vitest suite (`npm test` at repo root) and confirm every new test (T005, T008, T010–T015, T028–T032, T041–T043, T053–T055, T061–T064) passes alongside the existing Feature 001–007 regression suite.

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

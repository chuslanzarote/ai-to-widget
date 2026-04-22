---

description: "Task list for Feature 003 — Runtime"
---

# Tasks: Runtime (Feature 003)

**Input**: Design documents from `/specs/003-runtime/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests ARE included. Plan §Testing enumerates four test tiers (unit + contract + integration + E2E) and the Feature's 15 SCs demand automated enforcement — bundle size, rate limiting, accessibility, credential sovereignty are not visually-checkable and must be test-backed. This is stricter than the template default, driven by Principle VIII and the demo's reviewer promise.

**Organization**: Tasks are grouped by the ten user stories in spec.md (US1–US10) to enable independent implementation and testing of each story. US1–US4 are all Priority P1 and together constitute the MVP — the four beats the demo video must show live.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Monorepo: `packages/backend/` (Handlebars templates + Fastify runtime), `packages/widget/` (Preact widget source), `packages/scripts/src/` (slash-command script for `/atw.embed`), `commands/` (slash-command markdown), `demo/medusa/` (Aurelia host), `demo/atw-aurelia/.atw/` (pre-built artefacts), `tests/integration/` + `tests/e2e/` (cross-package tests).
- All paths are repo-relative.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold workspaces, pin dependencies, and wire the new build/test surfaces Feature 003 introduces.

- [X] T001 Add runtime deps to `packages/backend/package.json`: `fastify@4`, `@fastify/cors@9`, `@fastify/rate-limit@9`, `fastify-type-provider-zod`, `pino`, `pino-pretty` (devDep), `zod`, `@anthropic-ai/sdk`, `@xenova/transformers`, `pg` (note: `@fastify/request-id` dropped — Fastify 4 has built-in request-id; `marked`/`dompurify` dropped from backend per analysis I1)
- [X] T002 [P] Add runtime deps to `packages/widget/package.json`: `preact@10`, `@preact/signals`, `marked@12`, `dompurify@3`, `focus-trap`
- [X] T003 [P] Add dev deps to repo root `package.json`: `@playwright/test`, `axe-core`, `@axe-core/playwright` (browser binary install deferred to first Playwright run)
- [X] T004 [P] Add `packages/widget/vitest.config.ts` with jsdom environment + automatic Preact JSX
- [X] T005 Run `npm install` at repo root to materialise new deps across the three workspaces
- [X] T006 [P] Create `.env.example` at repo root with `ANTHROPIC_API_KEY` placeholder and documented defaults per `contracts/compose.md §6`
- [X] T007 [P] Create top-level `Makefile` with `demo`, `fresh`, and `seed` targets per `contracts/compose.md §4–§5`
- [X] T008 [P] Add top-level `docker-compose.yml` with the six services enumerated in `contracts/compose.md §1` (image digest placeholders noted; Feature-release step will pin them)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Types, shared libs, and Fastify/Preact skeletons every user story depends on. Red-line enforcement (credential strip, CORS, health) lands here so US1+ inherits it unconditionally.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T009 [P] Extend `packages/scripts/src/lib/types.ts` with zod schemas `ChatRequestSchema`, `ChatResponseSchema`, `ActionIntentSchema`, `CitationSchema`, `SessionContextSchema`, `ConversationTurnSchema`, `ActionFollowUpSchema` per `data-model.md §1`
- [X] T010 [P] Add `packages/scripts/src/lib/error-codes.ts` exporting the `error_code` enum (`validation_failed`, `message_too_long`, `rate_limited`, `retrieval_unavailable`, `model_unavailable`, `host_api_unreachable`, `internal_error`) per `contracts/chat-endpoint.md §7`
- [X] T011 [P] Write Handlebars template `packages/backend/src/lib/logger.ts.hbs` — pino configuration with a header redaction serializer (`authorization`, `cookie`, `set-cookie`, `x-*-token`, `x-*-auth`, `x-*-session`) per `research §13`
- [X] T012 [P] Write Handlebars template `packages/backend/src/lib/errors.ts.hbs` — typed error classes (`ValidationError`, `RetrievalError`, `ModelUnavailableError`, `HostApiError`, `RateLimitError`) and `errorToResponse(err, requestId)` mapper per `contracts/chat-endpoint.md §7`
- [X] T013 [P] Write Handlebars template `packages/backend/src/lib/credential-strip.ts.hbs` — Fastify `onRequest` hook removing `Authorization`, `Cookie`, `Set-Cookie`, `/^X-.*-(Token|Auth|Session)$/i` headers, logging count only per `contracts/chat-endpoint.md §4, §6`
- [X] T014 [P] Write Handlebars template `packages/backend/src/lib/cors.ts.hbs` — `@fastify/cors` registration reading `ALLOWED_ORIGINS` (comma-separated) per `contracts/chat-endpoint.md §9`
- [X] T015 [P] Write Handlebars template `packages/backend/src/lib/rate-limit.ts.hbs` — `@fastify/rate-limit` registration keyed on `X-Atw-Session-Id` header with IP fallback per `research §3`
- [X] T016 [P] Write Handlebars template `packages/backend/src/lib/embedding.ts.hbs` — `@xenova/transformers` pipeline wrapper re-using the image-cached `bge-small-multilingual-v1.5` model
- [X] T017 [P] Write Handlebars template `packages/backend/src/lib/pii-scrub.ts.hbs` — conservative regex scrubber (email, international phone, 13–19 digit card, IBAN prefix) per `research §7`
- [X] T018 [P] Write Handlebars template `packages/backend/src/config.ts.hbs` — resolves every env var from `contracts/chat-endpoint.md §9` with typed defaults; fails fast on missing required vars per FR-039
- [X] T019 [P] Write Handlebars template `packages/backend/src/routes/health.ts.hbs` — `GET /health` returning 200 on `SELECT 1` success within 250 ms, 503 otherwise per `contracts/chat-endpoint.md §8`
- [X] T020 [US-all] Extend Handlebars template `packages/backend/src/index.ts.hbs` — bootstrap Fastify with logger, request-id, credential-strip, CORS, rate-limit plugins; mount `/health`; placeholder mount for `/v1/chat` filled in US1
- [X] T021 [P] Create widget entry `packages/widget/src/index.ts` — reads `document.currentScript`'s `data-*` attributes per `contracts/widget-config.md §1`, generates/persists `sessionId` in `sessionStorage`, injects launcher element, exposes `window.AtwWidget.version`; fail-loud path for missing required attrs
- [X] T022 [P] Create `packages/widget/src/state.ts` — `@preact/signals`-backed `ConversationState` (`turns`, `sessionId`, `isSending`, `open`, `pendingAction`, `lastError`, `lastRequestId`) per `data-model.md §3.2`
- [X] T023 [P] Create `packages/widget/src/auth.ts` — `buildAuthHeaders(config)` for cookie / bearer / custom modes; refuses to attach auth to calls targeting `config.backendUrl` per `contracts/widget-config.md §5`
- [X] T024 [P] Create `packages/widget/src/theme.css` — default CSS custom properties per `contracts/widget-config.md §7`
- [X] T025 Unit test `packages/widget/test/auth.unit.test.ts` — each mode produces the expected headers; backend URL never gets auth; bearer re-reads localStorage on every call (depends on T023)
- [X] T026 Unit test `packages/scripts/test/runtime-types.unit.test.ts` — zod round-trip for every shape in `data-model.md §1` (depends on T009)

**Checkpoint**: Foundation ready — US1–US10 implementation can now begin.

---

## Phase 3: User Story 1 — Grounded answer from the catalog (Priority: P1) 🎯 MVP

**Goal**: The widget asks a flavour-profile question, the backend retrieves real entities, Opus answers citing them, and the widget renders the reply with navigable citations. Grounded, non-fabricated, no actions yet.

**Independent Test**: On the Aurelia demo, send a flavour-profile question, verify the reply cites ≥ 2 real products whose facts trace to `atw_documents`, within 4 s (p50).

### Implementation for User Story 1

- [X] T027 [P] [US1] Write Handlebars template `packages/backend/src/lib/retrieval.ts.hbs` (extends the Feature 002 stub) — parameterised `runRetrieval(embedding, threshold, topK, client)` returning `RetrievalHit[]`, including similarity calculation per `contracts/chat-endpoint.md §4 step 7`
- [X] T028 [P] [US1] Write Handlebars template `packages/backend/src/lib/opus-client.ts.hbs` — single-turn `createMessage({ system, history, message, retrievalContext })` call with `@anthropic-ai/sdk`, no tool use yet; returns text content + usage
- [X] T029 [P] [US1] Write Handlebars template `packages/backend/src/lib/retrieval-context.ts.hbs` — formats `RetrievalHit[]` as the XML-tagged context block per `contracts/chat-endpoint.md §4 bottom`
- [X] T030 [P] [US1] Write Handlebars template `packages/backend/src/prompts.ts.hbs` — `SYSTEM_PROMPT` rendered from `{{projectBrief}}` + `{{actionManifest}}` with the anti-fabrication clause per `research §5` (consumes build-time context that Feature 002's `atw-render-backend` already passes)
- [X] T031 [US1] Write Handlebars template `packages/backend/src/routes/chat.ts.hbs` — `POST /v1/chat` handler: validate body → embed → retrieve → scrub → opus single-turn → compose `ChatResponse` with citations only (actions left empty for US1) per `contracts/chat-endpoint.md §4 steps 1–11` (depends on T027, T028, T029, T030)
- [X] T032 [US1] Mount the chat route in `packages/backend/src/index.ts.hbs` (finalize the placeholder from T020; depends on T031)
- [X] T033 [P] [US1] Create widget component `packages/widget/src/launcher.ts` — clickable `<button>` injected into `document.body`, `aria-label`, visible focus ring per `contracts/widget-config.md §2, §8`
- [X] T034 [P] [US1] Create widget component `packages/widget/src/panel.tsx` — Preact panel with `role="dialog"` + `aria-modal="true"`, focus trap on open, close on Esc per `contracts/widget-config.md §2, §8`
- [X] T035 [P] [US1] Create widget component `packages/widget/src/markdown.ts` — `marked` with `{ gfm: true, breaks: false, headerIds: false }` piped through `DOMPurify` with the allowlist from `research §9`
- [X] T036 [P] [US1] Create widget component `packages/widget/src/message-list.tsx` — renders user/assistant turns, citations as inline links opening in the same tab, `role="log"` + `aria-live="polite"` per `contracts/widget-config.md §3, §8`
- [X] T037 [P] [US1] Create widget component `packages/widget/src/input.tsx` — textarea + send button, Enter sends / Shift+Enter newline, disabled during send per `contracts/widget-config.md §3`
- [X] T038 [P] [US1] Create widget client `packages/widget/src/api-client.ts` — `postChat(request, config)` with `X-Atw-Session-Id` header, zod-parses response, surfaces `error_code` to the state, never attaches auth to `config.backendUrl` per `contracts/widget-config.md §3, §5`
- [X] T039 [US1] Create widget stylesheet `packages/widget/src/styles.css` — component styles importing `theme.css`; panel layout, message bubbles, citation link style (depends on T024)
- [X] T040 [US1] Wire panel + message-list + input + api-client in `packages/widget/src/index.ts` so US1 end-to-end renders (depends on T021, T033–T038)
- [X] T041 [P] [US1] Unit test `packages/widget/test/markdown.unit.test.ts` — sanitiser kills `<script>`, `javascript:` URIs, inline event handlers; renders allowlisted tags (depends on T035)
- [X] T042 [P] [US1] Unit test `packages/widget/test/api-client.unit.test.ts` — outbound request carries `X-Atw-Session-Id`, no `Authorization`/`Cookie`; zod parse failure surfaces friendly error (depends on T038)
- [X] T043 [P] [US1] Contract test `packages/backend/test/chat.contract.test.ts` — real pgvector testcontainer seeded with 10 fixture documents, mock Opus returning a stub reply; asserts 200 + valid `ChatResponse`, citations reference seeded entity_ids, request_id echoed (depends on T031)
- [X] T044 [US1] Integration test `tests/integration/runtime-chat-grounded.test.ts` — boots the full stack via `docker-compose.test.yml`, sends the Story 1 scripted query, asserts reply cites ≥ 2 seeded products and returns within 4 s (SC-001); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: `/v1/chat` grounded happy path works end-to-end. MVP baseline achieved.

---

## Phase 4: User Story 2 — Action with confirmation (Priority: P1)

**Goal**: The backend emits action intents; the widget renders a confirmation card; only a user click triggers the host-API call, which runs with the shopper's own credentials.

**Independent Test**: Continue the US1 conversation, ask to add an item to cart; card appears, host cart does not change until confirm click; after click cart updates within 2 s (SC-002).

### Implementation for User Story 2

- [X] T045 [P] [US2] Write Handlebars template `packages/backend/src/tools.ts.hbs` — renders `SAFE_READ_TOOLS` and `ACTION_TOOLS` arrays from `{{actionManifest}}` per `contracts/chat-endpoint.md §5`
- [X] T046 [P] [US2] Write Handlebars template `packages/backend/src/lib/tool-execution.ts.hbs` — safe-read executor making HTTP calls against `HOST_API_BASE_URL` with `HOST_API_KEY` (or none); 8 s timeout; 4 KB body truncation per `contracts/chat-endpoint.md §5`
- [X] T047 [P] [US2] Write Handlebars template `packages/backend/src/lib/action-intent.ts.hbs` — `buildActionIntent(toolCall, sessionContext, manifest)` resolves `{path.params}` from `SessionContext`; drops intents with unresolved vars and returns a synthetic `tool_result` error for the model per `contracts/chat-endpoint.md §5`
- [X] T048 [US2] Extend `packages/backend/src/lib/opus-client.ts.hbs` — full tool-use loop on `stop_reason === 'tool_use'`, invoking `tool-execution` for safe-reads and accumulating `ActionIntent[]` for action tools, capped at `MAX_TOOL_CALLS_PER_TURN` per `contracts/chat-endpoint.md §4 step 9` (depends on T045, T046, T047)
- [X] T049 [US2] Extend `packages/backend/src/routes/chat.ts.hbs` — surface `actions[]` on `ChatResponse`; enforce action-tool allowlist pre-emit (depends on T048)
- [X] T050 [P] [US2] Create widget component `packages/widget/src/action-card.tsx` — Preact component rendering `intent.description`, `intent.summary` key/value pairs, Cancel + primary buttons; click path calls `executeAction` only on primary click per `contracts/widget-config.md §4`
- [X] T051 [US2] Extend `packages/widget/src/api-client.ts` — `executeAction(intent, config)` runs `assertToolAllowed` then `fetch` against `apiBaseUrl` with headers from `buildAuthHeaders`; posts `ActionFollowUp` back to the backend on resolution per `contracts/widget-config.md §4, §5` (depends on T023, T050)
- [X] T052 [US2] Extend `packages/widget/src/state.ts` + `message-list.tsx` — render action cards inline between turns; transition `pendingAction` to null after confirm/cancel (depends on T050)
- [X] T053 [P] [US2] Unit test `packages/widget/test/action-card.unit.test.ts` — primary click → 1 `fetch`; cancel → 0 `fetch`; unknown-tool throws `ATW_TOOL_NOT_ALLOWED` → 0 `fetch` (depends on T050, T051)
- [X] T054 [P] [US2] Contract test `packages/backend/test/action-intent.contract.test.ts` — given a mocked Opus tool-use output for `add_to_cart`, handler emits the expected `ActionIntent` with resolved path and `confirmation_required: true` (depends on T048, T049)
- [X] T055 [US2] Integration test `tests/integration/runtime-action-confirmation.test.ts` — Playwright: run full US1 → US2 flow against the demo stack, assert host cart unchanged before click, changed within 2 s after click (SC-002); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: Confirmation-gated actions work end-to-end. Principle IV is structurally enforced in the widget.

---

## Phase 5: User Story 3 — Multi-turn memory within a session (Priority: P1)

**Goal**: The widget forwards conversation history with each request; Opus resolves pronouns and implicit references to the prior turn's entity.

**Independent Test**: Ask about a product, then send a pronoun-bearing follow-up; the second reply resolves the pronoun correctly (SC-003).

### Implementation for User Story 3

- [X] T056 [US3] Extend `packages/widget/src/state.ts` — `turns` signal appends on send/receive, trims to `MAX_CONVERSATION_TURNS` (20) via FIFO; sessionId persists per tab
- [X] T057 [US3] Extend `packages/widget/src/api-client.ts` — always include the current `turns` in the outgoing `ChatRequest.history` (depends on T056)
- [X] T058 [US3] Extend `packages/backend/src/routes/chat.ts.hbs` — enforce 20-turn cap on incoming `history`; when trimming occurs inject a short system note `(conversation trimmed — earlier turns omitted)` into the Opus call context
- [X] T059 [P] [US3] Unit test `packages/widget/test/state.unit.test.ts` — FIFO trim keeps 20 most-recent turns; sessionId survives tab-local reopen (depends on T056)
- [X] T060 [US3] Integration test `tests/integration/runtime-multi-turn.test.ts` — scripted 5-turn session naming the entity only in turn 1; asserts ≥ 4/4 follow-ups resolve the pronoun (SC-003); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: P1 MVP stories except the demo-wire story (US4) are functionally complete.

---

## Phase 6: User Story 4 — Reproducible demo from a fresh clone (Priority: P1)

**Goal**: `make demo` on a fresh clone brings the full Aurelia storefront + widget online in < 3 min with a pre-built index, pre-generated Feature 001/002 artefacts, and deterministic seed data (SC-005).

**Independent Test**: On a fresh machine with Docker + `ANTHROPIC_API_KEY`, run `make demo`, open `http://localhost:8000`, send the Story 1 scripted query, receive a grounded reply. All within 3 minutes.

### Demo wiring for User Story 4

- [X] T061 [P] [US4] Create `demo/medusa/backend/Dockerfile` based on `medusajs/medusa` v2 with ENV wiring for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, `STORE_CORS` per `contracts/compose.md §1.3`
- [X] T062 [P] [US4] Create `demo/medusa/storefront/Dockerfile` based on Medusa Next.js starter; build stage copies `dist/widget.js` + `dist/widget.css` into `public/` per `contracts/compose.md §3 Option A`
- [X] T063 [P] [US4] Create `demo/medusa/storefront/app/layout.tsx` override — adds the widget `<link>` + `<script>` tag with `data-backend-url`, `data-api-base-url`, `data-auth-mode=cookie`, `data-locale=es-ES`
- [X] T064 [P] [US4] Create `demo/medusa/seed/products.json` — 300 specialty coffee products with realistic tasting notes, origin, material, variants per `research §11`
- [X] T065 [P] [US4] Create `demo/medusa/seed/categories.json` — 25 categories
- [X] T066 [P] [US4] Create `demo/medusa/seed/collections.json` — 12 collections
- [X] T067 [P] [US4] Create `demo/medusa/seed/regions.json` — 4 regions (EU, US, UK, CA)
- [X] T068 [P] [US4] Create `demo/medusa/seed/customers.json` — 3 sample demo customers (synthetic, marked as such in README) for the US6 personalised-query demo
- [X] T069 [P] [US4] Create `demo/medusa/seed/orders.json` — 6 sample orders linked to the demo customers
- [X] T070 [US4] Create `demo/medusa/seed/seed.ts` — idempotent Medusa CLI seeder: opens a transaction, truncates relevant tables, reinserts all JSON rows (depends on T064–T069)
- [X] T071 [P] [US4] Pre-build Feature 001 artefacts under `demo/atw-aurelia/.atw/config/` — `brief.md`, `project.md` matching the seeded catalog vocabulary
- [X] T072 [P] [US4] Pre-build Feature 001 artefacts under `demo/atw-aurelia/.atw/artifacts/` — `schema-map.md`, `action-manifest.md`, `build-plan.md` per the Medusa schema; `action-manifest.md` marks `list_products`/`get_product`/`list_regions` as safe-read and `add_to_cart`/`remove_from_cart` as action tools
- [ ] T073 [US4] Generate the ATW Postgres dump used at first boot — run `/atw.build` offline against the demo seed, export the resulting `atw_documents` via `pg_dump` to `demo/atw-aurelia/atw.sql`; committed so first-boot import is offline and deterministic per Principle VIII
- [ ] T074 [US4] Finalize top-level `docker-compose.yml` — replace the skeleton from T008 with full service definitions + pinned image digests for `postgres:16-alpine`, `redis:7-alpine`, `pgvector/pgvector:pg16` per `contracts/compose.md §1, §8`
- [ ] T075 [US4] Add init-script volume mount on `atw_postgres` to import `demo/atw-aurelia/atw.sql` on first boot (runs only when the named volume is empty) per `contracts/compose.md §1.5`
- [X] T076 [P] [US4] Create `docker-compose.test.yml` overlay per `contracts/compose.md §7` — mock Anthropic, `RATE_LIMIT_MAX=3`, init-script disabled so tests seed their own data
- [X] T077 [US4] E2E test `tests/e2e/aurelia-demo.spec.ts` (Playwright) — the scripted 5-turn demo conversation: grounded query → comparison → add-to-cart confirmation → cart updates → anonymous-fallback check; asserts citations navigate to real product URLs (SC-005, SC-007, SC-011, SC-015); gated by `ATW_E2E_DOCKER=1`
- [X] T078 [P] [US4] Document the reviewer path and fresh path in `README.md` — replace/extend the current quickstart to call out `make demo` and point to `specs/003-runtime/quickstart.md` (the P1 story's key deliverable as far as reviewers see)

**Checkpoint**: MVP (US1 + US2 + US3 + US4) complete. The live demo runs end-to-end on a fresh clone in under 3 minutes.

---

## Phase 7: User Story 5 — Comparison across catalog entities (Priority: P2)

**Goal**: A "A vs B" query retrieves both entities and produces a grounded side-by-side reply.

**Independent Test**: Ask "Colombia Huila vs Ethiopia Guji — which for V60?"; reply references both by name with grounded facts per product (SC-001 sub-case).

### Implementation for User Story 5

- [X] T079 [US5] Verify the current retrieval settings (`RETRIEVAL_TOP_K=8`) surface both named entities on the Aurelia seed; if not, tune `RETRIEVAL_TOP_K` per `contracts/chat-endpoint.md §9` and document the decision inline — **Default kept at 8. Invariant covered by `runtime-comparison.test.ts` (T081); final verification piggybacks on T116 full-suite run.**
- [X] T080 [US5] Extend the prompt in `packages/backend/src/prompts.ts.hbs` with a terse "when the user compares two items, cite facts from both retrieved entities" hint — reinforces Opus's baseline behaviour without encouraging invention
- [X] T081 [US5] Integration test `tests/integration/runtime-comparison.test.ts` — scripted "A vs B" query against the Aurelia seed; asserts both entity IDs appear in `citations[]` and each is referenced in the reply text (SC-001 sub-case); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: Grounded comparisons work. No new infrastructure; a story that is mostly a proof-of-retrieval.

---

## Phase 8: User Story 6 — Authentication inheritance (Priority: P2)

**Goal**: A logged-in shopper asks a personalised question; the widget calls the host API with the shopper's own cookie, results flow back into Opus, the reply is personalised — all without the backend seeing credentials.

**Independent Test**: Log into Aurelia, open the widget, ask "what did I order last time?"; reply summarises the real orders; backend logs show zero credential headers (SC-006).

### Implementation for User Story 6

- [X] T082 [US6] Extend `packages/backend/src/tools.ts.hbs` classification — mark `list_my_orders`, `get_my_cart` as **action** tools (they need the shopper's auth) so the backend does NOT execute them server-side; widget executes with the shopper's credentials and posts results back via `ActionFollowUp`
- [X] T083 [US6] Extend `packages/widget/src/action-card.tsx` — for "personalised-read" actions that auto-confirm (optional future), but in V1 still requires a click; auto-runs an `ActionFollowUp` post-success (depends on T051)
- [X] T084 [P] [US6] Unit test `packages/backend/test/credential-strip.unit.test.ts` — the `onRequest` hook strips each blocked header and increments the counter; returns the request untouched for other headers (depends on T013)
- [X] T085 [US6] Integration test `tests/integration/runtime-credential-sovereignty.test.ts` — Playwright-with-request-interception: send a full 10-turn conversation (login + personalised question + action), grep all captured backend logs and backend-bound fetch bodies for any `authorization`/`cookie`/token patterns; assert zero matches (SC-006); gated by `ATW_E2E_DOCKER=1`
- [X] T086 [US6] Integration test `tests/integration/runtime-auth-modes.test.ts` — spin up three widget mounts (cookie / bearer / custom), each against a stubbed host API asserting the expected Authorization header shape; verifies `buildAuthHeaders` across modes end-to-end (FR-022); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: Principle I is structurally enforced at the wire. Zero credentials reach the backend.

---

## Phase 9: User Story 7 — Graceful degradation for anonymous shoppers (Priority: P2)

**Goal**: An anonymous shopper asking a personalised question receives a helpful "please log in" reply with a login link when configured.

**Independent Test**: In private browsing, open the widget, ask "what did I order last time?"; reply is a friendly login prompt; the optional `data-login-url` is rendered as a link (SC-004).

### Implementation for User Story 7

- [X] T087 [US7] Extend `packages/widget/src/action-card.tsx` + `api-client.ts` — on host-API 401/403, transition card to `failed` with a "please log in first" message and a login link built from `config.loginUrl` per `contracts/widget-config.md §6`
- [X] T088 [US7] Extend `packages/widget/src/message-list.tsx` — render the backend's assistant message that translates a 401 tool result into the "please log in first" reply; passes through Opus naturally because Opus sees the 401 as a tool result
- [X] T089 [US7] Integration test `tests/integration/runtime-anonymous-fallback.test.ts` — unauthenticated session asks the personalised question; asserts 100% of runs produce the friendly reply and a visible login link (SC-004); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: The runtime has a humane failure path for anonymous users.

---

## Phase 10: User Story 8 — Guided integration with `/atw.embed` (Priority: P2)

**Goal**: The Builder runs `/atw.embed`, answers an interview, and gets a framework-tailored integration guide at `.atw/artifacts/embed-guide.md`.

**Independent Test**: In a project with Feature 002 output, run `/atw.embed`, answer for Next.js App Router; verify the generated guide produces a working widget when pasted into a sample host (SC-014).

### Implementation for User Story 8

- [X] T090 [P] [US8] Create `commands/atw.embed.md` slash-command markdown — interactive prompt per `contracts/embed-command.md §1.2`; delegates to `npx atw-embed`
- [X] T091 [P] [US8] Create `packages/scripts/src/embed.ts` — reads `.atw/state/embed-answers.md` (with sensible per-field defaults), validates URL / enum values, renders selected framework template to `.atw/artifacts/embed-guide.md` per `contracts/embed-command.md §2, §3`
- [X] T092 [P] [US8] Create `packages/scripts/bin/atw-embed.js` shim with `--help`, `--version`, `--answers-file`, `--output`, `--frozen-time` flags per `contracts/embed-command.md §5`
- [X] T093 [P] [US8] Create embed template `packages/scripts/src/embed-templates/next-app-router.hbs` — full guide for Next.js App Router per `contracts/embed-command.md §2.2`
- [X] T094 [P] [US8] Create embed template `packages/scripts/src/embed-templates/next-pages-router.hbs` — Next.js Pages Router variant
- [X] T095 [P] [US8] Create embed template `packages/scripts/src/embed-templates/plain-html.hbs` — plain HTML site variant
- [X] T096 [P] [US8] Create embed template `packages/scripts/src/embed-templates/custom.hbs` — catch-all with copy/paste `<script>` and documentation links
- [X] T097 [US8] Extend `packages/installer/bin/create-atw.js` to copy `commands/atw.embed.md` into the Builder's `.claude/commands/` per Feature 001's installer pattern
- [X] T098 [P] [US8] Unit test `packages/scripts/test/embed.unit.test.ts` — same answers produce byte-identical output (SHA-256 stable); flipped framework answer produces a material diff (depends on T091, T093–T096)
- [X] T099 [P] [US8] Contract test `packages/scripts/test/embed.contract.test.ts` — CLI surface (exit codes 0/1/3/4/17) per `contracts/embed-command.md §4` (depends on T092)
- [X] T100 [US8] Integration test `tests/integration/embed-guide-roundtrip.test.ts` — for each of `next-app-router`, `plain-html`, `custom`, drop the generated `<script>` snippet into `tests/fixtures/embed-hosts/<framework>/`, bring it up via Playwright, verify the widget loads and sends a successful chat (SC-014); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: Builders on supported frameworks can integrate the widget with one run of `/atw.embed`.

---

## Phase 11: User Story 9 — Host-matching theming without rebuilds (Priority: P3)

**Goal**: Setting a CSS custom property on the host reflects in the widget without rebuilding the bundle (SC-012).

**Independent Test**: Edit `--atw-primary-color` on the host page, reload, see the widget's primary colour change.

### Implementation for User Story 9

- [X] T101 [P] [US9] Extend `packages/widget/src/theme.css` — full CSS custom property set per `contracts/widget-config.md §7`; defaults chosen to hit the 4.5:1 contrast target for `--atw-text-color` on `--atw-background-color`
- [X] T102 [P] [US9] Extend `packages/widget/src/styles.css` — every component uses `var(--atw-*)` references; no hard-coded colours in component styles (depends on T101)
- [X] T103 [US9] Integration test `tests/integration/runtime-theming.test.ts` — Playwright on three browsers: mount widget, override `--atw-primary-color` on the host, assert computed style of the primary button changes without rebuilding the bundle (SC-012); gated by `ATW_E2E_DOCKER=1`

**Checkpoint**: Host-matching theming lands cleanly.

---

## Phase 12: User Story 10 — Runtime safety rails (Priority: P3)

**Goal**: Tampered responses with unknown tools are refused; rate-limited sessions get 429 + Retry-After; every enforcement is test-backed.

**Independent Test**: Inject a response with an unknown tool via dev tools → widget refuses; fire > 60 requests / 10 min from one session → backend returns 429 (SC-008, SC-010).

### Implementation for User Story 10

- [X] T104 [US10] Verify `packages/widget/src/api-client.ts:assertToolAllowed` is a hard gate on every `executeAction` call; update Fowler-esque doc comment linking to `contracts/widget-config.md §4`
- [X] T105 [US10] Integration test `tests/integration/runtime-tool-allowlist.test.ts` — Playwright with request-interception injects a fake `ActionIntent` with tool name `nuke_the_store`; asserts widget surfaces the error state, logs `ATW_TOOL_NOT_ALLOWED`, and makes zero host-API calls (SC-008); gated by `ATW_E2E_DOCKER=1`
- [X] T106 [US10] Integration test `tests/integration/runtime-rate-limit.test.ts` — fire 65 requests at `/v1/chat` with the same `X-Atw-Session-Id` inside 10 minutes; assert the 61st returns 429 with `Retry-After` header (SC-010); gated by `ATW_E2E_DOCKER=1`
- [X] T107 [US10] Extend Feature 002's `atw-compile-widget` script — fail the build when `widget.js.gz > 80 KB` or `widget.css.gz > 10 KB`; update its unit tests to assert the budget enforcement
- [X] T108 [US10] Integration test `tests/integration/runtime-bundle-size.test.ts` — asserts the same invariant on the compiled artefact (SC-009); Node-only, no Docker required

**Checkpoint**: Every SC with a safety-rail flavour is test-backed and green.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility automation, observability, cross-platform reproducibility, and release wrap.

- [X] T109 [P] E2E test `tests/e2e/accessibility.spec.ts` — Playwright + `@axe-core/playwright`, opens the widget panel on the demo stack, asserts zero high-impact WCAG 2.1 AA violations (SC-013); gated by `ATW_E2E_DOCKER=1`
- [X] T110 [P] Unit test `packages/backend/test/logger.unit.test.ts` — redaction serializer masks every blocked header; `req.id` appears on every log line (depends on T011)
- [X] T111 [P] Unit test `packages/backend/test/pii-scrub.unit.test.ts` — each regex pattern redacts expected strings; legitimate product copy left untouched (depends on T017)
- [X] T112 [P] Extend `packages/widget/src/panel.tsx` — `focus-trap` integration; unit test in `packages/widget/test/panel.unit.test.ts` asserts focus is trapped on open and restored on close (depends on T034)
- [X] T113 Update `README.md` — point to `specs/003-runtime/quickstart.md` as the V1 reproducibility path; expand the "Quickstart" section with the `make demo` / `make fresh` summary
- [X] T114 [P] Add `DEBUG=atw:*` logging to `packages/backend/src/routes/chat.ts.hbs`, `lib/opus-client.ts.hbs`, `lib/retrieval.ts.hbs` following the pattern set in Feature 002
- [ ] T115 [P] Run quickstart.md §2 (reviewer path) and §3 (fresh path) manually on macOS, Linux, and WSL2 reference environments per Principle VIII; record timing + platform-specific notes in `specs/003-runtime/post-impl-notes.md`
- [ ] T116 Run the full test suite: `npx vitest run` (unit + contract) + `npx playwright test` (E2E + accessibility) with `ATW_E2E_DOCKER=1`; assert zero failures and zero unexpected skips
- [ ] T117 [P] Commit the `demo/atw-aurelia/atw.sql` dump (T073 output) with a short README explaining how it was generated and how to regenerate it
- [ ] T118 Record a 3-minute demo video per Principle X narrative: compressed setup flow (`make fresh` → five `/atw.*` commands → `/atw.build` → `/atw.embed`, ~1 min) + live widget interaction (grounded answer + comparison + action + confirmation, ~1:30) + reproducibility statement (~30 s). Video artefact tracked outside the repo; this task closes the narrative loop required by Principle X

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately.
- **Phase 2 (Foundational)**: Depends on Phase 1. BLOCKS all user stories.
- **Phase 3 (US1 MVP)**: Depends on Phase 2.
- **Phase 4 (US2)**: Depends on Phase 3 (extends the chat route and api-client with action support).
- **Phase 5 (US3)**: Depends on Phase 3 (extends history handling). Safe to parallelise with Phase 4.
- **Phase 6 (US4)**: Depends on Phases 3 + 4 (needs grounded answer + action flow to demo end-to-end); can start the seed-data / docker-compose side in parallel with Phases 4–5.
- **Phase 7 (US5)**: Depends on Phase 3.
- **Phase 8 (US6)**: Depends on Phase 4.
- **Phase 9 (US7)**: Depends on Phase 8.
- **Phase 10 (US8)**: Depends only on Phase 1 (the slash command and guide templates are independent of the running backend/widget).
- **Phase 11 (US9)**: Depends on Phase 3.
- **Phase 12 (US10)**: Depends on Phases 3, 4, and 6.
- **Phase 13 (Polish)**: Depends on all desired user-story phases.

### Within Each User Story

- Library code before the scripts/handlers that use it.
- Tests are written alongside or after implementation (Principle VIII privileges reproducibility over test-first; we still guard every SC with an automated test before the Checkpoint fires).
- File-based coordination: tasks touching the same file must run sequentially.

### Parallel Opportunities

- Phase 2's 18 `[P]`-tagged tasks cover the entire foundational scaffold; three developers can finish foundational in a sprint.
- Phase 3 has 12 `[P]`-tagged implementation tasks across backend and widget — 2–3 developers can close US1 in a weekend.
- Phase 4 has 5 `[P]`-tagged tasks.
- Phase 6 has 10 `[P]`-tagged tasks — demo wiring parallelises very well.
- Phase 10 (US8) is almost fully `[P]` (8 of 11 tasks) because the embed templates + the script are independent files.
- Phase 13 (Polish) is almost entirely `[P]`.

---

## Parallel Example: User Story 1

```bash
# Phase 3 backend templates (launch together — different files, no dependencies among the group):
Task: "T027 Write retrieval.ts.hbs in packages/backend/src/lib/"
Task: "T028 Write opus-client.ts.hbs (single-turn) in packages/backend/src/lib/"
Task: "T029 Write retrieval-context.ts.hbs in packages/backend/src/lib/"
Task: "T030 Write prompts.ts.hbs in packages/backend/src/"

# Phase 3 widget components (launch together — different files):
Task: "T033 Create launcher.ts in packages/widget/src/"
Task: "T034 Create panel.tsx in packages/widget/src/"
Task: "T035 Create markdown.ts in packages/widget/src/"
Task: "T036 Create message-list.tsx in packages/widget/src/"
Task: "T037 Create input.tsx in packages/widget/src/"
Task: "T038 Create api-client.ts in packages/widget/src/"

# T031 (chat route), T032 (mount), T040 (wire widget) run sequentially at the tail.
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US3 + US4 — all P1)

1. Complete Phase 1 (Setup) — one afternoon.
2. Complete Phase 2 (Foundational) — one developer-day.
3. Complete Phase 3 (US1) — 1–2 developer-days to grounded reply.
4. Complete Phase 4 (US2) — actions + confirmation gate.
5. Complete Phase 5 (US3) — history handling.
6. Complete Phase 6 (US4) — demo wiring; critical for the reviewer / judge experience.
7. **STOP and VALIDATE**: Run `tests/e2e/aurelia-demo.spec.ts` green → MVP ready for demo.

### Incremental Delivery (Post-MVP)

8. US5 (comparison) — ~half a day; mostly verification + a prompt nudge.
9. US6 (auth passthrough) — unlocks personalised queries without violating Principle I.
10. US7 (anonymous fallback) — humane degradation; bolts onto US6.
11. US8 (`/atw.embed`) — onboards Builders beyond Aurelia.
12. US9 (theming) — visual polish.
13. US10 (safety rails) — hardens against adversarial inputs + cost.
14. Polish (Phase 13) — accessibility, logging, cross-platform quickstart, demo video.

### Parallel Team Strategy

With three developers:

- **After Phase 2 completes**: Dev A takes US1 backend (T027–T032, T043–T044); Dev B takes US1 widget (T033–T042); Dev C starts US4 demo wiring (T061–T074) in parallel since those are independent files.
- **Phases 4–5 land**: Dev A on US2 backend; Dev B on US2 widget + US3; Dev C continues US4.
- **US4 ships**: all three converge on US6–US10 and Polish.

---

## Notes

- Tests are first-class. Every SC has at least one automated enforcement. Docker-gated tests use `ATW_E2E_DOCKER=1` exactly like Feature 002's gating.
- Every task names a concrete file path. Tasks extending an existing file (e.g., T048 extending `opus-client.ts.hbs`) name the file being edited.
- `[P]` within a phase means different files and no ordering dependency among the group.
- Commit after each logical group (setup done, foundational done, US1 backend + widget green, actions flowing, demo up, etc.).
- When a task's acceptance depends on a specific FR or SC, the task names it inline for traceability.
- No task writes spec.md, plan.md, or other design documents — those are owned by the speckit planning phase.

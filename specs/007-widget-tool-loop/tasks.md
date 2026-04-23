---
description: "Task list for Feature 007 — Widget-driven tool loop over a self-contained reference ecommerce"
---

# Tasks: Widget-driven tool loop over a self-contained reference ecommerce

**Input**: Design documents from `/specs/007-widget-tool-loop/`
**Prerequisites**: plan.md (read), spec.md (read), research.md (read), data-model.md (read), contracts/ (read), quickstart.md (read)

**Tests**: Contract tests are required by this feature (see `contracts/sovereignty-probe.md` and the explicit contract tests enumerated in `contracts/chat-endpoint-v2.md` and `contracts/action-catalog-v2.md`). Other test categories are optional and are not included unless they gate the acceptance scenarios.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing. US1 is the prerequisite testbed; US2/US3/US4 are the three demo-narrative stories that ride on the tool-loop collapse; US5 is the sovereignty verification; US6 is the degradation path.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on in-flight work)
- **[Story]**: Which user story this task belongs to (US1 … US6)
- Every task includes the exact file path(s) it touches.

## Path Conventions (this feature)

- New shop testbed: `demo/shop/backend/`, `demo/shop/frontend/`, `demo/shop/`.
- ATW package changes: `packages/backend/`, `packages/scripts/`, `packages/widget/`.
- Rendered demo artefacts under: `demo/atw-aurelia/.atw/`.
- Retired: `demo/medusa/` (deleted wholesale — FR-007).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold the `demo/shop/` workspace and the Docker Compose topology. No business logic yet.

- [ ] T001 Create directory tree under `demo/shop/` per plan.md Project Structure: `demo/shop/backend/src/{auth,routes,schemas}`, `demo/shop/backend/prisma/migrations`, `demo/shop/frontend/src/{pages,components,api,auth}`, `demo/shop/frontend/public/products/`.
- [ ] T002 [P] Initialize `demo/shop/backend/package.json` declaring Node ≥ 20, Fastify 4, `@fastify/swagger`, `@fastify/swagger-ui`, `@fastify/jwt`, `@sinclair/typebox`, `@prisma/client`, `prisma`, `bcryptjs`, `pino`. Add scripts: `dev`, `build`, `start`, `prisma:migrate`, `prisma:seed`.
- [ ] T003 [P] Initialize `demo/shop/backend/tsconfig.json` extending repo root `tsconfig.base.json`; set `outDir` to `dist`, `rootDir` to `src`, `module: "node16"`.
- [ ] T004 [P] Initialize `demo/shop/frontend/package.json` declaring Node ≥ 20, Vite 5, React 18, React Router 6, `@tanstack/react-query` 5, Tailwind CSS, TypeScript. Add scripts: `dev`, `build`, `preview`.
- [ ] T005 [P] Initialize `demo/shop/frontend/tsconfig.json` and `demo/shop/frontend/vite.config.ts` (proxy `/api/*` to backend on dev).
- [ ] T006 [P] Initialize `demo/shop/frontend/tailwind.config.ts`, `postcss.config.cjs`, and `src/index.css` with Tailwind directives.
- [ ] T007 Create `demo/shop/docker-compose.yml` with three services: `shop_postgres` (Postgres 16, pinned tag, dedicated named volume, non-5432 host port), `shop_backend` (builds `./backend/Dockerfile`, depends_on postgres healthy), `shop_frontend` (builds `./frontend/Dockerfile`, depends_on backend healthy). All images pinned to exact tags (Principle VIII).
- [ ] T008 [P] Create `demo/shop/backend/Dockerfile` (multi-stage Node 20 build: install, prisma generate, tsc build, prod image) and `demo/shop/backend/.dockerignore`.
- [ ] T009 [P] Create `demo/shop/frontend/Dockerfile` (Node 20 build stage → nginx/alpine static serve of `dist/`) and `demo/shop/frontend/.dockerignore`.
- [ ] T010 Create `demo/shop/README.md` stub documenting: quickstart (`docker compose up`), seeded credentials placeholder (filled in T015), shop backend port, OpenAPI endpoint URL.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Prisma schema, migrations, seed data, Fastify bootstrap with Swagger/JWT plugins. Every user story depends on these.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete.

- [ ] T011 Write `demo/shop/backend/prisma/schema.prisma` declaring models `User`, `Product`, `Cart`, `CartItem`, `Order`, `OrderItem` per [data-model.md](./data-model.md). Include unique constraints, CHECK constraints (on `quantity`, `price_cents`, `status`), indexes on `products(name)`, `products(description)` (GIN trigram), `orders(user_id, created_at DESC)`.
- [ ] T012 Run `prisma migrate dev --name init` inside `demo/shop/backend/` to materialise the migration under `prisma/migrations/`. Commit the generated SQL.
- [ ] T013 [P] Write `demo/shop/backend/src/db.ts` exporting a singleton Prisma client with connection pooling defaults.
- [ ] T014 [P] Write `demo/shop/backend/src/index.ts` as the Fastify bootstrap: register `@fastify/swagger` (OpenAPI 3.0, `info.title: "ATW Reference Shop"`, `info.version: "1.0.0"`), `@fastify/swagger-ui` at `/docs`, `@fastify/jwt` (secret from env `JWT_SECRET`), JSON schema validator, error handler, health route `GET /health`. Expose OpenAPI document at `GET /openapi.json`.
- [ ] T015 Write `demo/shop/backend/prisma/seed.ts`: deterministic seed inserting 3 users (documented creds in README) with bcrypt-hashed passwords and 20 handwritten coffee products with stable UUID v5 ids keyed off seed handles. Use Prisma `upsert` by unique key so re-runs are idempotent (Principle III). Register the seed command in `package.json` `prisma.seed`.
- [ ] T016 [P] Update `demo/shop/README.md` with the seeded credentials table (email + password) produced by T015.
- [ ] T017 [P] Write `demo/shop/backend/src/schemas/entities.ts` exporting TypeBox schemas for `Product`, `CartItem`, `Cart`, `Order`, `OrderItem`, and login `{email, password}` request / `{token, user}` response shapes. These schemas drive both runtime validation and the OpenAPI emission.

**Checkpoint**: `docker compose up -d shop_postgres shop_backend` must boot healthy, `curl /health` returns 200, `curl /openapi.json` returns a valid OpenAPI 3.x document with the `bearerAuth` security scheme declared. No routes yet; that is fine.

---

## Phase 3: User Story 1 — Reference ecommerce testbed runs standalone (Priority: P1) 🎯 MVP PART 1

**Goal**: `demo/shop` boots end-to-end; a shopper can log in, browse, add to cart, place an order, and see past orders — all without any ATW component running. This story delivers the entire testbed. It is the prerequisite for US2/US3/US4.

**Independent Test**: Clean clone → `cd demo/shop && docker compose up -d` → open storefront → log in as a seeded user → browse → add to cart → place order → see it in orders. Zero ATW involvement.

### Contract tests for User Story 1

- [ ] T018 [P] [US1] Contract test in `demo/shop/backend/test/openapi.contract.test.ts`: fetch `GET /openapi.json` from a running app instance; assert `info.title === "ATW Reference Shop"`, `components.securitySchemes.bearerAuth` exists, and each of the 10 operationIds from [contracts/shop-openapi.md](./contracts/shop-openapi.md) (`loginShopper`, `listProducts`, `getProduct`, `getCart`, `addCartItem`, `updateCartItem`, `removeCartItem`, `placeOrder`, `listMyOrders`, `getMyProfile`) is declared with the expected method/path and, for authenticated ones, references `bearerAuth`.

### Backend implementation for User Story 1

- [ ] T019 [P] [US1] Implement `demo/shop/backend/src/auth/bcrypt.ts` (hash + compare helpers) and `demo/shop/backend/src/auth/jwt.ts` (sign JWT with `{sub: userId, email}` payload using `@fastify/jwt`).
- [ ] T020 [US1] Implement `demo/shop/backend/src/routes/auth.ts` — `POST /auth/login` (unauthenticated): validate body, look up user by lowercase email, bcrypt-compare password, sign JWT, return `{token, user: {id, email, display_name}}`; 401 on mismatch. Register on Fastify app in `index.ts`.
- [ ] T021 [P] [US1] Implement `demo/shop/backend/src/routes/products.ts` — `GET /products` (unauth) with optional `q` query filtering `name` OR `description` case-insensitive substring; `GET /products/:id` (unauth) returning 404 on not-found. Register on app.
- [ ] T022 [US1] Implement `demo/shop/backend/src/routes/customers.ts` — `GET /customers/me` (bearerAuth) returning `{id, email, display_name}` from the JWT subject. Register on app.
- [ ] T023 [US1] Implement `demo/shop/backend/src/routes/cart.ts` — all four cart endpoints (`GET /cart`, `POST /cart/items`, `PATCH /cart/items/:id`, `DELETE /cart/items/:id`) with bearerAuth, upsert-by-(cart,product) on add, zero-quantity-deletes on patch, denormalised `product_name`/`unit_price_cents` in responses. Register on app.
- [ ] T024 [US1] Implement `demo/shop/backend/src/routes/orders.ts` — `POST /orders` (bearerAuth, body `{}`): atomic transaction that snapshots every `CartItem` into `OrderItem` with `product_name` and `unit_price_cents`, inserts `Order` row with status `"placed"` and summed `total_cents`, deletes cart items; 409 if cart empty. `GET /orders` (bearerAuth): list caller's orders in `created_at DESC` order including `OrderItem[]`. Register on app.
- [ ] T025 [US1] In `demo/shop/backend/src/index.ts`, tag every authenticated route with `security: [{bearerAuth: []}]` and a Fastify `preHandler` that verifies the JWT and sets `request.user`. Confirm `curl /openapi.json` now shows the `bearerAuth` reference on every authenticated operation (required by T018).

### Frontend implementation for User Story 1

- [ ] T026 [P] [US1] Implement `demo/shop/frontend/src/auth/token.ts` — encapsulates the `localStorage["shop_auth_token"]` contract: `getToken()`, `setToken(jwt)`, `clearToken()`. This module is the single ownership point of the key name (FR-006, Clarification Q3).
- [ ] T027 [P] [US1] Implement `demo/shop/frontend/src/api/client.ts` — `fetch` wrapper that prefixes `/api` (proxied in dev, configurable in prod), reads token via `auth/token.ts` and injects `Authorization: Bearer <token>` when present. Centralises 401 handling (clears token + redirects to `/login`).
- [ ] T028 [P] [US1] Implement `demo/shop/frontend/src/api/hooks.ts` — TanStack Query hooks wrapping the 9 shop endpoints the SPA consumes: `useLogin`, `useProducts(q)`, `useProduct(id)`, `useCart`, `useAddCartItem`, `useUpdateCartItem`, `useRemoveCartItem`, `usePlaceOrder`, `useOrders`, `useMe`. Set `refetchOnMount: true` on the cart-count query so every navigation refreshes it.
- [ ] T029 [P] [US1] Implement `demo/shop/frontend/src/components/CartIndicator.tsx` — reads `useCart()`, renders the count badge. Shows 0 when unauthenticated.
- [ ] T030 [US1] Implement `demo/shop/frontend/src/components/Layout.tsx` — shell with top nav (logo, search-page link, orders link, `CartIndicator`, login/logout). Renders `<Outlet/>`.
- [ ] T031 [P] [US1] Implement `demo/shop/frontend/src/pages/Login.tsx` — email + password form calling `useLogin`; on success stores token via `setToken()` and navigates to `/`.
- [ ] T032 [P] [US1] Implement `demo/shop/frontend/src/pages/ProductList.tsx` — search input bound to query param `?q=`, drives `useProducts(q)`, renders grid with image + name + price + "View" link.
- [ ] T033 [P] [US1] Implement `demo/shop/frontend/src/pages/ProductDetail.tsx` — reads `:handle` or `:id` from route, calls `useProduct`, shows detail + "Add to cart" button (calls `useAddCartItem`).
- [ ] T034 [P] [US1] Implement `demo/shop/frontend/src/pages/Cart.tsx` — lists cart items with quantity controls (wired to `useUpdateCartItem`, `useRemoveCartItem`), total, "Place order" button (`usePlaceOrder`). On success redirects to `/orders`.
- [ ] T035 [P] [US1] Implement `demo/shop/frontend/src/pages/Orders.tsx` — lists past orders with items, totals, dates via `useOrders`.
- [ ] T036 [US1] Wire up `demo/shop/frontend/src/App.tsx` and `main.tsx` with React Router (routes for `/login`, `/`, `/products/:handle`, `/cart`, `/orders`) wrapped in QueryClientProvider and Layout. Guard authenticated routes (redirect to `/login` when token missing).

**Checkpoint — US1 acceptance**: Compose-up, login as seeded user, browse, add items, place order, view orders — all work. OpenAPI contract test (T018) is green. No ATW involvement required yet.

---

## Phase 4: User Story 2 — Shopper gets grounded answer about own account (Priority: P1) 🎯 MVP PART 2

**Goal**: Collapse the split. ATW backend stops fetching the shop. Widget fetches with the shopper's bearer token, shows progress indicators, posts the result back, and Opus composes a grounded reply. This phase delivers the core tool-loop redesign. US3 and US4 ride on the same infrastructure.

**Dependency**: US1 complete (the shop must exist and expose authenticated `GET /orders`).

**Independent Test**: Shopper logged in on `demo/shop`, asks the widget "what were my last three orders?", sees `Obteniendo datos…` → `Datos obtenidos, interpretando…`, receives a numbered list grounded in the real shop response.

### Contract tests for User Story 2

- [ ] T037 [P] [US2] Contract test in `packages/backend/test/chat-endpoint-v2.contract.test.ts`: POST `/v1/chat` with a body carrying a `tool_result` block and `pending_turn_id`. Stub the retrieval module; assert zero calls to it. Stub the Anthropic SDK to return a `stop_reason === "end_turn"` response; assert the route returns `{text, citations}` without re-running retrieval. (Covers [contracts/chat-endpoint-v2.md](./contracts/chat-endpoint-v2.md) test #1.)
- [ ] T038 [P] [US2] Contract test in `packages/backend/test/chat-endpoint-v2.contract.test.ts` (same file, separate `it`): POST with `tool_call_budget_remaining: 0` while Anthropic returns `stop_reason === "tool_use"`; assert the route forces composition (`tool_choice: {type: "none"}`) and returns a final text response rather than emitting another `action_intent`. (Test #2.)
- [ ] T039 [P] [US2] Contract test in `packages/scripts/test/manifest-builder.credential-source.contract.test.ts`: run `manifest-builder` against a fixture OpenAPI declaring `bearerAuth` on `GET /orders`; assert the emitted action-catalog entry has `credentialSource: {type: "bearer-localstorage", key: "shop_auth_token", header: "Authorization", scheme: "Bearer"}`. Assert an unauthenticated operation (e.g. `GET /products`) has NO `credentialSource` block. (Covers [contracts/action-catalog-v2.md](./contracts/action-catalog-v2.md) test #1.)
- [ ] T040 [P] [US2] Contract test in `packages/scripts/test/manifest-builder.reproducibility.contract.test.ts`: run the builder twice against the same fixture; assert byte-identical `action-executors.json` (FR-022, test #2 in contracts/action-catalog-v2.md).

### Backend / build-pipeline changes for User Story 2

- [ ] T041 [US2] Amend `packages/backend/src/routes/chat.ts.hbs`: remove the `is_action === false → executeSafeRead` branch so every Opus `tool_use` block emits an `ActionIntent` unconditionally. Preserve the confirmation-required passthrough.
- [ ] T042 [US2] In the same file `packages/backend/src/routes/chat.ts.hbs`, add a request-body branch: when `tool_result` is present, skip retrieval/embedding entirely, append the Anthropic-shape `tool_result` block to `messages`, and call `messages.create()` again. Emit another `action_intent` if `stop_reason === "tool_use"` and budget > 0; else return composed `{text, citations}`.
- [ ] T043 [US2] In `packages/backend/src/routes/chat.ts.hbs`, implement the budget semantics from [contracts/chat-endpoint-v2.md](./contracts/chat-endpoint-v2.md): initialise `tool_call_budget_remaining = MAX_TOOL_CALLS_PER_TURN` (env, default 5) on initial posts; decrement on each emitted `action_intent`; force composition with `tool_choice: {type: "none"}` when budget ≤ 0.
- [ ] T044 [P] [US2] Delete `packages/backend/src/lib/tool-execution.ts.hbs` (the template that produces `executeSafeRead`). Remove every reference to `executeSafeRead` from `packages/backend/src/routes/chat.ts.hbs` and any other `.hbs` file.
- [ ] T045 [P] [US2] Amend `packages/backend/src/config.ts.hbs`: remove `HOST_API_BASE_URL` and `HOST_API_KEY` from the config shape and startup validation.
- [ ] T046 [US2] In `packages/scripts/src/render-backend.ts`, drop the `tool-execution.ts.hbs` entry from the list of rendered templates; drop any reference to `HOST_API_*` in the render-manifest generation. Ensure re-render produces a backend output directory with no `lib/tool-execution.ts`.
- [ ] T047 [US2] In `packages/scripts/src/lib/manifest-builder.ts`, add `credentialSource` emission per [contracts/action-catalog-v2.md](./contracts/action-catalog-v2.md): walk each operation, inspect OpenAPI `security`, emit the block when `bearerAuth` is required, pin `key` to `"shop_auth_token"` (v1 fixed). Fail the build with a clear error on any other non-`bearerAuth` security scheme.
- [ ] T048 [US2] In `packages/scripts/src/lib/types.ts` (and generated `dist/lib/types.d.ts`), extend the `ActionRecipe` type with optional `credentialSource?: BearerLocalStorageCredentialSource`. Add the new interface.

### Widget changes for User Story 2

- [ ] T049 [P] [US2] Implement `packages/widget/src/auth/token-source.ts` — declarative resolver for `credentialSource` blocks. For `type: "bearer-localstorage"`, reads `window.localStorage.getItem(key)` and returns `{header, value: "<scheme> <token>"}` or `null` when unset. Rejects unknown `type` values with a thrown error at catalog-load time (FR-021, fail-closed).
- [ ] T050 [US2] Amend `packages/widget/src/chat/action-runner.ts` — before executing a recipe's `fetch`, call `token-source.ts` to resolve credentials. If the recipe declares `credentialSource` but the token is missing, short-circuit and post back a synthetic tool_result `{is_error: true, status: 0, content: "not authenticated", truncated: false}` without fetching (US2 AC3).
- [ ] T051 [US2] In `packages/widget/src/chat/action-runner.ts`, fork on `confirmation_required`: when `false`, skip the confirmation card; insert an inline assistant-side placeholder message with literal text `"Obteniendo datos…"` (FR-010); execute `fetch()` with an `AbortController` wired to an 8000 ms timeout.
- [ ] T052 [US2] In `packages/widget/src/chat/action-runner.ts`, after the fetch resolves, truncate the response body to 4096 bytes, update the placeholder text to `"Datos obtenidos, interpretando…"`, POST `{messages, pending_turn_id, tool_result: {tool_use_id, content, is_error, status, truncated}, tool_call_budget_remaining: prev - 1}` to `/v1/chat`.
- [ ] T053 [US2] In `packages/widget/src/chat/action-runner.ts`, handle the server response: if another `action_intent` arrives, loop (render a new placeholder, fetch, post back); if a final `{text, citations}` arrives, replace the interim placeholder with the final assistant message.
- [ ] T054 [P] [US2] Extend the widget's message-model types (e.g. `packages/widget/src/chat/types.ts` or equivalent) to include the new "progress placeholder" message variant with a mutable text field so T051–T053 can swap `"Obteniendo datos…"` → `"Datos obtenidos, interpretando…"` → final text in place.

### Regenerate demo artefacts for User Story 2

- [ ] T055 [US2] Inside `demo/atw-aurelia`, run `/atw.setup` pointing at `http://localhost:<shop-port>/openapi.json`; accept the classification proposals. Commit the updated `.atw/` markdown artefacts (schema-map, action-manifest, build-plan).
- [ ] T056 [US2] Run `/atw.build` inside `demo/atw-aurelia`; commit the regenerated `action-executors.json`, `backend/`, `widget/` artefacts. Confirm `action-executors.json` contains `credentialSource` blocks on every authenticated tool.
- [ ] T057 [US2] Update `docker-compose.yml` at repo root: remove `HOST_API_BASE_URL` and `HOST_API_KEY` from `atw_backend` environment; add a depends_on-free networking path so `atw_backend` and `demo/shop/shop_backend` share the same compose network only if needed for the health endpoint (NOT for shop-API calls — Principle I).
- [ ] T058 [US2] Run the full US2 manual scenario end-to-end: log in on `demo/shop`, ask "what were my last three orders?" in the widget, confirm the two Spanish placeholders appear and the final answer references real order IDs/dates/totals. Record the trace in a comment on this task.

**Checkpoint — US2 acceptance**: "show me my last three orders" produces a grounded answer with the Spanish progress placeholders. `atw_backend` logs show zero outbound shop calls during the turn.

---

## Phase 5: User Story 3 — Shopper gets grounded answer about catalogue (Priority: P1)

**Goal**: Same tool-loop flow, now unauthenticated, for live catalogue reads. Validates that the loop works without a bearer token.

**Dependency**: US2 infrastructure (Phase 4) is the full implementation; this story is mostly validation of the unauthenticated path.

**Independent Test**: Unauthenticated shopper (or simply: no active session) asks "what's the price of the Midnight Roast?", sees progress placeholders, gets an answer matching the shop's live response.

- [ ] T059 [US3] In `packages/widget/src/chat/action-runner.ts` (already touched in T049/T050), verify the `credentialSource`-absent branch: a tool with no `credentialSource` runs without `Authorization` header. Add/confirm unit test coverage in the existing widget test suite.
- [ ] T060 [US3] Run US3 manual scenario: log out of `demo/shop`, ask the widget "what's the price of Midnight Roast 1 kg whole bean?". Confirm progress placeholders appear, fetch runs without auth header, answer matches the storefront price. Record the trace on this task.
- [ ] T061 [US3] Run US3 AC2 (not-found) manually: ask about a nonexistent product ("what's the price of the Mars Blend?"). Confirm the assistant states the product was not found rather than fabricating details (Principle V).

**Checkpoint — US3 acceptance**: both catalogue scenarios land correctly with no code changes beyond US2.

---

## Phase 6: User Story 4 — Shopper adds to cart with grounded confirmation (Priority: P1)

**Goal**: Preserve the confirmation card; extend writes with the same post-back leg so Opus composes a grounded conversational wrap-up that cites the new cart state AND directs the shopper to the cart page (Clarification Q4 — no live sync).

**Dependency**: US2 infrastructure.

**Independent Test**: Logged-in shopper asks "add 2 × Midnight Roast 1 kg whole bean to my cart"; confirmation card appears; on confirm, widget executes `addCartItem`; Opus's reply cites the new item count or total and tells the shopper to open the cart page.

- [ ] T062 [US4] In `packages/widget/src/chat/action-runner.ts`, extend the `confirmation_required: true` branch so that after a confirmed fetch completes successfully, the widget ALSO posts back a `tool_result` (mirroring the read path in T052) instead of terminating the turn. On decline, skip the fetch and post back `{is_error: false, content: "declined by shopper", status: 0}` so Opus can acknowledge the cancellation (US4 AC2).
- [ ] T063 [US4] Extend the widget's confirmation-card UI (`packages/widget/src/chat/` — wherever the card component lives) so that after confirmation + successful execution, the card transitions to a terminal "done" state and hands control to the progress-placeholder system for the interpretation round-trip (same `"Datos obtenidos, interpretando…"` label is fine; the card already showed that the fetch happened).
- [ ] T064 [US4] Run US4 AC1 manually: log in, ask widget to add 2 × Midnight Roast. Confirm the card appears; confirm; confirm the assistant's reply references at least one of `{item_count, total}` from the cart response AND explicitly tells the shopper to open the cart page. Record the trace on this task.
- [ ] T065 [US4] Run US4 AC3 manually: attempt to add a product whose id doesn't exist. Confirm the shop returns 404; widget posts back `is_error: true`; assistant composes a plain-language failure explanation and does not falsely claim success. Record the trace.

**Checkpoint — US4 acceptance**: cart adds produce grounded conversational confirmations that point the shopper to the cart page; failures degrade truthfully.

---

## Phase 7: User Story 5 — ATW deploys without shop config; sovereignty verifiable (Priority: P2)

**Goal**: Mechanise Principle I. Remove every remnant of shop-specific configuration from the ATW backend deployment, and wire the sovereignty probe into CI so future regressions fail the build.

**Dependency**: US2 (which already did most of the config removal).

**Independent Test**: Start `atw_backend` with zero shop-specific env vars; run the sovereignty probe; it passes. Reintroduce a `HOST_API_BASE_URL`-using `fetch(` in any rendered backend file; the probe fails.

- [ ] T066 [US5] Delete `packages/backend/test/safe-read.contract.test.ts` (and any other SafeRead contract test) since the behaviour it guarded no longer exists. Remove fixtures or imports that dangle after deletion.
- [ ] T067 [US5] Implement `packages/scripts/test/sovereignty.contract.test.ts` per [contracts/sovereignty-probe.md](./contracts/sovereignty-probe.md): scan the rendered backend output, parse every `.ts` with the TypeScript compiler API, visit every `CallExpression` whose callee resolves to `fetch`, classify the URL per the allowlist rules (string literal → allowlisted prefix; template literal → static head; identifier → follow to definition; anything else → fail closed), and fail the test if any call-site falls outside the allowlist.
- [ ] T068 [P] [US5] Wire the sovereignty probe into the CI command surface (whatever `packages/scripts` uses as its test entrypoint — `npm test` in that package). Confirm it runs in under 60 s (SC-008).
- [ ] T069 [P] [US5] Search repo-wide for lingering references to `HOST_API_BASE_URL`, `HOST_API_KEY`, or the string `executeSafeRead` in source (not in archived specs): `grep -r "HOST_API_BASE_URL\|HOST_API_KEY\|executeSafeRead" packages/ demo/ docker-compose.yml`. Every hit that is not a historical comment in `specs/003-runtime/` is a defect. Fix each by removing or migrating.
- [ ] T070 [US5] Update the root `README.md` (or the project's primary quickstart document) to reflect that ATW runs without `HOST_API_*` env vars. If the README does not yet exist, defer to the quickstart in [quickstart.md](./quickstart.md) and leave a TODO.
- [ ] T071 [US5] Run US5 acceptance manually per quickstart.md Step 6: confirm `atw_backend` log contains zero shop-API outbound calls during a full demo session; confirm `docker-compose.yml` contains no `HOST_API_*`; confirm the sovereignty probe is green.

**Checkpoint — US5 acceptance**: sovereignty is mechanically enforced. A regression fails in CI with a clear pointer.

---

## Phase 8: User Story 6 — Graceful degradation (Priority: P3)

**Goal**: Timeout path, network-error path, non-JSON path, and unresolved-tool path all synthesize structured `tool_result`s that let Opus compose plain-language explanations.

**Dependency**: US2 infrastructure.

**Independent Test**: Stop `shop_backend`; ask widget a question; within ~10 s (SC-007) the assistant responds with a plain-language failure message; widget does not hang.

- [ ] T072 [US6] In `packages/widget/src/chat/action-runner.ts`, handle the `AbortController` timeout (8000 ms): on `AbortError`, synthesize `{is_error: true, status: 0, content: "shop request timed out after 8 seconds"}` and post back (FR-015).
- [ ] T073 [US6] In the same file, handle non-2xx responses: capture the status and (truncated) body, set `is_error: true`, post back. Handle non-JSON responses: pass the body verbatim (truncated) with a flag/marker in `content` so Opus can say "the shop returned an unexpected format" (FR-019).
- [ ] T074 [US6] In `packages/widget/src/chat/action-runner.ts`, guard the intent dispatch: before fetching, look up the intent's `tool` name in the locally-loaded `action-executors.json`. If not found, synthesize `{is_error: true, status: 0, content: "tool <name> not found in widget catalog"}` and post back without fetching (FR-020).
- [ ] T075 [P] [US6] Extend the existing widget test suite with unit tests for the three synthetic-error paths (timeout, 5xx, unresolved-tool). Assert each produces the correct `tool_result` payload shape.
- [ ] T076 [US6] Run US6 acceptance manually per quickstart.md Step 5 degradation scenario: `docker compose stop shop_backend`; ask a question; confirm the widget reports failure within ~10 s with a plain-language reply. Restart the backend.

**Checkpoint — US6 acceptance**: every degradation path surfaces truthfully to the shopper.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Cleanup, the Medusa retirement, and a final reproducibility pass.

- [ ] T077 Delete `demo/medusa/` wholesale (all tracked files, including `storefront/`, `admin/`, `backend/`, seed dumps, compose files, and any `.atw/` artefacts pinned to the Medusa OpenAPI). Leave no residue (FR-007).
- [ ] T078 Remove any `medusa_*` service definitions, `medusa_*` named volumes, and `medusa_*` networks from the repo-root `docker-compose.yml`. Confirm `docker compose config` validates cleanly.
- [ ] T079 [P] Delete the Medusa-specific action-executors snapshot in `demo/medusa/storefront/public/action-executors.json` (gone via T077) and the duplicate under `demo/atw-aurelia/.atw/artifacts/action-executors.json` IF it still references Medusa operationIds; allow T056 to have already replaced it with the shop-based version.
- [ ] T080 [P] Update `specs/003-runtime/contracts/chat-endpoint.md` with a §5 addendum pointing at [contracts/chat-endpoint-v2.md](./contracts/chat-endpoint-v2.md) as the current authoritative contract (the v1 version remains as historical record; the addendum makes the supersession explicit).
- [ ] T081 [P] Update the `.atw/` build-plan template (wherever `/atw.build` records its outputs) to reflect that `lib/tool-execution.ts` is no longer rendered. Confirm re-running `/atw.build` does not try to render it.
- [ ] T082 Run `/atw.setup` + `/atw.build` inside `demo/atw-aurelia` a second time after all other tasks are complete. Confirm every step reports "unchanged" and `git status` is clean (SC-009 reproducibility invariant).
- [ ] T083 Run the quickstart.md end-to-end in under 10 minutes from a clean clone on at least one platform (macOS, Linux, or WSL2). Record the elapsed time and any deviations on this task (SC-001).
- [ ] T084 Final documentation sweep: verify `CLAUDE.md` points at the 007 plan (already done during plan phase), `demo/shop/README.md` has seeded credentials, and the root `README.md` (if present) does not reference Medusa.

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1 (Setup)**: starts immediately.
- **Phase 2 (Foundational)**: depends on Phase 1. BLOCKS all user stories.
- **Phase 3 (US1)**: depends on Phase 2. Unblocks Phases 4–8 (the shop must exist before the tool loop can exercise it).
- **Phase 4 (US2)**: depends on Phase 3. Delivers the tool-loop infrastructure; unblocks Phases 5–8 which all ride on the same infrastructure.
- **Phase 5 (US3)**: depends on Phase 4. Mostly validation of the unauthenticated path.
- **Phase 6 (US4)**: depends on Phase 4. Extends the confirmation-card path with the same post-back.
- **Phase 7 (US5)**: depends on Phase 4 (which did most of the removal). Adds the CI-enforced sovereignty probe.
- **Phase 8 (US6)**: depends on Phase 4. Adds the four degradation paths.
- **Phase 9 (Polish)**: depends on Phases 3–8. Medusa retirement, reproducibility gate, final quickstart run.

### User-story dependencies

- **US1**: no prerequisites (beyond Setup + Foundational).
- **US2**: requires US1 (the shop must accept authenticated requests).
- **US3**: requires US2 (shares the tool-loop infrastructure).
- **US4**: requires US2 (shares the tool-loop infrastructure and uses the confirmation card fork).
- **US5**: requires US2 (most of the config removal happens there).
- **US6**: requires US2 (the error-path synthesis happens in the widget's action-runner extended there).

### Parallel opportunities

- Phase 1: T002–T010 are almost entirely parallel; T001 first (creates the directories), T007 after T002/T004 (compose references Dockerfiles), T010 at any point.
- Phase 2: T013, T014, T017, T016 are parallel after T011/T012/T015 (schema + migration + seed).
- Phase 3 US1: backend routes (T019–T024) and frontend pages (T026–T035) are two large parallel streams once T017 (TypeBox schemas) and T028 (hooks) exist; many tasks inside each stream are parallel.
- Phase 4 US2: contract tests (T037–T040) are fully parallel. Backend template edits (T041–T048) are mostly sequential within `chat.ts.hbs` but T044–T048 can run alongside them. Widget edits (T049–T054) are parallel with the backend stream.
- Phases 5–8: each story's validation tasks are parallel with one another once US2 is stable.

---

## Parallel Example: User Story 1 backend + frontend

```text
# Once Phase 2 is complete, these can all start together:

# Backend stream (different files):
Task T019  — demo/shop/backend/src/auth/{bcrypt,jwt}.ts
Task T021  — demo/shop/backend/src/routes/products.ts
Task T026  — demo/shop/frontend/src/auth/token.ts
Task T027  — demo/shop/frontend/src/api/client.ts
Task T028  — demo/shop/frontend/src/api/hooks.ts
Task T029  — demo/shop/frontend/src/components/CartIndicator.tsx
```

Routes that share `demo/shop/backend/src/index.ts` (for `app.register(...)` wiring) serialise on that file; most route modules themselves are parallel.

---

## Implementation Strategy

### MVP (US1 + US2)

1. Phases 1–2 in order.
2. Phase 3 (US1) — the shop stands up standalone. Demoable as a testbed in its own right.
3. Phase 4 (US2) — the tool-loop redesign. The demo narrative is functional: "ask about my orders, get a grounded answer."
4. **STOP and VALIDATE**: US1 + US2 alone is the minimum deliverable for the hackathon demo on the new testbed.

### Incremental delivery

1. MVP above → demoable.
2. Add US3 (catalogue) → two-scenario demo.
3. Add US4 (cart + confirmation post-back) → three-scenario demo, full narrative arc.
4. Add US5 (sovereignty CI gate) → defensible invariant.
5. Add US6 (degradation) → robust UX.
6. Phase 9 (polish) → ready for recording day.

### Principle gate at every phase boundary

- **Entering Phase 4 (US2)**: verify US1's OpenAPI contract test (T018) is green — this is the input to `/atw.setup`.
- **Exiting Phase 4 (US2)**: verify rendered backend source contains no `fetch(` against the shop API (pre-sovereignty-probe sanity check); verify `/atw.build` is a no-op on second run (FR-022).
- **Entering Phase 9**: verify all 4 contract tests (T037, T038, T039, T040) and the sovereignty probe (T067) pass.
- **Exiting Phase 9**: verify the full quickstart runs in under 10 minutes and re-running `/atw.build` produces no diff.

---

## Notes

- Every task has a concrete file path and a verifiable outcome.
- [P] tasks operate on different files; [Story] tags all user-story tasks; Setup / Foundational / Polish tasks omit the Story tag by template.
- Mark tasks [X] as you finish them. Per the repo's working convention (auto-memory: `feedback_resume_after_crash.md`), verify the code against each task before flipping its checkbox after a crash.
- The Medusa retirement (T077–T079) is deliberately late in Phase 9: do not delete Medusa until the shop testbed and the tool-loop redesign are both green. That keeps a rollback path open mid-implementation.

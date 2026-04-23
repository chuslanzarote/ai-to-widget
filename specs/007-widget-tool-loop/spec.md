# Feature Specification: Widget-driven tool loop over a self-contained reference ecommerce

**Feature Branch**: `007-widget-tool-loop`
**Created**: 2026-04-23
**Status**: Draft (v2 — rescoped 2026-04-23)
**Input**: User description: "Retire the Medusa testbed. Ship a minimal, purpose-built reference ecommerce (API + SPA + database) that ATW can exercise end-to-end against an OpenAPI surface the Builder Owner fully controls. On top of that testbed, collapse the Feature 003 safe-read vs action split so every call to the shop API executes in the widget with the shopper's bearer token, and close the tool-use loop so the language model composes grounded responses from data the widget just fetched."

## Context (carry-forward for planners)

Feature 006 closed the OpenAPI → action-catalog gap so the host's API contract is the canonical source of shopper-safe tools. When exercised end-to-end against Medusa v2 (a real third-party host), two distinct architectural gaps emerged:

1. **Execution split is unsound.** The runtime execution model inherited from Feature 003 splits tool execution into two places: read-class tools (GET endpoints) execute server-side inside the ATW backend with a service credential, while action-class tools (write endpoints) execute client-side in the widget with the shopper's session. This split cannot satisfy account-scoped reads (e.g. "show my last orders") because the shopper's session deliberately never reaches the ATW backend — an invariant the Builder Owner set as a red line (Principle I — User Data Sovereignty).
2. **Third-party testbed is the wrong substrate.** Medusa-specific complexity (non-standard publishable-api-key headers, cart identifiers that live in the storefront's client state rather than in the API surface, session-cookie conventions that don't match the OpenAPI declaration) dominated debugging time without advancing the ATW thesis. The Builder Owner concluded that a third-party host is the wrong testbed for validating the ATW thesis at hackathon scale — the manifest builder cannot reason about capabilities the OpenAPI does not declare.

This feature makes two changes together, because neither is credible without the other:

- **A. Replace the testbed.** The Medusa demo is retired in full. In its place, ATW ships a minimal, self-contained **reference ecommerce** (`demo/shop`): a small Node.js API with auto-generated OpenAPI, a small Vite + React SPA with four screens plus a login screen, and its own database schema seeded with a small catalogue of coffee-shop products. Authentication is a standard bearer JSON Web Token that the SPA stores in browser-standard storage. The reference ecommerce exists solely to let ATW validate the full pipeline against an API the Builder Owner controls.
- **B. Remove the execution split.** Every tool the language model invokes executes in the shopper's browser with the shopper's bearer token. The ATW backend stays in the conversation loop — receiving the fetched data back and feeding it to the language model — but never reaches the shop API itself.

The retired Medusa demo, its seed dumps, and its build artefacts are removed from the repository as part of this feature. Product data worth preserving is re-expressed as handwritten seeds in the reference ecommerce.

## Clarifications

### Session 2026-04-23

- Q: Product schema — flat or with variants? → A: Flat. Each SKU is an independent product row (e.g. "Midnight Roast 1 kg whole bean" and "Midnight Roast 1 kg ground" are two separate product rows). No `product_variants` table.
- Q: Authentication flow — seeded-only users or public register endpoint? → A: Seeded-only. 2-3 users hardcoded in the seed with documented credentials (e.g. `alice@example.com` / `alice`); no public registration endpoint exposed in the OpenAPI surface.
- Q: Bearer-token storage contract between SPA and widget? → A: `localStorage` with key `shop_auth_token`, value is the raw JWT string. SPA writes on login and clears on logout; widget reads the same key on every tool call and injects `Authorization: Bearer <token>`. No cookies, no `sessionStorage`.
- Q: Cart-indicator sync mechanism when the widget adds to cart? → A: **No live sync.** After a successful cart-mutating action, the assistant explicitly tells the shopper to open the cart page to see the update. Rationale: avoid a bespoke widget ↔ SPA coupling (CustomEvent / postMessage / BroadcastChannel contract) that would pollute both bundles for a non-essential demo behaviour. The cart indicator only refreshes when the shopper navigates or reloads.
- Q: Product search — backend filter endpoint or client-side only? → A: Single route `GET /products?q=<text>` with optional text filter. Same route powers the SPA's listing (empty `q`) and search input (populated `q`), and appears as one tool in the ATW catalog. Filter matches against product name and description (case-insensitive substring). No separate `/products/search` route.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Reference ecommerce testbed exists and runs standalone (Priority: P1)

A Builder Owner working on ATW can spin up a self-contained ecommerce (`demo/shop`) that provides every capability ATW needs to validate the full pipeline: a login, a product catalogue, a cart, and a past-orders view. The testbed runs independently of ATW — a shopper can browse, log in, add to cart, place an order, and see past orders without any ATW component running.

**Why this priority**: Every downstream story in this feature targets the reference ecommerce. Without it, there is nothing for ATW to run against. This story is the prerequisite for US2–US4.

**Independent Test**: From a clean clone, the Builder Owner brings up `demo/shop` via its compose file; navigates to the storefront; logs in as a seeded user; browses products; adds items to a cart; places an order; and sees the order appear in past-orders — all without any ATW component running.

**Acceptance Scenarios**:

1. **Given** a clean clone of the repo, **When** the Builder Owner runs the shop's compose-up command, **Then** the backend, frontend, and database start healthy and the storefront is reachable on a documented localhost port.
2. **Given** the storefront is reachable and the seed has run, **When** a shopper logs in with a seeded email and password, **Then** the backend returns a bearer JSON Web Token and the SPA stores it in browser-standard storage so subsequent authenticated calls carry it in the `Authorization` header.
3. **Given** an authenticated shopper on the storefront, **When** they add a product to the cart from any product-listing or product-detail screen, **Then** the cart screen reflects the change and a cart indicator visible on every screen updates without a manual page refresh.
4. **Given** a non-empty cart, **When** the shopper clicks "place order", **Then** the order is persisted, the cart is cleared, and the order appears in the shopper's past-orders list with its items, total, and creation date.
5. **Given** the backend is running, **When** an HTTP client fetches the OpenAPI document endpoint, **Then** the response is a valid OpenAPI 3.x document describing every endpoint the shop exposes, including the bearer-auth scheme.
6. **Given** the storefront is reachable, **When** a shopper opens any screen (search, detail, cart, past orders), **Then** the cart indicator shows the current item count for the authenticated user, or zero if the user is not authenticated.

---

### User Story 2 — Shopper gets a grounded answer about their own account (Priority: P1)

A logged-in shopper on the reference storefront asks the ATW widget a question that requires looking up their own account state (e.g. "what were my last three orders?"). The widget fetches the data from the shop's API with the shopper's bearer token, shows the shopper a visible progress indicator while the request is in flight, and then returns a natural-language answer composed from the fetched data.

**Why this priority**: This is the user journey the current split architecture cannot satisfy at all. Until this works, the widget can only answer questions fully covered by the retrieval index — any question that depends on live, per-shopper data fails. MVP slice of the tool-loop change.

**Independent Test**: A shopper logged into the reference storefront asks "show me my past orders" in the widget. The widget displays a "fetching data" indicator, then a "processing" indicator, then returns a grounded list of orders (IDs, dates, totals) drawn from the live shop response.

**Acceptance Scenarios**:

1. **Given** a shopper logged into the reference storefront with at least one past order, **When** they ask "what were my last three orders?" in the widget, **Then** the widget shows a visible "fetching data" indicator, followed by a "processing" indicator, followed by a natural-language assistant response that references the actual order IDs, dates, and totals from the shop's response.
2. **Given** a shopper logged in with no past orders, **When** they ask the same question, **Then** the widget fetches successfully, the assistant response explicitly states there are no prior orders, and no error is shown to the shopper.
3. **Given** the shopper's bearer token has expired or been cleared, **When** they ask an account-scoped question, **Then** the assistant response explains that the shopper needs to log in again rather than returning a raw status code or hanging.

---

### User Story 3 — Shopper gets a grounded answer about the catalogue (Priority: P1)

A shopper asks about a specific catalogue detail that is not fully covered by the retrieval index (a SKU, a product's current price, whether it is in stock). The widget fetches the detail from the shop's public catalogue endpoint, shows progress indicators, and returns a grounded response.

**Why this priority**: Live catalogue lookups are how the widget keeps answers current. Moving this path to the widget unifies the execution model with Story 2 and removes the need for the ATW backend to hold shop-specific credentials.

**Independent Test**: Without logging in, a shopper asks "what's the price of the Midnight Roast?" in the widget. The widget shows progress feedback and returns a price matching the shop's live response.

**Acceptance Scenarios**:

1. **Given** a product in the shop catalogue, **When** the shopper asks about its price or availability by name, **Then** the widget fetches from the shop's catalogue endpoint and the assistant response reports the current values drawn from the fetched data.
2. **Given** the shopper asks about a product that does not exist in the shop catalogue, **When** the widget fetches and receives an empty or not-found result, **Then** the assistant response clearly states the product was not found rather than fabricating details.

---

### User Story 4 — Shopper adds to cart and receives a grounded confirmation (Priority: P1)

A shopper asks the widget to add a product to their cart. The widget presents a confirmation card, the shopper confirms, the action executes with the shopper's bearer token, the shop returns the updated cart, and the assistant composes a natural-language confirmation that references specific fields from the shop's response (e.g. new item count, new total). The storefront's cart indicator updates to reflect the change without a manual page refresh.

**Why this priority**: Writes already execute in the widget today; what is missing is the language model seeing the outcome and the storefront seeing the change. Closing both gaps makes the conversational wrap-up after an action feel natural and keeps the storefront visually consistent with the widget's action.

**Independent Test**: A logged-in shopper asks the widget to add a specific product to their cart. The confirmation card appears; the shopper confirms; the shop API returns success; the assistant response references the new cart state (e.g. "added 1 × Midnight Roast 1 kg — your cart now has 3 items totalling €48") and tells the shopper to open the cart page to see the change.

**Acceptance Scenarios**:

1. **Given** a confirmable "add to cart" request, **When** the shopper confirms the card, **Then** the widget executes the call with the shopper's bearer token, and the assistant composes a confirmation message that references at least one field (item count or total) from the shop's response AND points the shopper to the cart page to view the change.
2. **Given** the shopper declines the confirmation card, **When** no action is executed, **Then** the assistant acknowledges the cancellation without attempting to retry.
3. **Given** the action fails at the shop (e.g. product no longer exists), **When** the widget receives a failure response, **Then** the assistant composes a plain-language explanation of why it failed and does not falsely claim the action succeeded.

---

### User Story 5 — Builder Owner deploys ATW without shop-specific configuration, and the data-sovereignty invariant is verifiable (Priority: P2)

The Builder Owner deploys ATW without providing any shop-API URL or shop-API credential to the ATW backend. The backend starts cleanly, the widget operates normally, and a documented verification procedure confirms — from the ATW backend source alone — that no code path constructs a request against the shop's API.

**Why this priority**: Operational simplification and a concrete, auditable expression of the red line (Principle I). This story has no shopper-visible effect beyond Stories 2–4 working; its value is to the Builder Owner deploying ATW and to anyone verifying the data-sovereignty invariant.

**Independent Test**: After Stories 1–4 land, the Builder Owner confirms the ATW backend deployment config contains no shop-API URL or shop-API credential; the backend still starts successfully and passes the demo scenarios; a documented grep/search procedure run against the ATW backend source reports no code paths that issue requests against the shop API.

**Acceptance Scenarios**:

1. **Given** an ATW backend deployment config with no shop-API URL or credential, **When** the backend starts, **Then** it reaches a healthy state and accepts chat requests.
2. **Given** a full end-to-end demo session (catalogue lookup, account lookup, confirmed action), **When** outbound network activity from the ATW backend is observed, **Then** zero outbound connections to the shop's API are recorded.
3. **Given** the ATW backend source, **When** the documented verification procedure is run, **Then** the procedure reports no code paths that issue requests against the shop's API, and a regression attempt (a change that reintroduces such a call) causes the procedure to fail.

---

### User Story 6 — Graceful degradation when the shop is unreachable or the tool catalog is stale (Priority: P3)

If the widget cannot reach the shop (network failure, shop down, timeout) or the tool the language model attempted to invoke is no longer in the widget's catalog, the shopper receives a clear, plain-language explanation rather than a hang or a raw error.

**Why this priority**: Prevents pathological-path UX. Stories 2–4 cover happy and common-sad paths.

**Independent Test**: With the shop backend stopped, the shopper asks a question that would require a fetch. Within a bounded time window, the assistant responds with a plain-language failure message; the widget does not spin indefinitely.

**Acceptance Scenarios**:

1. **Given** the shop is unreachable, **When** the widget attempts a fetch, **Then** within the fetch timeout window the widget reports the failure back to the ATW backend, and the assistant composes a plain-language explanation to the shopper.
2. **Given** the language model attempts to invoke a tool the widget's catalog does not contain, **When** the widget cannot resolve the intent locally, **Then** the widget reports this back to the ATW backend as a failure, and the assistant explains that the feature is unavailable rather than hanging.

---

### Edge Cases

- Shopper refreshes the storefront mid-turn while a tool fetch is in flight → pending turn state is discarded; the next message starts a fresh turn; no orphan state on the ATW backend.
- Language model attempts sequential tool calls that collectively exceed the per-turn tool-call budget → budget cap enforced; further invocations declined; the assistant composes a best-effort reply from whatever data has already been gathered.
- Shop returns a response body larger than the interpretation size limit → body is truncated before being handed to the language model, with an explicit truncation indicator.
- Shop returns a non-JSON payload → widget posts it back verbatim (truncated); the language model summarises that the shop returned an unexpected format.
- Shopper's bearer token is present in browser storage but expired → shop returns 401; widget posts the 401 back; the assistant tells the shopper to log in again.
- Two shoppers in different browser tabs on the same device run concurrent turns → each widget instance owns its own turn state; no cross-talk.

## Requirements *(mandatory)*

### Functional Requirements

**Reference ecommerce testbed (`demo/shop`):**

- **FR-001**: The repository MUST contain a self-contained reference ecommerce under `demo/shop` comprising a backend service, a frontend SPA, and a database schema, packaged so it can be brought up with a single compose-up command.
- **FR-002**: The reference ecommerce MUST publish an OpenAPI 3.x document at a documented endpoint on the backend. The document MUST declare the bearer-JWT authentication scheme used by every authenticated endpoint.
- **FR-003**: The reference ecommerce MUST support, at minimum, these shopper-facing capabilities: login (returning a bearer JSON Web Token for a user already present in the seed), list products with optional case-insensitive text filter (`GET /products?q=<text>` matching name and description; single route serves both listing and search), view product detail, add/update/remove cart items, view current cart, place an order, and list past orders. The shopper's cart and orders are scoped to the authenticated user. Products are flat (one row per SKU; no variant hierarchy). No public registration endpoint is exposed.
- **FR-004**: The reference ecommerce SPA MUST provide at least these screens: login, product search/list, product detail, cart, past orders. Every screen MUST display a cart indicator showing the current item count for the authenticated user (or zero when unauthenticated).
- **FR-005**: The reference ecommerce MUST seed a handful of coffee-shop products on first database initialisation via a deterministic seed script, so the demo is immediately usable without manual data entry.
- **FR-006**: On successful login, the SPA MUST write the raw JWT string to `window.localStorage` under the key `shop_auth_token` and MUST attach it as `Authorization: Bearer <token>` on every authenticated API call. On logout the SPA MUST remove that key. The widget MUST read the same key to resolve the shopper's bearer token for tool calls. This storage contract is the documented interface between the SPA and the widget.
- **FR-007**: The previous third-party testbed under `demo/medusa` (including its seed dumps, compose files, and build artefacts) MUST be removed from the repository as part of this feature. Product data worth preserving is re-expressed as handwritten seeds in FR-005.

**Widget-driven tool loop:**

- **FR-008**: Every call to the shop's API MUST execute inside the shopper's browser. The ATW backend MUST NOT issue any request against the shop's API under any code path.
- **FR-009**: The ATW backend MUST NOT receive, store, forward, or log any shopper-scoped credential (bearer token, session cookie, or equivalent). This is a red line (Principle I — User Data Sovereignty).
- **FR-010**: When the language model requests a data lookup that does not require shopper confirmation, the widget MUST display a visible "fetching data" indicator to the shopper while the fetch is in flight, and a "processing" indicator while the fetched data is being interpreted. The wording for v1 is "Obteniendo datos…" for fetch-in-flight and "Datos obtenidos, interpretando…" for the interpretation step. Localisation is out of scope.
- **FR-011**: After any tool execution (read or write, success or failure), the fetched result MUST be delivered back to the language model so it can use the result (or the failure) to compose the final natural-language response the shopper sees.
- **FR-012**: When the language model requests a state-changing action (cart mutation, order placement), the widget MUST present a confirmation card and wait for an explicit shopper decision before executing. A shopper decline MUST NOT execute the action.
- **FR-013**: After a successful state-changing action, the assistant's reply MUST explicitly tell the shopper how to see the change on the storefront (e.g. a reference to the cart page). The system MUST NOT implement a live sync channel between the widget and the SPA for v1; the storefront's cart indicator only refreshes when the shopper navigates or reloads. Rationale: avoids a bespoke widget ↔ SPA coupling that would pollute both bundles for a non-essential demo behaviour.
- **FR-014**: Every tool invocation the language model emits MUST trace to a single operation declared in the shop's OpenAPI document. Invocations that do not trace to a declared operation MUST be rejected (no hallucinated tools — Principle V — Anchored Generation).
- **FR-015**: The widget MUST enforce a timeout on every shop-API fetch. If the timeout elapses, the widget MUST report the failure back to the ATW backend so the language model can compose a plain-language explanation rather than letting the shopper wait indefinitely.
- **FR-016**: Per shopper turn, the total number of tool invocations the system performs MUST be bounded by a configurable limit. When the limit is reached, subsequent invocations within the same turn MUST be declined and the language model MUST compose a best-effort reply from whatever data has already been gathered.
- **FR-017**: The ATW backend MUST start and operate without any shop-specific configuration values (base URL, API key, custom auth headers). Removing those values from the deployment config MUST NOT block startup or degrade any feature that previously worked.
- **FR-018**: The widget MUST carry all conversation state required to resume a tool loop across the widget → ATW backend post-back. The ATW backend MUST NOT hold mid-turn conversation state in a server-side session store between posts (stateless across posts).
- **FR-019**: On a fetch failure (network error, timeout, 4xx, 5xx, non-JSON response), the widget MUST deliver a structured error back to the language model so the shopper sees a plain-language explanation rather than a raw status code.
- **FR-020**: When the language model attempts to invoke a tool that is not present in the widget's local catalog, the widget MUST report the unresolved-tool error back so the language model can tell the shopper the feature is unavailable.

**Build-pipeline invariants:**

- **FR-021**: The widget's tool-execution engine MUST remain declarative data — no runtime evaluation of code received from the ATW backend, the shop, or the tool catalog. No `eval`, no `new Function`, no dynamic `import` of generated code.
- **FR-022**: Running the build pipeline (`/atw.setup` + `/atw.build`) twice with the same inputs MUST produce byte-identical build artefacts (Principle VIII — Reproducibility preserved).
- **FR-023**: A verification procedure documented in the feature MUST be able to confirm, from the ATW backend source alone, that no code path constructs a request against the shop's API. The procedure MUST be runnable in CI so regressions block the change.

### Key Entities

- **Reference Ecommerce Testbed**: A self-contained shop comprising an API service, a SPA storefront, and a database. Its OpenAPI document is the input to ATW's build pipeline.
- **Shopper Bearer Credential**: A JSON Web Token issued by the shop on successful login, stored by the SPA in browser-standard same-origin storage, sent on every authenticated request from the SPA and from the widget.
- **Tool Catalog (client-side)**: The set of operations the widget can invoke on the shopper's behalf. Each entry identifies the operation, the inputs it accepts, whether the operation requires explicit shopper confirmation, and the header sources required (including the bearer token).
- **Tool Intent**: A pending invocation dispatched from the ATW backend to the widget. Carries the tool name, the arguments the language model produced, and an identifier that ties the intent to the pending turn.
- **Tool Result**: The outcome of a tool invocation — a structured record of the shop's response (status, body, truncation flag) or a failure record (network error, timeout, unresolved-tool). Flows from the widget back to the ATW backend.
- **Turn**: A single shopper message plus the zero-or-more tool invocations plus the final assistant response. One turn may involve multiple tool intents and results in sequence.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean clone, the Builder Owner can bring up `demo/shop` and complete the full shopper journey (login → browse → add to cart → place order → see it in past orders) in under 10 minutes without editing source.
- **SC-002**: A logged-in shopper asking an account-scoped question (e.g. "my last three orders") receives a grounded, accurate answer in under 6 seconds on a typical broadband connection in 95% of attempts.
- **SC-003**: A shopper asking a live-catalogue question (e.g. "what's the price of the Midnight Roast?") receives a grounded, accurate answer in under 6 seconds on a typical broadband connection in 95% of attempts.
- **SC-004**: During a full end-to-end demo session (catalogue lookup, account lookup, confirmed add-to-cart), network monitoring on the ATW backend records zero outbound connections to the shop's API.
- **SC-005**: The ATW backend deployment configuration requires zero shop-specific values. A deployment that omits those values starts successfully and passes the demo acceptance scenarios.
- **SC-006**: After a confirmed add-to-cart, the assistant's confirmation message references at least one specific field from the shop's response (new item count or new total) in 100% of successful actions, AND directs the shopper to the cart page to view the change.
- **SC-007**: When the shop is unreachable, the shopper receives a plain-language failure message within 10 seconds; the widget does not show an indefinite "loading" state.
- **SC-008**: The documented data-sovereignty verification procedure completes in under 60 seconds and returns a single pass/fail result; a regression that reintroduces a shop-API call in the ATW backend causes it to fail.
- **SC-009**: Re-running `/atw.setup` + `/atw.build` against the shop's OpenAPI with unchanged inputs produces byte-identical artefacts (reproducibility invariant preserved).
- **SC-010**: The widget's shop-API fetch timeout is 8 seconds or less under nominal conditions; failures are surfaced within this window plus the post-back round-trip.

## Assumptions

- The shopper interacts with the widget in a browser on the reference storefront's own origin, so the widget has read access to the same-origin storage where the SPA placed the bearer token. Cross-origin widget deployments are out of scope for v1.
- The shopper authenticates with the reference shop through the SPA's login screen; the widget does not manage authentication; it reads the token from same-origin storage.
- The shop API responds with bounded-size JSON payloads within the 8-second widget timeout under nominal conditions.
- The widget bundle is deployed inside the storefront's Content Security Policy and is compatible with declarative tool-executor interpretation (no `eval`, no dynamic code loading).
- Single-tool-call-per-language-model-step is sufficient for v1. Parallel tool calls inside a single language-model step are out of scope.
- Streaming responses from the shop are out of scope. The widget expects bounded, non-streaming responses.
- The v1 progress strings are in Spanish ("Obteniendo datos…", "Datos obtenidos, interpretando…"). Localisation to other languages is a follow-up.
- The Feature 006 manifest builder is extended as needed so the generated `action-executors.json` can declare a bearer-token header source pointing at the reference storefront's token-storage location. This extension is scoped to support the reference ecommerce; general-purpose credential-source declaration for arbitrary third-party APIs is out of scope.
- The Medusa demo is retired in full. No migration path is provided for existing Medusa clones; operators running the previous demo discard it and adopt `demo/shop`.

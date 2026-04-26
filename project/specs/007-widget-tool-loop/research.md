# Phase 0 Research: Widget-driven tool loop over a self-contained reference ecommerce

**Feature**: 007-widget-tool-loop
**Date**: 2026-04-23

## Purpose

Resolve the stack and integration choices informed by the spec and constitution, and document each decision's rationale so a later reviewer (or a future planner looking at a similar pivot) can reconstruct the reasoning. Every entry below follows the pattern **Decision / Rationale / Alternatives considered**. No `NEEDS CLARIFICATION` markers remain.

---

## R1. `demo/shop/backend` HTTP framework

**Decision**: Fastify 4 with `@fastify/swagger` + TypeBox schemas.

**Rationale**:
- **OpenAPI is a first-class output.** Fastify's `@fastify/swagger` plugin auto-generates an OpenAPI 3.x document from the route schemas declared in code. This is exactly the input `/atw.setup` expects. No second source of truth, no hand-written spec drift.
- **TypeBox unifies runtime validation and type-gen.** The same schema object validates inbound request bodies at runtime and produces TypeScript types at compile time. The OpenAPI emitter understands TypeBox natively.
- **Principle VII alignment.** TypeScript on Node 20+, no new runtime ecosystem.
- **Speed of delivery.** The route shape (GET/POST/PATCH/DELETE with JSON bodies and JWT auth) maps one-to-one onto Fastify's idiomatic pattern. No custom middleware invention.

**Alternatives considered**:
- **Express + `swagger-jsdoc`.** Rejected: JSDoc comments are a hand-written spec in another form; drift between code and comment is the exact Feature 006 failure mode. No runtime validation unless you add another library.
- **NestJS.** Rejected: heavy decorators + dependency-injection boilerplate for 10 routes. Fastify is closer to the constitutional simplicity budget (Principle VII).
- **Hono.** Rejected: OpenAPI support is less mature than Fastify's as of the cutoff; taking on that risk for a hackathon testbed is not justified.
- **Zod + tRPC-style.** Rejected: tRPC is not an OpenAPI emitter; the whole point of the testbed is that the OpenAPI surface drives `/atw.setup`.

---

## R2. `demo/shop` persistence layer

**Decision**: Prisma 5 with Postgres 16, managed in a new `shop_postgres` container.

**Rationale**:
- **Prisma schema doubles as data-model doc.** `prisma/schema.prisma` is a compact, reviewable declaration of the five tables (`users`, `products`, `carts`, `cart_items`, `orders`, `order_items`) with their relations. Reviewers read it; the migration tool consumes it.
- **Seed-script ergonomics.** Prisma Client makes a deterministic seed script (upserts by seed-key) short enough to handwrite the 20 coffee products + 3 users required by FR-005 (Principle VIII — deterministic seed).
- **Principle VII alignment.** Postgres is the project's sanctioned datastore. A second instance (separate container, separate volume) is not a new ecosystem.
- **Isolation from `atw_postgres`.** The shop's data must not leak into the pgvector instance ATW uses for retrieval. Separate containers, separate ports, separate credentials is the simplest isolation.

**Alternatives considered**:
- **Drizzle ORM.** Rejected: ergonomic and lightweight, but Prisma's migration tooling and seed-script ergonomics ship on day one; Drizzle would cost setup time that does not advance the demo.
- **Raw `pg` + hand-written SQL migrations.** Rejected: hand-written migrations are fine for `atw_postgres` (where the shape is fixed), but iterating on the shop's schema during the hackathon would slow this down unnecessarily.
- **SQLite.** Rejected: Principle VII pins Postgres, and JSON-in-Postgres is the cleanest fit for the cart/order item arrays during future extensions.

---

## R3. `demo/shop/frontend` stack

**Decision**: Vite 5 + React 18 + React Router 6 + TanStack Query 5 + Tailwind CSS.

**Rationale**:
- **Vite is the user-specified choice** ("vamos a crear ... el front va a ser un vite"). Matches Principle VII (Node/TS) and hackathon delivery speed.
- **TanStack Query gives the cart-indicator-refresh-on-navigation pattern for free.** Per Clarification Q4, there is no live widget↔SPA sync; the cart indicator refreshes on the shopper's next screen navigation. TanStack Query's per-route `useQuery` with a simple `refetchOnMount: true` is the idiomatic way to achieve this without introducing a shared state store.
- **Tailwind CSS** keeps the four screens stylable without a component library dependency. Consistent with Principle VII's complexity budget.
- **React Router 6** for a five-screen SPA is light enough to keep under the budget.

**Alternatives considered**:
- **SvelteKit / Solid Start.** Rejected: introduces a second frontend framework into a project where the widget already ships React. Two frameworks = two learning curves for reviewers.
- **Next.js.** Rejected: SSR/RSC is overkill for an SPA that lives on `localhost` and whose only client is the shopper. Vite is the lower-complexity choice.
- **Redux/Zustand for cart state.** Rejected: no live sync is required (Clarification Q4); TanStack Query's query cache, invalidated on navigation, is the complete solution.
- **Raw `fetch()` without a data layer.** Rejected: the cart indicator needs to be revalidated on every route change on every screen; TanStack Query's `useQuery` with a shared key makes this one line per screen vs. a hand-rolled pub/sub.

---

## R4. Shop authentication — bearer JWT vs. session cookie

**Decision**: Bearer JSON Web Token, stored by the SPA in `window.localStorage` under the key `shop_auth_token`, signed by the backend with `@fastify/jwt`, verified on every authenticated route.

**Rationale**:
- **User directive.** "El usuario se loga para demostrar que se envía el bearer token que se almacenará de alguna manera estándar" — the demo thesis is that credentials travel client-side and the ATW backend never sees them. Bearer JWT is the standard-issue token format for that story.
- **Clarification Q3** pins the storage key (`shop_auth_token`) and the value shape (raw JWT string, no JSON wrapper). The widget reads the same key; this is the documented contract between SPA and widget (FR-006).
- **Cookies would require a shared parent domain.** Same-origin storage via `localStorage` works when the widget is embedded on the SPA's origin (spec Assumptions). Cookie-based auth would add `SameSite`/`Secure`/CSRF-token complexity that the testbed does not need.
- **Deterministic for the demo.** A JWT issued against a handwritten secret (seeded in env) produces predictable tokens; handy for smoke tests.

**Alternatives considered**:
- **HTTP-only session cookie (the Feature 003 assumption).** Rejected: the widget lives in a `<script>` on the storefront, and reading a cookie the widget needs to inject into its own fetch calls is awkward when `HttpOnly` is set (the widget can't read it) and insecure when it isn't. The bearer + `localStorage` pattern is the one the user explicitly asked to demonstrate.
- **OAuth 2.0 flow.** Rejected: out of scope (spec, "Out of scope for this feature"). Reintroducing it would explode the feature surface.
- **Short-lived access token + refresh token.** Rejected: lifecycle complexity for no demo benefit. v1 issues a JWT with a generous expiry (e.g., 24 h); expired-token recovery is the US2 AC3 path, which just tells the shopper to log in again.

---

## R5. Manifest-builder extension — bearer-token source declaration

**Decision**: Add one optional field on action-catalog entries: `credentialSource`. Shape:

```json
{
  "type": "bearer-localstorage",
  "key": "shop_auth_token",
  "header": "Authorization",
  "scheme": "Bearer"
}
```

The manifest-builder (`packages/scripts/src/lib/manifest-builder.ts`) emits this block on every action-catalog entry whose OpenAPI operation declares a `bearerAuth` security requirement. The widget's action-executor reads the `credentialSource` block and, at fetch time, resolves the token by reading `localStorage[key]` and injects `Authorization: Bearer <token>`.

**Rationale**:
- **One declarative field, one engine branch.** The widget's action-executor stays declarative (Principle V, FR-021). Adding one case to the header-resolution step of the existing engine is a small, auditable delta.
- **Scoped to the reference ecommerce.** The spec Assumptions are explicit: general-purpose credential-source declaration for arbitrary third-party APIs is out of scope. `type: "bearer-localstorage"` is the only variant v1 emits.
- **OpenAPI-traceable.** Every generated `credentialSource` block traces to a `bearerAuth` security requirement declared in the shop's OpenAPI. Principle V (Anchored Generation) is preserved.
- **Reproducible.** The field is deterministic given the OpenAPI input. Re-running `/atw.build` on unchanged OpenAPI produces byte-identical catalog entries (FR-022).

**Alternatives considered**:
- **Hardcode `localStorage[shop_auth_token]` in the widget's fetch layer.** Rejected: couples the widget to a specific testbed. Declaring the source per operation keeps the widget generic.
- **Read the token from a cookie.** Rejected: the user explicitly chose `localStorage` (Clarification Q3).
- **Generic credential-provider-plugin system.** Rejected: over-engineering for one variant. Can be generalized later if a second credential type is needed.
- **Store the token in a widget-local store and have the SPA push it via `postMessage`.** Rejected: introduces a cross-component message channel the user explicitly refused for cart sync (Clarification Q4), and the SPA↔widget handshake adds a failure mode the simpler localStorage read does not have.

---

## R6. Chat endpoint amendment — resume the tool loop via a `tool_result` POST

**Decision**: `POST /v1/chat` gains one optional field on its request body: `tool_result`. Shape:

```json
{
  "messages": [...],              // existing conversation history carried by widget
  "pending_turn_id": "...",       // handle the backend emitted with the intent
  "tool_result": {                // present only on resume posts
    "tool_use_id": "toolu_...",   // the id Opus emitted with the tool_use block
    "content": "...",             // JSON-stringified shop response body, truncated
    "is_error": false,
    "status": 200
  },
  "tool_call_budget_remaining": 4 // carried by widget to enforce MAX_TOOL_CALLS_PER_TURN
}
```

When `tool_result` is present, the backend:
1. Skips retrieval and embedding (the decision was already made in the previous hop).
2. Appends the `tool_result` block to the Anthropic `messages` array in the standard [`tool_result` shape](https://docs.anthropic.com/en/docs/build-with-claude/tool-use).
3. Calls `messages.create()` again.
4. If `stop_reason === "tool_use"`, emits another `ActionIntent` back to the widget (and decrements `tool_call_budget_remaining`).
5. If `stop_reason !== "tool_use"`, returns the composed text + citations in the standard Feature 003 response shape.

**Rationale**:
- **Stateless across posts (FR-018).** Conversation history lives in the widget between posts; the backend is horizontally scalable without a server-side session store.
- **Minimal contract amendment.** One optional field added. Feature 003 consumers that never send `tool_result` keep working unchanged.
- **Budget enforcement is verifiable.** The widget carries the counter; the backend ignores posts that declare `tool_call_budget_remaining <= 0` and composes a best-effort reply (FR-016).

**Alternatives considered**:
- **Server-side turn state.** Rejected: FR-018 is explicit; also introduces a session store (Redis-class) that Principle VII discourages.
- **Server-Sent Events (SSE).** Rejected: out of scope. A POST-per-step is simpler and matches the existing Feature 003 response model.
- **Anthropic's prompt-caching / tool-use auto-loop feature on the server.** Rejected: the whole point is that the shop API call happens in the browser, not on the server; the loop has to hop through the widget.

---

## R7. Widget executeAction extension — progress placeholders + post-back

**Decision**: Extend `packages/widget/src/chat/action-runner.ts` with one new flow:

1. On receiving an `ActionIntent` from the backend, inspect `confirmation_required`:
   - **`true`** → existing confirmation-card flow. After the shopper confirms and the fetch completes, instead of terminating the turn, POST `tool_result` back to `/v1/chat` (US5).
   - **`false`** → no card. Render an inline assistant-side placeholder with the v1 string `"Obteniendo datos…"` (FR-010). Execute `fetch()` with `AbortController` wired to an 8 s timeout. On resolution, swap the placeholder text to `"Datos obtenidos, interpretando…"` and POST `tool_result` back.
2. On the backend's response, either render another progress placeholder (if another tool_use arrives) or the final assistant message.
3. On timeout / network error / non-2xx / non-JSON, populate `tool_result` with `is_error: true` and an explanatory `content` string; post back so Opus composes a plain-language explanation (FR-019, FR-015).
4. On an intent whose `tool` name is not in the widget's local `action-executors.json` catalog, skip the fetch entirely and post back `{is_error: true, content: "tool X not found in widget catalog"}` (FR-020).

**Rationale**:
- **Single fork point.** The only UX change is on `confirmation_required: false`; the write path keeps its existing UI and gains one additional POST at the end.
- **Spanish progress strings pinned** (FR-010) because acceptance tests reference them verbatim. Localisation carved out to a follow-up.
- **Timeout is enforced in the widget** (Principle I: the backend is out of the credential path and can't see the shop; it can't enforce the timeout for us).

**Alternatives considered**:
- **Keep the confirmation card for reads too.** Rejected: bad UX. Every "show my orders" would require a "do you want to fetch?" click. The spec explicitly carves reads out with auto-execute + progress UI (US2, FR-010).
- **Streaming the fetched body back chunk-by-chunk.** Rejected: out of scope (spec). Bounded JSON only.
- **Retry on transient failures.** Rejected: out of scope (spec). v1 posts the failure back and lets Opus compose an explanation.

---

## R8. `demo/medusa` retirement procedure

**Decision**: Delete `demo/medusa/` (tracked files), `docker-compose.yml`'s `medusa_*` services, and the `medusa-specific` seed dumps. Carry forward nothing automatically; the commit message + README change documents the manual `docker compose down -v` and volume cleanup operators of pre-007 clones must run themselves.

**Rationale**:
- **FR-007** requires wholesale removal. Leaving artefacts confuses the planner and reviewers about which testbed is authoritative.
- **Principle VIII (Reproducibility)** is cleaner with one testbed than with two coexisting partially.
- **No coexistence window.** The user explicitly asked to "borramos medusa" in the pivot message; preserving it "just in case" is cost without benefit.

**Alternatives considered**:
- **Coexistence window (keep `demo/medusa` for one release).** Rejected: doubles demo maintenance; contradicts the pivot intent.
- **Auto-migration script for Medusa clones.** Rejected: out of scope; no user has invested enough in a Medusa clone to justify the code.

---

## R9. Per-turn tool-call budget default

**Decision**: Default `MAX_TOOL_CALLS_PER_TURN = 5`. Configurable via backend env var.

**Rationale**:
- Observed Opus behaviour on account-scoped questions in Feature 005 rarely required more than 2 sequential tool calls. A cap of 5 gives headroom for chained lookups (list orders → get order detail → get product referenced in order) without inviting runaway loops.
- Configurability keeps it tunable without redeployment; budget is enforced in the widget (carried in the tool_result POST) and double-checked in the backend (derived from message history length).

**Alternatives considered**:
- **3.** Rejected: too tight for legitimate multi-hop lookups.
- **10.** Rejected: acceptable latency ceiling at 8 s per hop is already tight; 10 hops would blow the 6 s grounded-answer SC.
- **Unbounded.** Rejected: FR-016 explicitly requires a bound.

---

## R10. Sovereignty probe — how to verify from source alone

**Decision**: A CI contract test (`packages/backend/test/sovereignty.contract.test.ts`) that:
1. Invokes the backend template renderer against the fixture OpenAPI.
2. Grep-parses every rendered `.ts` file for occurrences of `fetch(`.
3. For each `fetch(` call, resolves the URL expression. The URL must resolve to one of three allowlisted categories: (a) the `atw_postgres` connection (pg driver, not `fetch`); (b) the Anthropic SDK's internal `fetch` (inside `node_modules`, not in rendered source — excluded); (c) a `localhost`-only health-check URL.
4. Any `fetch(` whose URL expression does not resolve to an allowlisted category fails the test.

The test is wired into the existing `/atw.build` CI gate. A regression that reintroduces `HOST_API_BASE_URL` or equivalent causes it to fail (SC-008).

**Rationale**:
- **Principle I enforcement becomes mechanical.** Not a code-review judgement call.
- **Runs under 60 s** (SC-008) because it scans only rendered backend source — a handful of files.
- **Single pass/fail** (SC-008) maps cleanly to a CI job.

**Alternatives considered**:
- **Runtime egress monitoring** (block non-allowlisted outbound DNS). Rejected: requires network-policy infra outside the project's Docker Compose world, and would only catch failures in deployed runtime, not at review time.
- **Trust the code review.** Rejected: FR-023 and SC-008 require a verifiable procedure, not reviewer discipline.

---

## Unresolved items

**None.** Every `NEEDS CLARIFICATION` from the plan template has been resolved above. Remaining open questions (exact JWT expiry, exact seed-user count between 2 and 3, exact per-turn budget if the default turns out wrong under dogfooding) are planning-phase tuning knobs and do not block task generation.

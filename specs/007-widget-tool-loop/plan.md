# Implementation Plan: Widget-driven tool loop over a self-contained reference ecommerce

**Branch**: `007-widget-tool-loop` | **Date**: 2026-04-23 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-widget-tool-loop/spec.md`

## Summary

This feature delivers two coupled changes on a single branch:

1. **Ship the testbed.** Retire `demo/medusa` in full. Build a minimal, purpose-built reference ecommerce under `demo/shop` — a Fastify backend with auto-generated OpenAPI, a Vite + React SPA with five screens (login, search/list, product detail, cart, past orders), and a Postgres schema seeded with a handwritten coffee catalogue and 2–3 handwritten users. Authentication is a standard bearer JWT that the SPA writes to `localStorage["shop_auth_token"]`.
2. **Collapse the execution split.** Every tool Opus invokes executes in the browser with the shopper's bearer token. The Feature 003 `executeSafeRead` server-side branch is deleted. The `atw_backend` never calls the shop API. The chat endpoint gains a `tool_result` POST shape so the widget closes Opus's tool-use loop by posting the fetched result back; Opus then composes a grounded final response. Writes keep the confirmation card; the post-back extension is the same shape as reads.

The reference-ecommerce and tool-loop changes ship together because neither is demonstrable alone: the loop redesign needs an OpenAPI surface the Builder Owner fully controls (so the Feature 006 manifest builder can declare a bearer-token header source); the testbed is pointless without the loop redesign to exercise it end-to-end.

**Technical approach.** Fastify + `@fastify/swagger` auto-publishes the OpenAPI document that feeds `/atw.build`. Prisma owns the Postgres schema (`shop_postgres`, a new container independent of `atw_postgres`). React + TanStack Query handles SPA data fetching and the cart-count refresh-on-navigation pattern. The `packages/scripts` manifest-builder is extended with one new field on action-catalog entries: a bearer-token source declaration scoped to "read from `localStorage[shop_auth_token]`". `packages/backend` chat route replaces the `is_action: false → executeSafeRead` branch with the existing `ActionIntent` emission path, and gains a `tool_result` branch that resumes the Opus loop without re-running retrieval. `packages/widget` executeAction path forks on `confirmation_required`: `true` → existing card; `false` → inline "Obteniendo datos…" placeholder → fetch → "Datos obtenidos, interpretando…" → POST `tool_result`.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js ≥ 20 (Principle VII — Single-Ecosystem Simplicity).
**Primary Dependencies**:
- `demo/shop/backend`: Fastify 4, `@fastify/swagger`, `@fastify/jwt`, Prisma 5, `bcryptjs`.
- `demo/shop/frontend`: Vite 5, React 18, `@tanstack/react-query` 5, React Router 6, Tailwind CSS.
- `packages/backend` (extended): existing Anthropic SDK + `pg` + `pgvector` retained; `executeSafeRead` and `HOST_API_*` removed.
- `packages/scripts` (extended): existing `@apidevtools/swagger-parser` + manifest-builder retained; new `credentialSource` field on action-catalog entries.
- `packages/widget` (extended): existing declarative action-executor engine retained; new progress-placeholder UI state + post-back leg added to `executeAction`.

**Storage**:
- New container `shop_postgres` (Postgres 16) dedicated to `demo/shop`. Separate schema, separate volume, independent of `atw_postgres`.
- Existing `atw_postgres` (Postgres 16 + `pgvector`) untouched.

**Testing**: Vitest (already in repo). Contract test harness under `packages/scripts/test/` and `packages/backend/test/` remains the authoritative gate. New contract tests: (a) rendered `atw_backend` source contains no `fetch(` against non-local hosts; (b) chat endpoint accepts the `tool_result` POST shape and resumes the loop without re-running retrieval; (c) `shop` OpenAPI document declares a `bearerAuth` security scheme on every authenticated operation; (d) `shop` compose-up end-to-end smoke (login → add to cart → place order → list orders).

**Target Platform**: Linux containers orchestrated by Docker Compose. Target browsers: evergreen Chrome/Firefox/Edge (widget ships as ES2020 bundle).

**Project Type**: Multi-package monorepo. Existing `packages/` workspace (scripts, backend, widget) is extended; a new sibling `demo/shop/` directory adds the reference ecommerce.

**Performance Goals**:
- Widget shop-API fetch: p95 under the 8 s timeout (SC-010); typical broadband completion under 2 s.
- Full grounded answer turn (US2/US3): under 6 s in 95% of attempts on typical broadband (SC-002, SC-003).
- `/atw.build` on the shop's OpenAPI: completes within the existing build-pipeline budget (no regression vs. Feature 006).

**Constraints**:
- **Red line (Principle I).** ATW backend MUST NOT issue any request against the shop API. Enforced by FR-023 verification procedure and a CI contract test.
- **Red line (Principle V).** Every Opus tool invocation MUST trace to a declared operation in the shop's OpenAPI. Enforced by the existing manifest-builder + a widget-side catalog guard.
- **Red line (Principle VIII).** Re-running `/atw.setup` + `/atw.build` against unchanged inputs produces byte-identical artefacts. Enforced by the existing reproducibility harness.
- **No runtime code evaluation** in the widget: the action-executor engine remains declarative JSON interpreted by a fixed audited runtime. No `eval`, no `new Function`, no dynamic `import` (FR-021).
- **Stateless backend across mid-turn posts** (FR-018): conversation state lives in the widget between posts.
- **Spanish progress strings** pinned verbatim (FR-010): "Obteniendo datos…" and "Datos obtenidos, interpretando…".

**Scale/Scope**:
- `demo/shop` catalogue: ~20 handwritten coffee products (flat, no variants — per Clarification Q1).
- `demo/shop` users: 2–3 handwritten seeded users (per Clarification Q2); no public registration.
- Tool catalog: ≈10–12 operations (login, list products with optional `q`, get product, get/update cart, cart-item CRUD, place order, list past orders, get current customer).
- Per-turn tool-call cap: configurable; planner will set a sensible default (≈5) informed by Opus's typical tool-sequence length.
- Concurrency: single-shopper-per-browser. Multi-tab concurrency is handled by per-widget-instance turn state (spec Edge Cases).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Every principle evaluated below. Red lines (I, V, VIII) must pass unconditionally. Lower-priority violations go in Complexity Tracking.

### I. User Data Sovereignty (NON-NEGOTIABLE) — **PASS**

The central purpose of this feature is to close a real-world gap against this principle. The Feature 003 `executeSafeRead` path had the ATW backend reading the shop API with a service credential; account-scoped reads then required the shopper's credential to reach `atw_backend`, which the principle forbids. This feature removes the server-side branch entirely (FR-008, FR-017, US6), deletes `HOST_API_BASE_URL` / `HOST_API_KEY` from deployment config (US6 acceptance), and adds a CI contract test (FR-023) that grep-verifies no outbound `fetch(` targeting non-local hosts remains in the rendered backend source. The shopper's bearer JWT lives in the browser and is attached client-side; the backend neither receives nor logs it (FR-009).

### II. Markdown as Source of Truth — **PASS**

All configuration decisions continue to flow through markdown artefacts. New artefacts added by this feature (spec, plan, research, data-model, contracts, quickstart, tasks) are markdown. Generated `action-executors.json` remains declarative data (not markdown, but structured JSON interpreted by a fixed engine — consistent with how Feature 003/006 already handle it). The shop's OpenAPI document is the upstream input; its conversion to the action catalog flows through `action-manifest.md` unchanged.

### III. Idempotent and Interruptible — **PASS**

`/atw.setup` and `/atw.build` remain re-runnable against the shop's OpenAPI. The manifest-builder extension (new `credentialSource` field) is additive and does not change idempotency. `demo/shop`'s database seed script is re-runnable (upsert by seed-key on users and products). Bringing up `demo/shop` is a `docker compose up` from a clean clone and matches the interrupt-and-resume expectation.

### IV. Human-in-the-Loop by Default — **PASS**

State-changing actions (FR-012) still require an explicit shopper confirmation in the widget. Read-class tool calls auto-execute but are clearly announced via the "Obteniendo datos…" indicator (FR-010) — the shopper sees what the assistant is doing. No silent background work.

### V. Anchored Generation (NON-NEGOTIABLE) — **PASS**

Every tool Opus can invoke traces to a declared operation in the shop's OpenAPI (FR-014). The widget's declarative catalog is the enforcement layer: tool intents that don't resolve to a catalog entry are rejected with a structured error (FR-020). Final responses are composed from tool-result payloads that the widget just fetched — no invented facts. US2 AC3 (expired-token path) and US3 AC2 (product-not-found path) explicitly require the assistant to state absence truthfully.

### VI. Composable Deterministic Primitives — **PASS**

The layering this principle mandates is preserved and strengthened: the agentic layer (Opus) decides *what* tool to invoke; the deterministic layer (widget's fixed action-executor engine + shop backend) reliably *does* it. Collapsing the split does not add agentic reasoning to execution; it moves the deterministic execution site from the ATW backend to the widget, which already hosts the same engine.

### VII. Single-Ecosystem Simplicity — **PASS**

Every new file is TypeScript on Node.js ≥ 20. No new language runtimes. Postgres (existing) is the only datastore — `shop_postgres` is a second instance of the same engine, not a new ecosystem. Docker Compose remains the orchestration layer. No monorepo tooling beyond npm workspaces.

### VIII. Reproducibility as a First-Class Concern (NON-NEGOTIABLE) — **PASS**

Two invariants preserved. (1) `docker compose up` from a clean clone still produces a working demo — now with `demo/shop` + ATW against `demo/shop` instead of `demo/medusa`. (2) Re-running `/atw.setup` + `/atw.build` against unchanged inputs is byte-identical (FR-022, SC-009). All images in the shop compose pin exact tags. The shop's seed is deterministic and checked into the repo (FR-005). SC-001 measures the cold-start-to-journey path at under 10 minutes.

### IX. Opus as a Tool, Not a Crutch — **PASS**

No change to the existing Opus-usage discipline. Schema and OpenAPI parsing remain deterministic. Opus is invoked for tool-call decision and response synthesis (the existing uses). The tool loop adds one more round-trip per read-class call, not more model calls per *decision*.

### X. Narrative-Aware Engineering — **PASS**

The primary demo narrative collapses: "ask a question about your account, watch the widget fetch, get a grounded answer" is demonstrable in under 30 seconds. The testbed pivot reduces demo-prep risk (no Medusa-specific debugging on demo day). The feature deliberately leaves out SSE streaming, parallel tool calls, and cross-origin widget deployment — scope calls consistent with this principle.

**Gate outcome**: All ten principles pass. No entries for Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/007-widget-tool-loop/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (v2 rescope)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── shop-openapi.md       # Required shape of demo/shop's OpenAPI
│   ├── chat-endpoint-v2.md   # Amended POST /v1/chat (tool_result shape)
│   ├── action-catalog-v2.md  # Amended action-executors.json (credentialSource)
│   └── sovereignty-probe.md  # CI verification procedure (FR-023)
├── checklists/
│   └── requirements.md  # Spec quality gate (v2, complete)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
ai-to-widget/
├── demo/
│   ├── shop/                        # NEW — reference ecommerce testbed
│   │   ├── backend/
│   │   │   ├── src/
│   │   │   │   ├── index.ts         # Fastify app + Swagger plugin
│   │   │   │   ├── auth/            # login route, JWT plugin, bcrypt
│   │   │   │   ├── routes/
│   │   │   │   │   ├── products.ts  # GET /products?q, GET /products/:id
│   │   │   │   │   ├── cart.ts      # GET/POST/PATCH/DELETE cart + items
│   │   │   │   │   ├── orders.ts    # POST /orders, GET /orders
│   │   │   │   │   └── customers.ts # GET /customers/me
│   │   │   │   ├── schemas/         # TypeBox schemas → OpenAPI
│   │   │   │   └── db.ts            # Prisma client
│   │   │   ├── prisma/
│   │   │   │   ├── schema.prisma    # users, products, carts, cart_items, orders, order_items
│   │   │   │   ├── migrations/
│   │   │   │   └── seed.ts          # 2-3 users + ~20 coffee products, deterministic
│   │   │   ├── Dockerfile
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── frontend/
│   │   │   ├── src/
│   │   │   │   ├── main.tsx
│   │   │   │   ├── App.tsx
│   │   │   │   ├── pages/
│   │   │   │   │   ├── Login.tsx
│   │   │   │   │   ├── ProductList.tsx   # search + listing (single route)
│   │   │   │   │   ├── ProductDetail.tsx
│   │   │   │   │   ├── Cart.tsx
│   │   │   │   │   └── Orders.tsx
│   │   │   │   ├── components/
│   │   │   │   │   ├── CartIndicator.tsx # visible on every screen
│   │   │   │   │   └── Layout.tsx
│   │   │   │   ├── api/
│   │   │   │   │   ├── client.ts    # fetch wrapper; reads localStorage[shop_auth_token]
│   │   │   │   │   └── hooks.ts     # TanStack Query hooks
│   │   │   │   └── auth/
│   │   │   │       └── token.ts     # localStorage[shop_auth_token] contract
│   │   │   ├── index.html
│   │   │   ├── Dockerfile
│   │   │   ├── vite.config.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── docker-compose.yml       # shop_postgres + shop_backend + shop_frontend
│   │   └── README.md                # quickstart for the testbed alone
│   └── atw-shop-host/                 # EXISTING — remains; its ATW artefacts
│                                    # are regenerated against the new shop
│                                    # as part of US1–US4 acceptance
├── packages/
│   ├── backend/
│   │   └── src/
│   │       ├── routes/
│   │       │   └── chat.ts.hbs      # AMENDED — remove executeSafeRead branch;
│   │       │                        # add tool_result POST branch
│   │       ├── lib/
│   │       │   ├── tool-execution.ts.hbs  # DELETED
│   │       │   └── retrieval.ts.hbs       # unchanged
│   │       └── config.ts.hbs        # AMENDED — remove HOST_API_BASE_URL,
│   │                                # HOST_API_KEY
│   ├── scripts/
│   │   └── src/
│   │       ├── lib/
│   │       │   └── manifest-builder.ts    # AMENDED — emit credentialSource
│   │       │                              # declaration on action-catalog entries
│   │       └── render-backend.ts          # AMENDED — drop executeSafeRead
│   │                                      # branch in template render
│   └── widget/
│       └── src/
│           ├── chat/
│           │   ├── chat.tsx         # AMENDED — progress placeholder states
│           │   └── action-runner.ts # AMENDED — fork on confirmation_required;
│           │                        # post back tool_result
│           └── auth/
│               └── token-source.ts  # NEW — reads localStorage[shop_auth_token]
└── demo/medusa/                     # DELETED as part of FR-007
```

**Structure Decision**: Extend the existing monorepo in place. The reference ecommerce lives under `demo/shop` as a sibling to `demo/atw-shop-host` and is independently deployable (its own compose file). ATW code lives in `packages/` as before; three packages are touched (`backend`, `widget`, `scripts`). The Medusa testbed under `demo/medusa` is removed wholesale; no coexistence window.

## Complexity Tracking

All ten constitutional principles pass without justification. No new language runtime, no new datastore, no new orchestration layer, no new third-party runtime framework is introduced. The table below is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |

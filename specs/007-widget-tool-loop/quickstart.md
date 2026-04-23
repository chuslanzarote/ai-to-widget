# Quickstart: Widget-driven tool loop over the reference ecommerce

**Feature**: 007-widget-tool-loop
**Target reader**: Builder Owner or hackathon reviewer on macOS, Linux, or WSL2 with Docker and Claude Code installed.
**SC referenced**: SC-001 (cold clone → full journey in under 10 minutes).

## Prerequisites

- Docker + Docker Compose.
- Node.js ≥ 20 (for running `/atw.*` slash commands locally).
- Claude Code with Opus 4.7 configured.
- An `ANTHROPIC_API_KEY` in the environment for the ATW chat flow.

No shop-specific env vars are required (FR-017). Anything like `HOST_API_BASE_URL` or `HOST_API_KEY` from a pre-007 clone should be removed.

## Step 1 — Clean clone

```bash
git clone <repo-url> ai-to-widget
cd ai-to-widget
```

If you are upgrading an existing clone that ran the Medusa demo: `docker compose down -v` and prune any named volumes whose prefix begins with `medusa_` or `ai-to-widget-medusa_`. `demo/medusa/` is gone as of this feature (FR-007).

## Step 2 — Bring up the reference shop

```bash
cd demo/shop
docker compose up -d
```

What this starts:
- `shop_postgres` — Postgres 16 on a non-standard port (not 5432, to avoid colliding with `atw_postgres`).
- `shop_backend` — Fastify service serving the shop API and `GET /openapi.json`.
- `shop_frontend` — Vite-built SPA.

The backend runs its Prisma migrations and seed on first boot. Seeded products: ~20 coffee SKUs. Seeded users: 2–3 with documented credentials (see `demo/shop/README.md`; typically `alice@example.com` / `alice`).

Confirm the shop is up:

```bash
curl http://localhost:<shop-backend-port>/openapi.json | jq '.info.title'
# → "ATW Reference Shop"
```

Open the storefront in a browser, log in, browse, add to cart, place an order, and see it in past orders — all without any ATW component running. This proves US1.

## Step 3 — Point ATW at the shop and build

From the repo root:

```bash
# In Claude Code:
/atw.setup
# Provide the shop's OpenAPI URL when prompted:
#   http://localhost:<shop-backend-port>/openapi.json
# Accept the action-classification proposals (or refine).

/atw.build
# Produces:
#   - rendered backend under .atw/artifacts/backend/
#   - rendered widget bundle under .atw/artifacts/widget/
#   - action-executors.json (with credentialSource blocks on authenticated tools)
```

Re-running `/atw.build` immediately should be a no-op (FR-022, SC-009).

## Step 4 — Bring up ATW against the shop

```bash
# From the repo root:
docker compose up -d atw_backend atw_postgres
# (the shop stack is already up from Step 2)
```

Confirm `atw_backend` started without any `HOST_API_*` envs (FR-017):

```bash
docker logs ai-to-widget-atw_backend-1 2>&1 | head -30
# No "missing HOST_API_BASE_URL" messages; backend reports ready.
```

Open the storefront. The ATW widget loads inside the SPA (served by `shop_frontend`). Log in as a seeded user.

## Step 5 — Exercise the tool loop (the demo narrative)

### Grounded account read (US2)

In the widget: **"What were my last three orders?"**

Expected:
1. Widget displays `Obteniendo datos…`.
2. Widget displays `Datos obtenidos, interpretando…`.
3. Assistant replies with a numbered list citing actual order IDs, dates, totals from the shop.

### Grounded catalogue read (US3)

Log out. In the widget: **"What's the price of the Midnight Roast 1 kg whole bean?"**

Expected: same progress feedback, then an answer that matches the storefront's displayed price.

### Grounded add-to-cart (US4)

Log in. In the widget: **"Add 2 × Midnight Roast 1 kg whole bean to my cart."**

Expected:
1. Confirmation card appears.
2. On confirm, widget executes `addCartItem` with the shopper's bearer token.
3. Assistant replies referencing at least one concrete cart field (new count or total) AND directs the shopper to open the cart page to see the change (FR-013, SC-006).
4. The SPA's cart indicator does NOT auto-refresh. Navigating to any screen (including the cart page) refreshes it.

### Graceful degradation (US6)

Stop the shop backend (`cd demo/shop && docker compose stop shop_backend`). In the widget: **"What's the price of the Midnight Roast?"**

Expected: widget shows `Obteniendo datos…`, then fails. Within ~10 seconds (SC-007) the assistant replies with a plain-language explanation that the shop is unreachable. The widget does not hang.

Restart `shop_backend` before continuing.

## Step 6 — Verify the red line (US5)

### No outbound shop traffic from `atw_backend`

During a full session (all three prompts above), observe `atw_backend`'s outbound traffic:

```bash
docker logs ai-to-widget-atw_backend-1 2>&1 | grep -iE "fetch|http" | grep -v localhost
# Expected: empty output.
```

### Sovereignty probe

```bash
cd packages/scripts
npm run test -- sovereignty.contract.test.ts
# Expected: single PASS line.
```

### No shop envs in deployment config

```bash
grep -E "HOST_API_BASE_URL|HOST_API_KEY" docker-compose.yml
# Expected: empty output (FR-017).
```

## Step 7 — Verify reproducibility

```bash
/atw.build
# Expected: every step reports "unchanged"; no files rewritten.

git status
# Expected: clean working tree.
```

## What "done" looks like

All of the following hold:
- Total time from clean clone to finishing Step 5 is under 10 minutes on a typical laptop (SC-001).
- Three demo prompts (Steps 5.1–5.3) each complete in under 6 seconds under nominal broadband (SC-002, SC-003).
- `atw_backend` makes zero outbound connections to the shop API during the demo (SC-004, US5 AC2).
- Re-running `/atw.build` is a no-op (SC-009).
- The sovereignty probe is green (SC-008).

When all of these hold, Feature 007 is demonstrably complete against its acceptance criteria.

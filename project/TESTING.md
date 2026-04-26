# Testing manual — Feature 007 (Widget-driven tool loop)

This document walks you through validating the work landed for
Feature 007 end-to-end. It complements
[`specs/007-widget-tool-loop/quickstart.md`](specs/007-widget-tool-loop/quickstart.md)
by grouping the checks into **automated** (run a test command, read the
verdict) and **manual** (click through the demo and verify the golden
paths) tracks.

If an automated check fails, stop and fix the regression before moving
to the manual checks — the manual checks assume the test suite is green.

---

## 0. Prerequisites

- Docker + Docker Compose.
- Node.js ≥ 20.
- `ANTHROPIC_API_KEY` in the environment for the chat loop (manual
  Track B only).
- A clean working tree on branch `007-widget-tool-loop`.

No shop-specific env vars are required (FR-017). If upgrading an old
clone, `docker compose down -v` and prune any `medusa_*` volumes — the
Medusa testbed is retired as of this feature.

---

## Track A — Automated checks

These are reproducible in seconds and should be run first.

### A1. Scripts package test suite

```bash
cd packages/scripts
npm test
```

Expected: **481 passing**, 0 failing. Notable new suites:

| Test file                                                | Covers                    |
|----------------------------------------------------------|---------------------------|
| `test/render-executors.credential-source.contract.test.ts` | T039 — `bearerAuth` operations emit the pinned `credentialSource` block; public-reads omit it. |
| `test/sovereignty.contract.test.ts`                        | T067 — every `fetch()` in the rendered backend statically resolves to an allowlisted origin (localhost / 127.0.0.1 / `atw_backend` / `atw_postgres`). Fail-closed on unresolvable expressions. |

### A2. Widget package test suite

```bash
cd packages/widget
npm test
```

Expected: **108 passing**, 0 failing. Notable new / updated suites:

| Test file                                    | Covers                    |
|----------------------------------------------|---------------------------|
| `test/chat-action-runner.unit.test.ts`         | T075 — graceful degradation (timeout at 8000 ms, non-2xx verbatim, tool-not-in-catalog, tool-not-in-allowlist). |
| `test/action-executors.abort.unit.test.ts`     | 8000 ms AbortController timeout (was 15 000). |
| `test/action-executors-url.unit.test.ts`       | `credentials: "omit"` under every auth mode (cookie-mode retired). |
| `test/action-card.unit.test.ts`                | Same `credentials: "omit"` assertion on the confirmation-required path. |

### A3. Sovereignty probe in isolation

If you only want to confirm Principle I:

```bash
cd packages/scripts
npm test -- sovereignty.contract.test.ts
```

Expected: one green `PASS` line. Zero findings.

---

## Track B — Manual demo flow

These cover the acceptance stories (US1–US6) against a live stack.

### B1. Bring up the reference shop

```bash
cd demo/shop
docker compose up -d
```

Wait ~15 seconds for Prisma migrations + seed on first boot. Ports:

- Storefront SPA: http://localhost:8080
- Backend OpenAPI: http://localhost:3200/openapi.json
- Swagger UI: http://localhost:3200/docs
- Postgres: localhost:5434 (internal 5432)

Seeded users:

| Email               | Password    | Display name |
|---------------------|-------------|--------------|
| `alice@example.com` | `alicepass` | Alice Rivera |
| `bob@example.com`   | `bobpass`   | Bob Kimathi  |
| `carla@example.com` | `carlapass` | Carla Nguyen |

#### US1 — shop standalone

Open http://localhost:8080, log in as Alice, browse the catalogue, add an
item to the cart, place an order, confirm it shows up under "past
orders". No ATW component is running at this point — this demonstrates
the shop stands on its own (FR-005).

### B2. Point ATW at the shop and build

`/atw.setup` is not a single slash command — the setup flow is six
individual commands that live under `.claude/commands/` of a scaffolded
project. They only resolve inside a Claude Code session started **from
the scaffolded project directory**, not from the repo root.

For this repo the scaffolded project is `demo/atw-shop-host/`. Start
Claude Code there:

```bash
cd demo/atw-shop-host
claude
```

Then run the six commands in order:

```
/atw.init
/atw.brief
/atw.schema
/atw.api        # when prompted for the OpenAPI URL, paste:
                #   http://localhost:3200/openapi.json
/atw.plan
/atw.build
```

- `/atw.api` pointed at the shop's OpenAPI replaces the previous
  action-manifest so the next build emits shop-shaped tools.
- `/atw.build` renders the backend under `.atw/artifacts/backend/` and
  the widget bundle under `.atw/artifacts/widget/`. The emitted
  `action-executors.json` must include `credentialSource` blocks of the
  form

  ```json
  {
    "type": "bearer-localstorage",
    "key": "shop_auth_token",
    "header": "Authorization",
    "scheme": "Bearer"
  }
  ```

  on every authenticated tool (T039 guarantees this at the code level).

Re-running `/atw.build` should be a no-op (FR-022, SC-009).

### B3. Bring up ATW against the shop

```bash
# From repo root; the shop stack from B1 is already up.
docker compose up -d atw_backend atw_postgres
```

Confirm `atw_backend` booted without any `HOST_API_*` envs:

```bash
docker logs ai-to-widget-atw_backend-1 2>&1 | head -30
```

Expected: no "missing HOST_API_BASE_URL" lines (FR-017).

Open http://localhost:8080 again and log in. The widget launcher now
appears inside the SPA.

### B4. Exercise the tool loop

#### US2 — grounded account read

Prompt: **"What were my last three orders?"**

Expected sequence:

1. Widget shows `Obteniendo datos…` (pinned ES; FR-010).
2. Widget shows `Datos obtenidos, interpretando…`.
3. Assistant replies with a numbered list of real order IDs, dates, and
   totals from the shop.

#### US3 — grounded catalogue read (unauthenticated)

Log out first. Prompt: **"What's the price of the Midnight Roast 1 kg
whole bean?"**

Expected: same progress placeholders, then a price that matches the
storefront. No bearer token is attached on this call — it hits the
public `/products` route.

#### US4 — grounded add-to-cart (confirmation path)

Log in. Prompt: **"Add 2 × Midnight Roast 1 kg whole bean to my cart."**

Expected:

1. A confirmation card appears with summary fields.
2. On **Confirm**, the widget executes `add_to_cart` with the shopper's
   bearer JWT from `localStorage["shop_auth_token"]`.
3. The assistant reply cites at least one concrete cart field (new
   total or item count) **and** directs the shopper to open the cart
   page to see the change (FR-013, SC-006).
4. The SPA's cart indicator does **not** auto-refresh. Navigating to
   any screen (including the cart) refreshes it.

On **Cancel**, the loop should post a `declined by shopper` tool_result
back to Opus, which then composes a plain-language acknowledgement.

#### US6 — graceful degradation

```bash
cd demo/shop
docker compose stop shop_backend
```

In the widget: **"What's the price of the Midnight Roast?"**

Expected: widget shows `Obteniendo datos…`, then within ~10 seconds
(SC-007) the assistant replies with a plain-language explanation that
the shop is unreachable. **The widget does not hang.** The 8000 ms
AbortController guarantees the upper bound.

Restart the shop:

```bash
docker compose start shop_backend
```

### B5. Verify the red line (US5 — Principle I)

#### No outbound shop traffic from `atw_backend`

During a full session across B4 prompts above, watch for outbound
connections:

```bash
docker logs ai-to-widget-atw_backend-1 2>&1 | grep -iE "fetch|http" | grep -v localhost
```

Expected: empty output. `atw_backend` never calls the shop API — every
tool runs in the widget.

#### Sovereignty probe (already covered in A3)

```bash
cd packages/scripts
npm test -- sovereignty.contract.test.ts
```

Expected: single `PASS` line.

#### No shop envs in deployment config

```bash
grep -E "HOST_API_BASE_URL|HOST_API_KEY" docker-compose.yml
```

Expected: empty output (FR-017).

### B6. Reproducibility

```
/atw.build
```

Expected: every step reports "unchanged"; no files rewritten (SC-009).

```bash
git status
```

Expected: clean working tree.

---

## What "done" looks like

All of the following hold:

- Track A: 481 scripts tests + 108 widget tests all pass.
- Track B1: shop standalone flow works (US1).
- Track B4: all three prompts (US2, US3, US4) complete successfully
  with the Spanish progress placeholders visible between Opus turns.
- Track B4 US6: shop-down query fails within ~10 s with a plain-language
  explanation, not a hang.
- Track B5: `atw_backend` makes zero outbound connections to the shop
  API; the sovereignty probe is green; no `HOST_API_*` envs remain.
- Track B6: `/atw.build` is a no-op on re-run and the tree stays clean.

When all of these hold, Feature 007 is demonstrably complete against its
acceptance criteria.

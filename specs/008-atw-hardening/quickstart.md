# Quickstart: ATW Hardening end-to-end

**Feature**: 008-atw-hardening
**Date**: 2026-04-24
**Audience**: a Builder who has never integrated ATW before — matching SC-001's "fresh-Builder, zero hand-edits" measurement.

This quickstart is the walk-through that SC-001 through SC-009 are measured against. If any step below requires hand-editing a generated artefact, this feature has not met its goal.

## Prerequisites

- Node.js ≥ 20 and Docker installed.
- Claude Code installed.
- A clean clone of `ai-to-widget` at the `008-atw-hardening` tip (or main after merge).

## Step 0 — Bring up the reference shop

```bash
cd demo/shop
docker compose up -d
```

Wait for the three services (`shop_postgres`, `shop_backend`, `shop_frontend`) to report healthy. The frontend is served at `http://localhost:5173`; the backend at `http://localhost:3100`.

**Validates**: FR-021 / SC-007 — the shop ships with CORS wired to `http://localhost:5173` by default; no in-session patch.

Open `http://localhost:5173`, log in as the seeded user, and confirm the SPA works.

## Step 1 — `/atw.init`

From the repo root, in Claude Code:

```
/atw.init
```

Answer the prompts. On a fresh project, `/atw.init` asks for:

1. **Shop name** — e.g., `Coffee shop demo`.
2. **Deployment type** — default `customer-facing-widget`. Accept.
3. **Storefront origins** — default `http://localhost:5173`. Accept.
4. **Welcome message** — default `"Hi! How can I help you today?"`. Change or accept.
5. **Auth token localStorage key** — default `shop_auth_token`. Accept.
6. **Login URL** — default empty. Optionally provide the SPA login URL.

Inspect `.atw/config/project.md`. It carries quoted ISO timestamps; the frontmatter matches [`contracts/project-md-v2.md`](./contracts/project-md-v2.md).

**Validates**: FR-001, FR-002, FR-005a, FR-008, FR-010 capture paths.

### Re-run sanity check

Run `/atw.init` again. Every prompt is pre-filled with the value you just set. Pressing Enter through each prompt produces a byte-identical frontmatter (except `updatedAt`).

**Validates**: FR-005a / R6.

## Step 2 — `/atw.api`

```
/atw.api
```

Provide the shop's OpenAPI document URL (`http://localhost:3100/openapi.json` by default). The stage:

1. Fetches the OpenAPI.
2. Writes `.atw/artifacts/hash-index.json` with the current shape.
3. Writes `.atw/artifacts/host-requirements.md`.
4. Prints a short in-terminal summary of host requirements.

Open `.atw/artifacts/host-requirements.md`. Every section is populated from `project.md` + OpenAPI.

**Validates**: FR-003, FR-006.

## Step 3 — `/atw.schema`

```
/atw.schema
```

The stage asks for the SQL dump location. If you do not have one, the stage emits the exact `pg_dump` invocation to run (derived from the shop's connection info) and stores the command in `.atw/inputs/README.md`. Run the command; come back; press Enter.

**Validates**: FR-004.

## Step 4 — `/atw.plan`

```
/atw.plan --inputs schema-map.md openapi.md host-requirements.md
```

The CLI accepts the documented positional-args form. No "Unexpected argument" error.

**Validates**: FR-007.

## Step 5 — `/atw.classify`

```
/atw.classify
```

Because `deploymentType: customer-facing-widget` is set, shopper-scoped bearer-JWT operations (`/cart/*`, `/orders/*`, `/customers/me`) are ACCEPTED into the widget tool catalog — not excluded.

Inspect `.atw/artifacts/action-manifest.md`. It contains tool groups for cart, orders, customers. Groups targeting per-shopper runtime endpoints are flagged `(runtime-only)`.

**Validates**: FR-010, FR-012, US1 AC1.

## Step 6 — `/atw.build`

```
/atw.build
```

The stage runs validate → enrich → render → bundle. No zero-entity schema-map parse silently succeeds; no action-reference validation fails on runtime-only groups; no authed tool ships without `credentialSource` (the stage would halt with D-CREDSRC if so).

At completion, the DONE banner prints:

```
✅ Build complete.

Next steps:
  1. Run /atw.embed to get your integration snippet.
  2. Copy dist/widget.{js,css} and .atw/artifacts/action-executors.json
     into your host's public assets.
  3. Paste the snippet from /atw.embed into your host's HTML <body>.
  4. Review .atw/artifacts/host-requirements.md before going live.
```

Open `.atw/artifacts/action-executors.json`. Every authed entry carries a populated `credentialSource`. Entries for which the classifier authored a summary template carry `summaryTemplate`.

**Validates**: FR-005, FR-009, FR-011, FR-012, FR-013.

## Step 7 — `/atw.embed`

```
/atw.embed
```

Output contains, in order:
1. A files-to-copy markdown task-list (`dist/widget.js`, `dist/widget.css`, `.atw/artifacts/action-executors.json`).
2. A host-requirements reminder pointing at `.atw/artifacts/host-requirements.md`.
3. A `<script>` snippet with `data-auth-token-key`, `data-allowed-tools` (alphabetically sorted), `data-welcome-message`.

Copy the listed files into `demo/atw-shop-host/public/` (or your host's public assets directory). Paste the snippet into the storefront HTML.

**Validates**: FR-014, FR-015, FR-016, FR-017, SC-005.

## Step 8 — Load the storefront and use the widget

Open `http://localhost:5173`. Log in. The widget launcher appears. Open it.

1. **First render shows the configured welcome message.** Not a hard-coded greeting.
   **Validates**: FR-025, US5 AC1.
2. **Ask a read-class question.** e.g., "What coffees do you have?". A thinking indicator appears immediately in the transcript; the widget fetches `/products`; the assistant replies with a natural-language list grounded in the fetched data.
   **Validates**: FR-024, SC-009.
3. **Ask a write-class question.** e.g., "Add an espresso to my cart". A pending-action confirmation card appears with a human-readable summary ("Add 1× Espresso to your cart"), not raw JSON.
   **Validates**: FR-026, US5 AC3.
4. **Confirm.** The widget fetches `POST /cart/items` with `Authorization: Bearer <token>` from `localStorage["shop_auth_token"]`. Server responds 200. The widget POSTs `tool_result` back to the chat endpoint carrying `tool_name: "addToCart"` and `tool_input: {product_id, quantity}`. The backend reconstructs the Anthropic message trio, re-invokes Opus, and streams a natural-language confirmation ("Added 1× Espresso to your cart — want to check out?") — NOT a templated blob and NOT the "unexpected tool_use_id" failure from the Feature 007 demo.
   **Validates**: FR-018, FR-019, FR-020, SC-002, US2.
5. **Browser devtools network tab shows no CORS failures.** Preflight `OPTIONS /cart/items` returns 204 with `Access-Control-Allow-Origin: http://localhost:5173` and `Access-Control-Allow-Headers: Authorization, Content-Type`.
   **Validates**: FR-021, SC-007, US2 AC3.

## Step 9 — Loud-failure spot-checks (optional)

Temporarily misconfigure each of the following, reload, observe the visible in-widget or terminal diagnostic per [`contracts/builder-diagnostics.md`](./contracts/builder-diagnostics.md), then revert:

1. Strip `data-allowed-tools` from the embed script tag → widget shows D-TOOLNOTALLOWED as a transcript row when a tool fires.
2. Rename the copied `action-executors.json` to break the fetch → widget shows D-NOEXECUTORS.
3. Delete the SQL dump → `/atw.build` halts with D-SQLDUMP and the exact `pg_dump` command.
4. Change a schema-map heading from H2 to H3 → `/atw.build` halts with D-ZEROENTITY (variant A).
5. Remove `security:` from the OpenAPI operation → `/atw.build` halts with D-CREDSRC listing the affected operations.

**Validates**: FR-022, FR-023, SC-004.

## Step 10 — Model-failure fallback (optional)

Inject a failure on the post-`tool_result` Opus call (e.g., by temporarily setting an invalid API key after the widget successfully executes a write action). The backend retries three times (500 ms → 1 s → 2 s), then emits `{response_generation_failed:true, action_succeeded:true, pending_turn_id:null}`. The widget renders the pinned fallback string *"Action completed successfully. (Response generation failed — please refresh.)"* — not the generic error toast.

**Validates**: FR-020a, R5.

## Success exit

All ten steps complete without hand-editing any generated artefact. The widget is live on the storefront; write actions succeed end-to-end with natural-language replies; every failure mode is loud; every tool ships with its credential source; every host contract is documented in `host-requirements.md`.

**This is SC-001's measurement. If any step required hand-editing, file a regression against this feature.**

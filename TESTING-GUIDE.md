# AI to Widget — Complete Testing Guide

This guide takes you from a **fresh clone** to a **working widget answering grounded
questions on a real storefront**, walking through all three features (001 setup flow,
002 build pipeline, 003 runtime). Self-contained: after following it you will have
the Aurelia storefront at `http://localhost:8000` with a chat widget that cites real
products, executes confirmed cart actions, and never leaks shopper credentials to the
ATW backend — or, on the alternative path, the same widget embedded in **your own
host app** pointing at **your own database**.

> **Current repo state.** 111 / 118 Feature 003 tasks shipped (94%). Tests: 381
> passing, 16 Docker-gated. The Aurelia demo scaffolding is fully in place: every
> Dockerfile, every seed file, the Playwright E2E, `/atw.embed`, and the
> `docker-compose.yml` all ship. **Seven tasks remain** and are the ones you,
> the human, perform once on your machine before the demo runs the first time:
> pull pinned image digests, run `/atw.build` once to generate the indexed
> database dump, and commit the result. §5.1 walks through each step.

> **Want to test the whole circuit without spending $14?** Read §3.5 first.
> There is a `--no-enrich` mode that costs **$0** and exercises every piece of
> the stack — Docker, Postgres, widget bundle, panel UI, confirmation cards,
> host-API round-trip, credential sovereignty — just without the Opus-enriched
> retrieval documents. Use it to validate the wiring end-to-end, then decide
> later whether to spend on enrichment.

---

## 1. Prerequisites

On your machine:

| Tool | Minimum version | Check with | Notes |
|------|-----------------|------------|-------|
| Node.js | 20 LTS | `node --version` | Repo pins via `.nvmrc` |
| npm | 10+ | `npm --version` | Ships with Node 20 |
| Git | recent | `git --version` | For cloning |
| Docker | 24+ | `docker --version` | Desktop (Mac/Win) or Engine (Linux/WSL2) |
| Claude Code | current | `claude --version` | Authenticated — https://claude.com/claude-code |
| Anthropic API key | — | — | With access to `claude-opus-4-7` |
| Postgres (your client's DB) | 12+ | — | **Not needed for the demo.** Only if you're integrating with your own real host app (Path A) |

Export the API key in the shell that will launch Claude Code:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

```cmd
set ANTHROPIC_API_KEY=sk-ant...
```

```PowerShell
$env:ANTHROPIC_API_KEY="tu_clave"
```

**Budget estimate** for the one-time Aurelia demo build (the bootstrap step in §5.1):
**~$14 USD** in Opus calls, billed once. Subsequent `make demo` runs replay the
committed dump offline — zero Anthropic cost. For your own projects, enrichment
cost scales with entity count (a ~20-entity demo costs under $1; a 1 000-entity
catalog costs ~$40).

---

## 2. Clone and bootstrap the repository

```bash
git clone https://github.com/<owner>/ai-to-widget.git
cd ai-to-widget
npm install        # installs deps across the four workspaces (scripts / backend / widget / installer)
npm run build      # compiles packages/scripts/dist and packages/installer/dist
```

`npm install` pulls ~750 packages in ~30 s. `npm run build` is near-instant and is
required because every `atw-*` bin shim reads from a compiled `dist/`.

Sanity-check:

```bash
npm test
```

Expected: **381 tests passing, 16 skipped** (the 16 are `ATW_E2E_DOCKER=1`-gated
integration and Playwright specs — they unlock once the demo stack is up).

---

## 3. Choose your path

Pick based on what you want to achieve:

### Path A — Embed the widget into your own host app

You have a real application (your own Medusa store, Shopify, Django, Rails, a plain
HTML site — anything) and you want to index its catalog and ship a chat widget on
its pages. **Go to §4.**

### Path B — Run the canonical Aurelia Medusa demo

You want the showcase: `docker compose up` → coffee storefront at
`http://localhost:8000` → chat widget citing 300 real coffee products → add-to-cart
flowing through Medusa → reproducible on any machine with Docker. **Go to §5.**

You can do both: Path B first to see the system working end-to-end, then Path A to
integrate it into your own stack.

---

## 3.5 Enrichment modes — test the circuit for free first

Most of the $14 Path B budget (and all the per-entity cost in Path A) comes from
**one** phase inside `/atw.build`: **enrichment** — one Opus 4.7 call per
indexable entity to produce the grounded document + cited facts + semantic
categories that later power retrieval and citations.

You **don't have to pay that up front to test the circuit**. Three tiers, from
free to full quality. You can always start on Tier 1, confirm every moving part
works (Docker, Postgres, embedding, widget, CORS, confirmation card, host-API
round-trip), and only then spend on enrichment to get the real answers.

| Tier | Cost for Aurelia (342 entities) | What you lose | Use when |
|------|-------------------------------|----------------|----------|
| **1 — No enrichment** (`--no-enrich`) | **$0** | Retrieval quality drops materially; no `fact.source` citations; no semantic categories; Principle V (anti-fabrication) degrades from structural to "Opus-promises" | Smoke-test the whole circuit end-to-end without spending anything |
| **2 — Haiku instead of Opus** | **~$1.40** | Slightly higher validator retry rate; lower anchoring rigour; some answers less crisp | Small catalogs (Path A), iterations during development, non-critical demos |
| **3 — Opus + reduced seed** | scales linearly (~$1 for 30 entities, ~$2 for 60, ~$14 for 342) | Less catalog breadth on screen in the demo | You want real Principle V quality but at a smaller scale |

### Tier 1 — `--no-enrich` ($0)

Everything runs **except** the Opus calls. The pipeline boots Postgres, applies
migrations, imports your SQL dump, builds the backend image, compiles the
widget — and leaves `atw_documents` empty-ish (the dump is in `client_ref` but
no enriched documents exist yet).

Run:

```bash
# Inside Claude Code, same flow as normal, but pass the flag:
> /atw.build --no-enrich
```

What works:
- `/health` returns 200 once Postgres is up.
- The widget bundle is built; the launcher appears; the panel opens.
- `POST /v1/chat` runs end-to-end: embeddings, retrieval, Opus call at
  **runtime** (one cheap call per shopper message, not per entity).
- Confirmation cards render.
- Host-API calls go out with shopper credentials; Principle I still holds.

What doesn't:
- Retrieval returns nothing meaningful because `atw_documents` is empty. Opus
  falls back to *"the catalog does not cover that topic"* for every question.
  That's actually **a useful test** — it proves the anti-fabrication floor is
  honoured even when retrieval fails.

When to graduate: once you've seen the widget appear, send a message, render an
action card, and click confirm — at that point you know every piece of wiring
is sound and **then** you can pay for enrichment to make the agent actually
useful.

### Tier 2 — Haiku 4.5 enrichment (~$1.40 for Aurelia)

Same pipeline, cheaper model. Edit one constant:

```ts
// packages/scripts/src/orchestrator.ts:47
- const DEFAULT_OPUS_MODEL = "claude-opus-4-7";
+ const DEFAULT_OPUS_MODEL = "claude-haiku-4-5-20251001";
```

Then `npm run build` inside `packages/scripts` and re-run `/atw.build`.
Pricing drops from $15 / $75 per 1M input/output tokens to roughly $1 / $5 —
about **10× cheaper per call**.

Trade-off: Haiku's anti-fabrication discipline is looser. The validator
(`packages/scripts/src/lib/enrichment-validator.ts`) rejects its responses more
often than Opus's, and each rejection triggers a sharpening retry that burns
tokens. Net cost is ~10× cheaper, not 15×, because of the retries.

Quality-wise the retrieved documents read more mechanically and the category
tagging is less nuanced. Fine for development and for catalogs where product
descriptions are already rich; weaker when the source data is sparse.

### Tier 3 — Opus 4.7 on a reduced seed (scaled cost)

Keep the quality, pay less by enriching fewer entities. Edit the generator:

```bash
# packages/scripts edits are not needed. Only touch the seed generator:
$EDITOR demo/medusa/seed/generate-products.mjs
```

Inside, find the four loops at the bottom and scale them down:

```js
// Current (matches demo/atw-aurelia/.atw/artifacts/build-plan.md totals):
for (let i = 0; i < 160; i++) { /* single-origins */ }
for (let i = 0; i <  40; i++) { /* blends */ }
for (let i = 0; i <  10; i++) { /* decaf */ }
for (let i = 0; i <  90; i++) { /* gear */ }

// Smaller: 20 coffees + 10 gear = 30 total
for (let i = 0; i <  15; i++) { /* single-origins */ }
for (let i = 0; i <   5; i++) { /* blends */ }
for (let i = 0; i <   0; i++) { /* decaf */ }   // skip
for (let i = 0; i <  10; i++) { /* gear */ }
```

Regenerate:

```bash
node demo/medusa/seed/generate-products.mjs > demo/medusa/seed/products.json
```

Then `make fresh` (re-seeds Medusa) and `/atw.build`. With 30 entities, total
Opus cost drops to ~$1.20. You still get real Principle V, real citations, real
semantic facets — just on a smaller catalog.

### The testing workflow this guide is organised around

1. **Tier 1 first** (`--no-enrich`) — confirm the whole circuit is wired:
   Docker up, Postgres healthy, widget loads, panel opens, confirmation cards
   render, host-API executes on confirm, Principle I invariant holds in
   DevTools. Zero dollars.
2. Once everything moves: **Tier 2 or Tier 3** on a reduced scope — see real
   grounded answers on a small catalog. About $1–2.
3. When you're ready to ship or film: **full Opus + full seed** for Aurelia,
   paid once, dump committed to `atw.sql`, replayed offline forever after (§5.1
   Step 4–5). That's where the $14 comes from.

### Subscription vs API billing (answered up front to avoid confusion)

The Anthropic Pro / Max subscription covers Claude Code and claude.ai; it does
**not** cover programmatic API calls. `/atw.build` uses your
`ANTHROPIC_API_KEY` against the API billing rail — the two are separate
accounts at Anthropic. There is no flag that redirects API calls to your Pro
balance. Tier 1 (`--no-enrich`) is the only $0 path available today.

---

## 4. Path A — Embed the widget into your own host app

### 4.1 Scaffold an agent project

Outside the `ai-to-widget` repo:

```bash
mkdir my-agent
cd my-agent
npx --yes create-atw@latest .
```

For development from a local clone (before `create-atw` is on npm), run instead
from inside the clone:

```bash
cd /path/to/clone/ai-to-widget
npm run dev:install -- /path/to/my-agent
```

You should see:

```text
✓ Created .atw/ structure
✓ Copied slash commands to .claude/commands/
✓ Wrote docker-compose.yml template
✓ Wrote README-atw.md
✓ Ensured .atw/inputs/ is in .gitignore

Next: open Claude Code in this directory and run /atw.init.
```

Resulting layout:

```text
my-agent/
├── .atw/
│   ├── config/       # will hold project.md + brief.md
│   ├── artifacts/    # schema-map.md + action-manifest.md + build-plan.md
│   ├── inputs/       # drop your SQL dump here (git-ignored)
│   ├── state/
│   └── templates/
├── .claude/
│   └── commands/
│       ├── atw.init.md
│       ├── atw.brief.md
│       ├── atw.schema.md
│       ├── atw.api.md
│       ├── atw.plan.md
│       ├── atw.build.md
│       └── atw.embed.md
├── .gitignore
├── docker-compose.yml
├── package.json
└── README-atw.md
```

### 4.2 Export your client's inputs

AI to Widget **never** connects to your client's production database (Principle I,
red-line). You export two artefacts manually, once:

**Schema dump** (mandatory):

```bash
pg_dump --schema-only --no-owner --no-privileges \
  -U <user> -h <host> <db> > schema.sql

# Optional but recommended: sample data (≤50 rows per table)
pg_dump --data-only --inserts --no-owner --no-privileges \
  --rows-per-insert=50 \
  -U <user> -h <host> <db> > sample-data.sql

# Combined — the common case:
cat schema.sql sample-data.sql > my-client.sql
cp my-client.sql my-agent/.atw/inputs/
```

**OpenAPI specification** for your client's backend: file (JSON or YAML), public URL,
or clipboard paste when `/atw.api` asks for it.

### 4.3 Run the five Feature 001 slash commands

From the agent project directory:

```bash
cd my-agent
claude
```

Inside the Claude Code chat, run the five commands **in order**. They are
interactive — Claude asks questions, proposes answers, and you confirm or edit:

```text
> /atw.init
```
Asks project name, agent language(s), deployment type
(`customer-facing-widget` / `internal-copilot` / `custom`). Writes
`.atw/config/project.md`. ~1 minute.

```text
> /atw.brief
```
A guided 10–15 minute conversation about what the business does, the agent's tone
of voice, and what the agent **must not** do. Every claim in the final draft is
traceable to something you said (FR-013). Writes `.atw/config/brief.md`.

```text
> /atw.schema
```
You point it at `.atw/inputs/my-client.sql` (relative path). Claude reads the
schema, classifies each table (`indexable` / `reference` / `operational` /
`infrastructure`), **auto-excludes PII** (customers, addresses, payments,
passwords), and walks you entity-by-entity for confirmation. Writes
`.atw/artifacts/schema-map.md`.

> **Hard rule**: if you try to paste a DSN (`postgres://user:pass@host/db`) the
> command refuses. There is no path for credentials to enter the system.

```text
> /atw.api
```
You hand it your OpenAPI (file, URL, or paste). Claude classifies every operation
into one of six buckets: `safe_read` (side-effect-free GET), `action`
(POST/PATCH/DELETE behind confirmation), `admin` (excluded), `destructive`
(excluded), `auth` (excluded), `unclear` (asks you). Writes
`.atw/artifacts/action-manifest.md`.

```text
> /atw.plan
```
Read-only on your side. Shows a prose summary plus a cost estimate; you confirm.
Writes `.atw/artifacts/build-plan.md`.

**Checkpoint.** Five markdown files in `.atw/` document every decision. Open any of
them in your editor and change anything — the next `/atw.build` respects the edits.

### 4.4 Run `/atw.build` (Feature 002)

From the same Claude Code session:

```text
> /atw.build
```

You see a plan summary with entities to enrich, estimated cost, Opus model,
Postgres port, etc. Confirm with `y`.

The pipeline:

1. **BOOT** — starts `atw_postgres` (Docker) on `:5433` with pgvector.
2. **MIGRATE** — applies idempotent migrations (`atw_migrations` ledger).
3. **IMPORT** — replays your SQL dump into a `client_ref` schema with PII
   columns stripped.
4. **ENRICH** — per indexable entity: assembles input → calls Opus 4.7 with the
   anti-fabrication system prompt → validates every `fact.source` exists in the
   input → computes a local embedding (`bge-small-multilingual-v1.5`) → upserts
   into `atw_documents`.
5. **RENDER** — Handlebars templates → `backend/src/*.ts`.
6. **BUNDLE** — esbuild produces `dist/widget.js` + `dist/widget.css` (fails if
   either exceeds 80 KB / 10 KB gzipped — SC-009).
7. **IMAGE** — multi-stage build of `atw_backend:latest` (distroless Node).
8. **COMPOSE-ACTIVATE** — uncomments the ATW block in `docker-compose.yml`.
9. **PII SCAN** — verifies no PII value from the dump slipped into
   `atw_documents`.
10. **MANIFEST** — atomic write of `.atw/state/build-manifest.json`.

Typical wall-clock on a 4-core / 16 GB runner:

| Size | Entities | Time | Cost |
|------|----------|------|------|
| Mini | ~20 | 3 min | <$1 |
| Aurelia | ~342 | 14–18 min | ~$12 |
| Medium | ~1 000 | 30–45 min | ~$40 |

**Outputs when it finishes:**

- `atw_postgres` running on `localhost:5433` with `atw_documents` populated.
- `atw_backend:latest` in `docker images`.
- `dist/widget.js` and `dist/widget.css`.
- `backend/src/*.ts` rendered.
- `docker-compose.yml` with the ATW block active.
- `.atw/state/build-manifest.json` with `result: "success"`.

If you Ctrl+C mid-run, the manifest is written with `result: "aborted"`, and the
next `/atw.build` resumes without re-enriching already-committed entities
(source-hash skip).

### 4.5 Run `/atw.embed` (Feature 003)

Same Claude Code session:

```text
> /atw.embed
```

Claude asks:

| Question | Options |
|----------|---------|
| Host framework | `next-app-router`, `next-pages-router`, `plain-html`, `custom` |
| ATW backend URL | e.g. `http://localhost:3100` locally |
| Host auth mode | `cookie` (default), `bearer`, `custom` |
| (bearer only) localStorage token key | e.g. `my_app_token` |
| Host API base URL | default: `window.location.origin` |
| (optional) Login URL | for the anonymous-fallback link |
| (optional) Theme primary / radius / font | for the widget's CSS tokens |

Non-interactive form:

```bash
cat > .atw/state/embed-answers.md <<'EOF'
---
framework: next-app-router
backend_url: http://localhost:3100
auth_mode: cookie
api_base_url: http://localhost:9000
login_url: http://localhost:8000/login
locale: en-US
theme:
  primary: "#8B4513"
  radius: "4px"
  font: "Inter, sans-serif"
---
EOF

npx atw-embed --answers-file .atw/state/embed-answers.md
```

Writes `.atw/artifacts/embed-guide.md` — a markdown document tailored to your
framework with:

1. Where to copy `widget.js` and `widget.css`.
2. The exact `<script>` + `<link>` tags to paste.
3. Required CORS on **both** your host API and the ATW backend.
4. A theming snippet pre-filled with any colours / radius / font you provided.
5. Troubleshooting checklist (launcher missing, CORS errors, 401s on actions,
   tool-allowlist refusals).

The command is **deterministic**: identical answers → byte-identical
`embed-guide.md` (verified by SHA-256 round-trip tests).

### 4.6 Install the widget in your host app

Follow `embed-guide.md`. For Next.js App Router it ends up looking like:

```tsx
// app/layout.tsx
import Script from "next/script";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US">
      <body>
        {children}
        <link rel="stylesheet" href="/widget.css" />
        <Script
          src="/widget.js"
          strategy="afterInteractive"
          data-backend-url="http://localhost:3100"
          data-api-base-url="http://localhost:9000"
          data-auth-mode="cookie"
          data-launcher-position="bottom-right"
          data-locale="en-US"
          data-login-url="http://localhost:8000/login"
        />
      </body>
    </html>
  );
}
```

Copy the compiled bundle into your host's static folder:

```bash
cp /path/to/my-agent/dist/widget.js /path/to/your-host/public/widget.js
cp /path/to/my-agent/dist/widget.css /path/to/your-host/public/widget.css
```

### 4.7 Configure CORS

On the **ATW backend** (env var when starting):

```bash
export ALLOWED_ORIGINS=http://localhost:3000,https://your-host.example.com
```

On your **host API**, respond to requests from the storefront origin with:

- `Access-Control-Allow-Origin: <storefront origin>`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Credentials: true` **only in cookie mode**

### 4.8 Start the runtime

```bash
cd my-agent

# 1) atw_postgres is already running from /atw.build (port 5433). Verify:
docker ps | grep atw_postgres

# 2) Start the ATW backend:
docker run --rm -d \
  --name atw_backend \
  -p 3100:3100 \
  --network host \
  -e DATABASE_URL=postgres://atw:atw_local@localhost:5433/atw \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  -e HOST_API_BASE_URL=http://localhost:9000 \
  atw_backend:latest

# 3) Health check:
curl http://localhost:3100/health
# {"status":"ok"}

# 4) Start your host app however you normally do:
cd /path/to/your-host
npm run dev
```

Open `http://localhost:3000`. The launcher appears in the bottom-right corner.
Click → panel slides in → type "What products do you have for X?" → Opus responds,
citing real entries from your catalog, with facts grounded in your data.

### 4.9 Try an action with confirmation

Ask something state-changing: "Add 2 of the Colombia Huila to my cart." The agent
proposes an `add_to_cart` action → the widget renders a confirmation card showing
product, quantity, price, total. **No HTTP call to your host API runs yet.** Click
**Confirm** → the widget sends `POST /store/carts/{cart_id}/line-items` to your
host API using the shopper's **own** session cookie (not the backend's). The host
responds 200 → widget shows success → agent narrates it in the next turn.

**Critical invariant**: open DevTools → Network. Requests to `localhost:3100`
(ATW backend) carry **no** `Cookie` and **no** `Authorization`. Requests to
`localhost:9000` (your host API) do — but with the shopper's credentials, never
the backend's.

---

## 5. Path B — Run the canonical Aurelia Medusa demo

Goal: a reproducible, end-to-end demo anyone can run with `git clone` → one-time
bootstrap → `make demo`. The scaffolding (300-product seed, Medusa Dockerfiles,
widget wiring, Playwright E2E) all ships in the repo. The **one-time** human
bootstrap is in §5.1.

### 5.1 One-time bootstrap (first reviewer on a given commit)

These seven steps run once per repo state. Subsequent `make demo` runs skip them
entirely because they produce **committed** artefacts.

> **Heads-up before you spend money.** Step 3 below calls Opus 4.7 ~342 times
> and costs ~$14 in API usage. If you want to **test the circuit first without
> spending anything**, skip to §3.5 and use Tier 1 (`--no-enrich`) or Tier 3
> (reduced seed). Come back here only when you're ready to commit the
> full-fidelity `atw.sql` dump.

```bash
cp .env.example .env
$EDITOR .env        # set ANTHROPIC_API_KEY
```

**Step 1 — Pin the image digests (replaces T074 placeholders):**

```bash
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull pgvector/pgvector:pg16
docker inspect --format='{{index .RepoDigests 0}}' postgres:16-alpine
docker inspect --format='{{index .RepoDigests 0}}' redis:7-alpine
docker inspect --format='{{index .RepoDigests 0}}' pgvector/pgvector:pg16
```

Take the `@sha256:…` suffix from each and replace the three
`# TODO(compose-digest): pin @sha256:<digest>` placeholders in
`docker-compose.yml`. Commit.

**Step 2 — Start Medusa only (to be seeded):**

```bash
make fresh
```

This brings up `medusa_postgres`, `medusa_redis`, `medusa_backend`, and
`medusa_storefront` — no ATW services yet. The Medusa backend's entrypoint runs
`demo/medusa/seed/seed.mjs`, which inserts all 300 products + 25 categories +
12 collections + 4 regions + 3 synthetic demo customers + 6 sample orders
idempotently.

Wait for `docker compose logs medusa_backend` to show `[seed] done` and the
storefront to report listening on `:8000`.

**Step 3 — Build the ATW index against the seeded catalog:**

```bash
cd demo/atw-aurelia
claude
> /atw.build    # ~15 min, ~$14 Opus
```

The pre-built `.atw/config/*.md` and `.atw/artifacts/*.md` are already committed
under `demo/atw-aurelia/.atw/`, so Feature 001 is skipped. `/atw.build` reads
them, enriches all 342 indexable entities (300 products + 25 categories +
12 collections + 4 regions + 1 brand summary), computes embeddings, builds
`atw_backend:latest`, and writes the manifest.

**Step 4 — Export the indexed database dump (T073):**

```bash
pg_dump --no-owner --no-privileges \
  --data-only --table=atw_documents --table=atw_migrations \
  -U atw -h 127.0.0.1 -p 5433 atw > demo/atw-aurelia/atw.sql
```

Expected size: ~2–3 MB. This is the deterministic initial state of
`atw_postgres` on subsequent `make demo` runs; committing it is what makes the
demo reproducible in 3 minutes without re-running enrichment.

**Step 5 — Commit the dump and the pinned compose:**

```bash
git add demo/atw-aurelia/atw.sql docker-compose.yml
git commit -m "US4: pin compose digests and commit Aurelia atw_documents dump"
```

**Step 6 — Restart the full stack:**

```bash
docker compose down -v
make demo
```

First `make demo` reconstructs everything from committed state; `atw_postgres`
imports `demo/atw-aurelia/atw.sql` on first boot (init-script mount, T075); all
six services converge to healthy in **under 3 minutes** on reference hardware.

**Step 7 — Verify:**

Open `http://localhost:8000`. The Aurelia storefront loads with the full catalog.
Click the launcher (bottom-right). Type in Spanish or English:

```
Estoy buscando un café chocolatoso para filtro en V60.
```

Expected within 4 s:

- A typing indicator.
- A reply that names two or three real products from the seeded catalog with
  real tasting notes.
- Each cited product renders as an inline link you can click to navigate to
  the real product page.

### 5.2 The reviewer / demo path (after the bootstrap)

Once Step 5 above is committed, **anyone** who clones the repo goes through this
only:

```bash
git clone https://github.com/<owner>/ai-to-widget.git
cd ai-to-widget
cp .env.example .env && $EDITOR .env    # set ANTHROPIC_API_KEY
make demo                                # ~2–3 min on a fresh Docker
open http://localhost:8000
```

And that is it. No Claude Code, no `/atw.*` commands, no Opus calls. The
committed `atw.sql` dump is offline-reproducible.

### 5.3 The full setup-flow path (filmed for the demo video)

For filming the setup portion of the demo video, or for validating that Features
001–003 work end-to-end from zero:

```bash
make fresh                      # brings Medusa up only; wipes ATW volumes and pre-built .atw/state
```

Then in Claude Code from the repo root:

```text
> /atw.init
> /atw.brief
> /atw.schema      # point at demo/medusa/seed/schema.sql (exported by the first make fresh)
> /atw.api         # point at demo/medusa/seed/openapi.json
> /atw.plan
> /atw.build
> /atw.embed
```

Total ~30 min + ~$14 Opus.

Then bring the ATW services up:

```bash
docker compose up atw_postgres atw_backend -d --wait
```

And the storefront at `:8000` is fully re-enriched from scratch.

### 5.4 Scripted 5-turn demo conversation

The exact flow the Playwright E2E (`tests/e2e/aurelia-demo.spec.ts`) runs on
every CI lane with `ATW_E2E_DOCKER=1`:

1. **Flavour profile**: "Estoy buscando un café chocolatoso para filtro en V60,
   sin demasiada acidez." → Colombia Huila + Kenya Karundul cited with grounded
   notes. ≤ 4 s (SC-001).
2. **Comparison**: "Compáramelo con el Ethiopia Yirgacheffe — ¿cuál es mejor
   para V60?" → both entities referenced with at least one fact each (SC-001
   sub-case).
3. **Add to cart**: "Añade 2 Colombia Huila 250 g a mi carrito." → confirmation
   card renders; the Medusa cart does **not** update yet.
4. **Confirm**: click the card's primary button → `POST
   /store/carts/{cart_id}/line-items` fires against the Medusa backend with the
   shopper's cookie; cart icon updates within 2 s (SC-002); agent acknowledges.
5. **Anonymous check** (in a separate incognito tab): "What did I order last
   time?" → friendly "please log in first" reply with a login link — no
   fabricated orders (SC-004).

Concurrently verified in DevTools:

- Only two outbound origins appear: `localhost:3100` (ATW backend) and
  `localhost:9000` (Medusa). No third-party origin (SC-011).
- Zero `Cookie` / `Authorization` headers on any request to `localhost:3100`
  (SC-006).

### 5.5 Demo customer credentials

Three synthetic customers ship under `demo/medusa/seed/customers.json`. Their
credentials are intentionally public so reviewers can exercise the
authentication-passthrough flow:

| Email | Password |
|-------|----------|
| `alice.demo@aurelia-coffee.local` | `aurelia-demo-1` |
| `bob.demo@aurelia-coffee.local` | `aurelia-demo-2` |
| `carmen.demo@aurelia-coffee.local` | `aurelia-demo-3` |

Log in at `/account`, open the widget, ask "What did I order last time?" — the
widget calls the Medusa API with your session cookie, the agent summarises your
real orders. **Do not reuse these credentials on any non-demo Medusa deployment.**

---

## 6. Running the tests

Four tiers, each layered on top of the previous:

### 6.1 Unit — fast, no Docker

```bash
cd /path/to/clone/ai-to-widget
npx vitest run
```

Expected: **381 passing, 16 skipped, 0 failing**. Covers zod shapes, error
codes, config loading, credential-strip predicate, logger redaction paths, PII
scrubber, widget auth builder, markdown sanitiser, api-client, action-card tool
allowlist, state FIFO, Preact panel, `/atw.embed` generator.

### 6.2 Contract — fast, no Docker

Runs as part of `npx vitest run`. Covers `/v1/chat` handler shape, CLI exit
codes (`/atw.embed`), runtime-config missing-var behaviour.

### 6.3 Integration — Docker-gated

```bash
export ATW_E2E_DOCKER=1
make demo   # stack must be up
npx vitest run tests/integration/
```

Unlocks 13 integration tests that probe the live backend:

- `runtime-chat-grounded.test.ts` — SC-001 grounded reply under 4 s.
- `runtime-action-confirmation.test.ts` — SC-002 action intent with resolved path.
- `runtime-multi-turn.test.ts` — SC-003 pronoun resolution across 5 turns.
- `runtime-comparison.test.ts` — "A vs B" cites both.
- `runtime-credential-sovereignty.test.ts` — SC-006 no backend credential leak.
- `runtime-auth-modes.test.ts` — FR-022 cookie / bearer / custom.
- `runtime-anonymous-fallback.test.ts` — SC-004 login-link surface.
- `runtime-rate-limit.test.ts` — SC-010 429 + Retry-After.
- `runtime-bundle-size.test.ts` — SC-009 (this one runs even without Docker).
- Plus three Feature 002 integration tests.

### 6.4 E2E — full stack + Playwright

```bash
npx playwright install chromium firefox webkit
export ATW_E2E_DOCKER=1
npx playwright test
```

Runs on three browsers by default:

- `aurelia-demo.spec.ts` — the scripted 5-turn conversation from §5.4.
- `accessibility.spec.ts` — axe-core scan of the open panel (SC-013 zero
  serious/critical WCAG 2.1 AA violations).
- `runtime-theming.spec.ts` — SC-012 CSS custom property override flows through
  without rebuild.
- `runtime-tool-allowlist.spec.ts` — SC-008 forged tool names are refused with
  zero host-API calls.

---

## 7. Verifying Principle I in DevTools

The widget **never** sends shopper credentials to the ATW backend. Manual check:

1. Open DevTools in the browser.
2. Network tab → filter by `localhost:3100`.
3. Send a message in the chat.
4. Click any captured request → Headers.
5. Verify there is **no** `Cookie`, **no** `Authorization`, and no header
   matching `X-*-Token`, `X-*-Auth`, or `X-*-Session` (other than
   `X-Atw-Session-Id`, which is a widget-issued UUID for rate limiting).

If any of them appear it is a bug — open an issue. The backend's `onRequest`
hook strips them defensively even if they did arrive, but the invariant is that
the widget never attaches them in the first place (`buildBackendHeaders`
in `packages/widget/src/auth.ts`).

---

## 8. What still requires a human

Seven tasks in `specs/003-runtime/tasks.md` remain `[ ]` because they are not
reproducible in a text-only session. Six are "do once on your machine with
Docker running" (§5.1 above), and one is the demo video:

| Task | What it is |
|------|------------|
| T073 | Run `/atw.build` once to generate `demo/atw-aurelia/atw.sql` |
| T074 | `docker pull` + pin the three compose digests |
| T075 | Verify the `atw.sql` init-script mount works on fresh `make demo` |
| T115 | Cross-platform verification of `quickstart.md` on macOS / Linux / WSL2 |
| T116 | Run the full suite with `ATW_E2E_DOCKER=1` green |
| T117 | Commit `demo/atw-aurelia/atw.sql` with regeneration notes |
| T118 | Record the 3-minute demo video (filmed setup ~1 min + live widget ~1:30 + reproducibility statement ~30 s) |

After T073–T075 + T117 are committed, anyone on any machine can run `make demo`
and reach a working storefront in ~3 minutes. See
`specs/003-runtime/post-impl-notes.md` for the exact resumption checklist.

---

## 9. Troubleshooting

### The launcher does not appear

1. Open the browser console. Look for an `[atw]` error.
2. Most common: `data-backend-url` missing or malformed.
3. Confirm `widget.js` and `widget.css` actually load (200 in Network).

### `POST /v1/chat` returns 503 `retrieval_unavailable`

`atw_postgres` is down or unhealthy:

```bash
docker ps | grep atw_postgres
docker logs atw_postgres
```

If the initial dump import failed, run `docker compose down -v && make demo` to
re-initialise with the committed `atw.sql`.

### `POST /v1/chat` returns 503 `model_unavailable`

`ANTHROPIC_API_KEY` is unset or invalid. Check `.env` and
`docker compose restart atw_backend`.

### The action does not change anything on the host

Open Network tab, click **Confirm** on the card:

- **No request fires** → the widget refused the action. Most likely the tool
  name is not in the allowlist — look for `ATW_TOOL_NOT_ALLOWED` in the console.
- Request goes to `localhost:3100` instead of your host → `data-api-base-url`
  is misconfigured.
- Request returns 401 → shopper is not logged in, or the cookie is blocked by
  SameSite (cookie mode only on same-site hosts unless CORS with
  `Allow-Credentials: true`).

### CORS error on the very first request

`ALLOWED_ORIGINS` does not contain the exact storefront origin. Check for
trailing slashes and port mismatches, then `docker compose restart atw_backend`.

### The widget says "I don't see that in the catalog" for everything

Retrieval is returning nothing above the similarity threshold (default 0.55).
Possible causes:

- The SQL dump did not import — check `.atw/state/build-manifest.json`
  `totals.enriched`.
- Query language does not match catalog language. The embedding model is
  multilingual but not magical.
- Lower the threshold temporarily:
  `export RETRIEVAL_SIMILARITY_THRESHOLD=0.40` on the backend and restart.

### Widget tests fail in jsdom mode

```text
SecurityError: localStorage is not available
```

Ensure `packages/widget/vitest.config.ts` has `environment: "jsdom"`. If you
edited it, re-run with `--clearScreen false` to see the full error.

### Widget build fails with "bundle budget exceeded"

You've crossed the 80 KB js / 10 KB css gzipped budget (SC-009). Options:

1. Inspect the new dependency — is it essential?
2. Run compile with `--minify=false` and look at the unminified size to
   diagnose which imports are heavy.
3. Last resort: raise the budget in
   `packages/scripts/src/compile-widget.ts`. This is a spec-level change and
   needs a PR justification — it pushes against SC-009.

### `make demo` fails on first run after T073 was committed

Check that `demo/atw-aurelia/atw.sql` was generated against the current seed.
If the product seed rotated since the dump was committed, the retrieval
similarity drops because embeddings are cached on the old text.
Regenerate per `demo/atw-aurelia/README.md` → Regenerating the `atw.sql` dump.

---

## 10. Quick reference

```bash
# Bootstrap the repo
npm install && npm run build && npm test

# Aurelia demo (after §5.1 bootstrap is committed)
cp .env.example .env && $EDITOR .env
make demo
open http://localhost:8000

# Free circuit test (Tier 1 — no enrichment, $0 Anthropic)
make fresh
claude
> /atw.init
> /atw.brief
> /atw.schema
> /atw.api
> /atw.plan
> /atw.build --no-enrich    # $0 Opus; retrieval empty but every wire is testable
> /atw.embed

# Cheap circuit test (Tier 2 — Haiku enrichment, ~$1.40 for 342 entities)
# Edit packages/scripts/src/orchestrator.ts:47 → DEFAULT_OPUS_MODEL = "claude-haiku-4-5-20251001"
# Then:
cd packages/scripts && npm run build && cd ../..
> /atw.build                # Haiku, ~10× cheaper than Opus

# Full setup-flow path (filmed, ~$14 Opus)
make fresh
claude
> /atw.init
> /atw.brief
> /atw.schema
> /atw.api
> /atw.plan
> /atw.build
> /atw.embed

# Start runtime standalone (Path A, after /atw.build)
docker run --rm -d --name atw_backend -p 3100:3100 --network host \
  -e DATABASE_URL=postgres://atw:atw_local@localhost:5433/atw \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  -e HOST_API_BASE_URL=http://localhost:9000 \
  atw_backend:latest
curl http://localhost:3100/health

# Install widget into a custom host
cp /path/to/my-agent/dist/widget.js /path/to/your-host/public/
cp /path/to/my-agent/dist/widget.css /path/to/your-host/public/

# Full test matrix (with Docker)
export ATW_E2E_DOCKER=1
make demo
npx vitest run
npx playwright test

# Nuke everything and start over
docker compose down -v
docker rmi atw_backend:latest
rm -rf .atw/state backend/src dist
```

---

## 11. Cross-references

- **Feature 001 — Setup flow** —
  [`specs/001-setup-flow/quickstart.md`](specs/001-setup-flow/quickstart.md),
  [`specs/001-setup-flow/spec.md`](specs/001-setup-flow/spec.md),
  [`specs/001-setup-flow/contracts/`](specs/001-setup-flow/contracts/).
- **Feature 002 — Build pipeline** —
  [`specs/002-build-pipeline/quickstart.md`](specs/002-build-pipeline/quickstart.md),
  [`specs/002-build-pipeline/spec.md`](specs/002-build-pipeline/spec.md),
  [`specs/002-build-pipeline/contracts/`](specs/002-build-pipeline/contracts/).
- **Feature 003 — Runtime** —
  [`specs/003-runtime/quickstart.md`](specs/003-runtime/quickstart.md),
  [`specs/003-runtime/spec.md`](specs/003-runtime/spec.md),
  [`specs/003-runtime/contracts/`](specs/003-runtime/contracts/).
  [`specs/003-runtime/post-impl-notes.md`](specs/003-runtime/post-impl-notes.md)
  lists every task — done and remaining — with exact resumption commands.
- **Constitution** —
  [`.specify/memory/constitution.md`](.specify/memory/constitution.md). The
  three red lines (I User Data Sovereignty, V Anchored Generation,
  VIII Reproducibility) are non-negotiable across all three features.
- **Root README** — [`README.md`](README.md).

---

**Report issues or improvements**: open a GitHub issue, or comment on the PR
that closes whichever Feature 003 task you're exercising.

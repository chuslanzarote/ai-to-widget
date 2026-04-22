# AI to Widget — Complete Testing Guide

This guide takes you from a **fresh clone** to a **working widget**. It covers
all three features (001 setup flow, 002 build pipeline, 003 runtime) and
offers three paths depending on how far you want to go.

> **Honest status (updated 2026-04-22).**
>
> - **Code**: 111 / 118 Feature 003 tasks shipped. 381 tests pass, 16 Docker-gated.
>   The widget bundle, the ATW backend service, the `/v1/chat` pipeline, the
>   `/atw.embed` slash command, the Fastify scaffold, the auth + CORS +
>   rate-limit plumbing, credential-strip hook, PII scrubber — **all of this works**.
> - **Canonical Aurelia Medusa demo (Path C)**: **not** plug-and-play yet. The
>   Dockerfiles under `demo/medusa/backend/` and `demo/medusa/storefront/`
>   clone the wrong thing — they clone the Medusa **monorepo source**, which
>   is not a runnable Medusa app. Getting the Aurelia demo running requires
>   real scaffolding work (§6.1) that wasn't completed. Plan on **3–5 hours**
>   of hands-on work the first time.
> - **What you can test today with zero setup beyond `make fresh` + widget
>   bundle**: widget loads in a plain HTML host, panel opens, chat round-trips
>   to the ATW backend, confirmation cards render, DevTools shows zero
>   shopper credentials reaching the backend. This is **Path B (§5)** and
>   works today.
>
> If your goal is "see the widget work end-to-end", follow Path B. If your
> goal is the full-fidelity Aurelia coffee-store demo on `localhost:8000`,
> Path C lists the remaining bootstrap work honestly.

---

## 1. Prerequisites

On your machine:

| Tool | Minimum version | Check with | Notes |
|------|-----------------|------------|-------|
| Node.js | 20 LTS | `node --version` | Repo pins via `.nvmrc` |
| npm | 10+ | `npm --version` | Ships with Node 20 |
| Git | recent | `git --version` | For cloning |
| Docker | 24+ | `docker --version` | Desktop (Mac/Win) or Engine (Linux/WSL2) |
| Claude Code | current | `claude --version` | Authenticated at https://claude.com/claude-code |
| Anthropic API key | — | — | With access to `claude-opus-4-7` |
| Postgres (your client's DB, Path A only) | 12+ | — | **Not needed** for Paths B or C |
| Python 3 (optional) | 3.8+ | `python --version` | Tiny static HTTP server for Path B |

Export the key in the shell that will launch Claude Code:

```bash
# Linux / macOS / Git Bash
export ANTHROPIC_API_KEY=sk-ant-...
```

```cmd
:: Windows cmd
set ANTHROPIC_API_KEY=sk-ant-...
```

```powershell
# Windows PowerShell
$env:ANTHROPIC_API_KEY="sk-ant-..."
```

**Budget estimate.** See §4 (enrichment modes) before you commit to spending.
Path B can cost $0. Path A scales with your catalog. Path C's final Aurelia
bootstrap costs ~$14 in Opus calls, but you only pay it once if the Medusa
scaffold is working — which it isn't yet without §6 below.

---

## 2. Clone and bootstrap the repository

```bash
git clone https://github.com/<owner>/ai-to-widget.git
cd ai-to-widget
npm install        # ~750 packages, ~30 s
npm run build      # compiles packages/scripts/dist and packages/installer/dist
```

Sanity check:

```bash
npm test
```

Expected: **381 passing, 16 skipped, 0 failing**. The 16 skipped need
`ATW_E2E_DOCKER=1` + a running Docker stack.

---

## 3. Choose your path

| Path | Goal | Cost | Time first-time | State |
|------|------|------|----------------:|-------|
| **A** | Integrate widget into **your own** host app (Shopify, Django, Rails, custom) | f(catalog size). ~$1 at 20 entities | ~30 min + /atw.build time | Works today |
| **B** | See the widget work end-to-end against a **plain HTML host** | $0 | ~15 min | Works today |
| **C** | The canonical **Aurelia Medusa** coffee-store showcase | ~$14 one-time | 3–5 h first time | Bootstrap incomplete (§6) |

- **Want to see the widget working fast**: Path B.
- **Want to embed in your real app**: Path A.
- **Want the full filmed-demo experience**: Path C (be prepared for the
  bootstrap work).

You can do them in any order. Path B is the lowest commitment and proves
every piece of the stack works.

---

## 4. Enrichment modes — test the circuit without spending money

Most of the "$14 Aurelia" budget — and all the per-entity cost in Path A —
comes from **one** phase inside `/atw.build`: enrichment. One Opus 4.7 call
per indexable entity to produce the grounded document + cited facts +
semantic categories that power retrieval and citations.

You can test the circuit **without paying** first.

| Tier | Cost | What you lose | Use when |
|------|------|---------------|----------|
| **1 — `--no-enrich`** | **$0** | Retrieval returns nothing; agent replies "catalog does not cover that topic". Still proves the widget↔backend wiring, auth invariants, action-confirmation gate. | Smoke-testing the whole system |
| **2 — Haiku 4.5** | ~$1.40 for 342 entities | Slightly looser anchoring; more validator retries | Small catalogs, dev iterations |
| **3 — Opus + small seed** | ~$1 for 30 entities | Catalog breadth on screen | Real quality at small scale |

### Tier 1 — `--no-enrich` ($0)

```text
> /atw.build --no-enrich
```

Everything runs except Opus enrichment calls. `atw_documents` stays empty;
the agent falls back to *"I don't have that in the catalog"* for every
question. The crucial thing that **still works**: widget bundle, launcher,
panel, markdown rendering, action-confirmation gate, auth-mode separation,
credential-strip at the backend, DevTools invariants.

### Tier 2 — Haiku 4.5

Edit one constant:

```ts
// packages/scripts/src/orchestrator.ts:47
- const DEFAULT_OPUS_MODEL = "claude-opus-4-7";
+ const DEFAULT_OPUS_MODEL = "claude-haiku-4-5-20251001";
```

Then `cd packages/scripts && npm run build && cd ../..` and re-run
`/atw.build`. ~10× cheaper per call; expect slightly lower anchoring
quality.

### Tier 3 — Opus + reduced seed

In `demo/medusa/seed/generate-products.mjs`, scale the loops:

```js
// From
for (let i = 0; i < 160; i++) { /* single-origins */ }
for (let i = 0; i <  40; i++) { /* blends */ }
for (let i = 0; i <  10; i++) { /* decaf */ }
for (let i = 0; i <  90; i++) { /* gear */ }

// To (30 entities total)
for (let i = 0; i <  15; i++) { /* single-origins */ }
for (let i = 0; i <   5; i++) { /* blends */ }
for (let i = 0; i <   0; i++) { /* decaf */ }
for (let i = 0; i <  10; i++) { /* gear */ }
```

Regenerate: `node demo/medusa/seed/generate-products.mjs > demo/medusa/seed/products.json`.

### Subscription vs API billing (one-liner)

The Anthropic Pro / Max subscription does **not** pay for API calls.
`/atw.build` uses `ANTHROPIC_API_KEY` against the API billing rail, which is
separate from your subscription. Tier 1 is the only true $0 path.

---

## 5. Path B — Widget working against a plain HTML host ($0, 15 min)

This is the shortest path to "I see the widget, the panel opens, I can chat
with the agent, everything wires up correctly". No Medusa. No host app.
Just enough to verify the runtime is sound.

### 5.1 Start the ATW Postgres

```powershell
# Windows PowerShell (adjust for your shell):
.\scripts\make.ps1 stage-widget   # writes placeholder widget.{js,css}
docker compose up atw_postgres -d --wait
```

Or directly without the script:

```bash
docker compose up atw_postgres -d --wait
```

Wait for `docker ps | grep atw_postgres` to show "healthy".

### 5.2 Build `atw_backend:latest` with `--no-enrich`

Use the pre-built Aurelia `.atw/` artefacts so you skip Feature 001 commands:

```bash
cd demo/atw-aurelia
claude
```

Inside Claude Code:

```text
> /atw.build --no-enrich
```

This runs ~3 minutes, makes **zero Opus calls**, and produces:

- `atw_backend:latest` in `docker images`.
- `dist/widget.js` and `dist/widget.css` under the repo root.
- `.atw/state/build-manifest.json` with `result: "success"`.
- `atw_documents` exists but is empty.

Important: the SQL dump input at `.atw/inputs/*.sql` can be **any valid SQL
file** — `--no-enrich` doesn't care about the content since no enrichment
runs. If you want to skip the dump question entirely, create an empty one:

```bash
mkdir -p .atw/inputs
echo "-- placeholder dump for --no-enrich smoke test" > .atw/inputs/placeholder.sql
```

### 5.3 Start the ATW backend

Back at the repo root:

```bash
cd ../..
cp .env.example .env
# Edit .env and set ANTHROPIC_API_KEY (any non-empty string works with --no-enrich)
docker compose up atw_backend -d --wait
```

Verify:

```bash
curl http://localhost:3100/health
# {"status":"ok"}
```

### 5.4 Create a minimum-viable host page

```bash
mkdir test-host
cd test-host
cp ../dist/widget.js  widget.js
cp ../dist/widget.css widget.css
```

Create `test-host/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Widget test host</title>
  <link rel="stylesheet" href="widget.css">
</head>
<body style="font-family: system-ui; padding: 32px;">
  <h1>Widget test host</h1>
  <p>Click the launcher in the bottom-right to open the chat panel.</p>

  <script
    src="widget.js"
    defer
    data-backend-url="http://localhost:3100"
    data-api-base-url="http://localhost:3000"
    data-auth-mode="cookie"
    data-launcher-position="bottom-right"
    data-locale="en-US"></script>
</body>
</html>
```

Serve it with any static server. Python is ubiquitous:

```bash
python -m http.server 3000
```

Or Node:

```bash
npx http-server -p 3000
```

### 5.5 Configure CORS (one-shot)

The ATW backend needs to allow your host's origin. Edit `.env`:

```env
ALLOWED_ORIGINS=http://localhost:3000
```

Restart the backend:

```bash
docker compose restart atw_backend
```

### 5.6 Open the browser and verify the invariants

Open `http://localhost:3000` in any modern browser.

**What you should see:**

1. The page loads with "Widget test host" at the top.
2. A circular launcher appears in the bottom-right corner.
3. Clicking the launcher slides in a chat panel.
4. Typing a message and pressing Enter sends it to the backend.
5. The agent responds (after ~2–4 s) with *"I don't have that in the
   catalog — could you rephrase?"*. This is the correct behaviour for
   `--no-enrich`: no fabrication, honest "not found".

**Invariants to check in DevTools → Network:**

- Requests to `http://localhost:3100` (ATW backend) have:
  - `X-Atw-Session-Id` header present.
  - **No** `Cookie` header. **No** `Authorization` header.
  - `credentials` is NOT "include" (visible in the Network row).
- The request body is JSON with `message`, `history`, `context`.
- The response has the structure `{ message, citations: [], actions: [],
  request_id }`.

If all six boxes tick, **the runtime is verified**. Everything from here on
is enrichment quality and host integration — the hard engineering is done.

### 5.7 Optional: upgrade to real enrichment

Once you've proven the circuit, if you want real grounded answers:

```bash
cd demo/atw-aurelia
claude
```

Then either:

- Tier 2 (Haiku, ~$1.40) — edit `orchestrator.ts` as per §4, rebuild, run
  `/atw.build` without `--no-enrich`.
- Tier 3 (Opus + small seed, ~$1) — reduce `generate-products.mjs` loops
  as per §4, regenerate `products.json`, run `/atw.build` without
  `--no-enrich`.

But this requires a real SQL dump that reflects a real catalog. For Path B
there isn't one — so real enrichment at this stage means switching to
Path A (your own catalog) or completing Path C (Aurelia bootstrap).

---

## 6. Path C — Canonical Aurelia Medusa demo (incomplete bootstrap)

**Honest framing.** This path aims for the filmed-demo experience: a coffee
storefront at `http://localhost:8000` with the widget citing real products.
It is the most ambitious path **and it is not plug-and-play yet**. The
scaffolding I shipped does three things wrong and needs real work to land:

1. The `demo/medusa/backend/Dockerfile` clones `medusajs/medusa` (the
   monorepo of Medusa library **source code**), which is not a runnable
   Medusa app.
2. The `demo/medusa/storefront/Dockerfile` clones
   `medusajs/nextjs-starter-medusa`, which is closer to a runnable app but
   wasn't verified end-to-end.
3. `demo/medusa/seed/seed.mjs` assumes a table schema that matches the
   names I guessed at — Medusa v2's real schema will likely differ
   slightly (column names, ID prefixes) and the seeder will need adaptation.

Budget for first-time completion: **3–5 hours** of hands-on work. Skip
this path if your goal is anything other than the exact filmed-demo
experience; Paths A and B deliver the same functional verification.

### 6.1 Phase 1 — Generate the Medusa backend

Outside the `ai-to-widget` repo, in a scratch directory:

```bash
cd /tmp
npx create-medusa-app@latest aurelia-backend --no-browser
```

Answer the CLI prompts. Important choices:

- **Project name**: `aurelia-backend` (already passed as arg).
- **Database**: skip (the Docker compose will provide Postgres).
  If the CLI insists, point it at a throwaway local Postgres and trash it
  after — the seed will populate fresh.
- **Sample data**: say **no**. We ship our own seed from
  `demo/medusa/seed/`.
- **Storefront**: say **no**. We'll generate it separately in Phase 2.

This scaffolds a real Medusa v2 app with `package.json`, `medusa-config.js`,
migrations, and the required directory structure.

Copy it into the repo:

```bash
rm -rf /path/to/ai-to-widget/demo/medusa/backend-generated
cp -R /tmp/aurelia-backend /path/to/ai-to-widget/demo/medusa/backend-generated
cd /path/to/ai-to-widget
```

Verify that `demo/medusa/backend-generated/package.json` exists and lists
`@medusajs/medusa` as a dependency. That confirms this is a runnable app
(not monorepo source).

### 6.2 Phase 2 — Generate the Medusa storefront

```bash
cd /tmp
npx create-medusa-app@latest aurelia-storefront --with-nextjs-starter --no-browser
```

(Or grab the starter directly via git clone — check
https://docs.medusajs.com/resources/nextjs-starter for the current official
path.)

Copy it into the repo:

```bash
rm -rf /path/to/ai-to-widget/demo/medusa/storefront-generated
cp -R /tmp/aurelia-storefront /path/to/ai-to-widget/demo/medusa/storefront-generated
```

Overlay the Aurelia layout (widget `<script>` tag + theming) on top of the
generated `app/layout.tsx`:

```bash
cp demo/medusa/storefront/app/layout.tsx demo/medusa/storefront-generated/src/app/layout.tsx
# (path may vary depending on Medusa starter version — place it over the
# actual root layout file)
```

### 6.3 Phase 3 — Adapt the seed to the real schema

Bring up only the Medusa Postgres + Redis and the Medusa backend (without
the seed marker), run its migrations, inspect the tables it created, and
update `demo/medusa/seed/seed.mjs` to match.

```bash
docker compose up medusa_postgres medusa_redis -d --wait
cd demo/medusa/backend-generated
npm install
npx medusa db:migrate
# Inspect what it created:
docker exec -it ai-to-widget-medusa_postgres-1 psql -U medusa -d medusa -c "\dt"
```

Compare the table names to what `demo/medusa/seed/seed.mjs` expects:

- `product`, `product_variant`, `product_category`,
  `product_collection`, `region`, `customer`, `order`, `order_line_item`.

Real Medusa v2 names may be plural (`products`) or use different foreign
key column names. Edit `seed.mjs` accordingly. **This is the most tedious
part**, and impossible for me to pre-write accurately without the running
app in front of me.

When the seed runs end-to-end without errors against a freshly-migrated
Medusa, you have passed the hardest bootstrap step.

### 6.4 Phase 4 — Rewrite the Dockerfiles to COPY the generated apps

Replace the `git clone` approach with `COPY`:

`demo/medusa/backend/Dockerfile`:

```dockerfile
# syntax=docker/dockerfile:1.6
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Copy the committed Medusa app (generated by create-medusa-app in Phase 1).
COPY backend-generated/ /app/

RUN corepack enable && yarn install --production=false && yarn build

# Bring in the seed data + seeder.
COPY seed /app/seed
COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
COPY --from=builder /app /app
ENV NODE_ENV=production
EXPOSE 9000
ENTRYPOINT ["/app/entrypoint.sh"]
```

`demo/medusa/storefront/Dockerfile`: same pattern — `COPY
storefront-generated/` replaces the `git clone`.

Build context stays at `./demo/medusa` for both (so sibling directories
`backend-generated/`, `storefront-generated/`, `seed/`, `backend/`,
`storefront/` are all reachable).

### 6.5 Phase 5 — Pin image digests

```bash
docker pull postgres:16-alpine
docker pull redis:7-alpine
docker pull pgvector/pgvector:pg16

docker inspect --format='{{index .RepoDigests 0}}' postgres:16-alpine
docker inspect --format='{{index .RepoDigests 0}}' redis:7-alpine
docker inspect --format='{{index .RepoDigests 0}}' pgvector/pgvector:pg16
```

Paste each `@sha256:…` into `docker-compose.yml`, replacing the three
`# TODO(compose-digest): pin @sha256:<digest>` markers.

### 6.6 Phase 6 — Run `/atw.build` and export the ATW dump

With Medusa seeded and healthy:

```bash
cd demo/atw-aurelia
claude
> /atw.build         # ~15 min, ~$14 in Opus calls
```

Export the populated `atw_documents` as the committed initial state:

```bash
pg_dump --no-owner --no-privileges \
  --data-only --table=atw_documents --table=atw_migrations \
  -U atw -h 127.0.0.1 -p 5433 atw > demo/atw-aurelia/atw.sql
```

Expected size: 2–3 MB.

### 6.7 Phase 7 — Commit everything

```bash
git add demo/medusa/backend-generated demo/medusa/storefront-generated
git add demo/medusa/seed/seed.mjs          # updated to real schema
git add demo/medusa/backend/Dockerfile demo/medusa/storefront/Dockerfile
git add docker-compose.yml                 # pinned digests
git add demo/atw-aurelia/atw.sql
git commit -m "US4 bootstrap: Medusa v2 scaffolded apps, real schema seed, pinned digests, ATW dump"
```

The committed scaffold will be thousands of files — that is the honest cost
of Principle VIII for a stack that depends on generated code.

### 6.8 After bootstrap — the reviewer path

Once Phase 7 is committed, anyone cloning the repo runs:

```bash
git clone https://github.com/<owner>/ai-to-widget.git
cd ai-to-widget
cp .env.example .env && $EDITOR .env    # set ANTHROPIC_API_KEY
make demo                                # ~2–3 min on warm Docker
open http://localhost:8000
```

No Claude Code, no `/atw.*` commands, no Opus calls. The committed
`atw.sql` dump replays offline.

### 6.9 Scripted 5-turn demo conversation

When the full stack is up and the committed `atw.sql` has been built with
**real** enrichment (not `--no-enrich`), the five-turn conversation
`tests/e2e/aurelia-demo.spec.ts` runs:

1. **Flavour profile** in Spanish: "Estoy buscando un café chocolatoso
   para filtro en V60, sin demasiada acidez."
2. **Comparison**: "Compáramelo con el Ethiopia Yirgacheffe — ¿cuál para
   V60?"
3. **Add to cart**: "Añade 2 Colombia Huila 250 g a mi carrito." →
   confirmation card renders, the Medusa cart does not change yet.
4. **Confirm**: click the card's primary button → `POST
   /store/carts/{cart_id}/line-items` fires against Medusa with the
   shopper's cookie; cart icon updates within 2 s.
5. **Anonymous check** (incognito tab): "What did I order last time?" →
   friendly "please log in first" reply with a link to `/account`.

Invariants verified concurrently in DevTools:

- Only two outbound origins: `localhost:3100` (ATW backend) and
  `localhost:9000` (Medusa).
- Zero `Cookie` / `Authorization` on requests to `localhost:3100`.

### 6.10 Demo customer credentials (after Phase 3 seed works)

Three synthetic customers under `demo/medusa/seed/customers.json`:

| Email | Password |
|-------|----------|
| `alice.demo@aurelia-coffee.local` | `aurelia-demo-1` |
| `bob.demo@aurelia-coffee.local` | `aurelia-demo-2` |
| `carmen.demo@aurelia-coffee.local` | `aurelia-demo-3` |

These passwords currently exist in the JSON but **do not yet work against a
Medusa login** because the seed hasn't been run against a real Medusa
schema. Phase 3 is what makes them actually log you in.

---

## 7. Path A — Embed the widget into your own host app

This is the production-shaped path: you have a real app with a real
database and a real API, and you want to ship the widget on it.

### 7.1 Scaffold an agent project

Outside the `ai-to-widget` repo:

```bash
mkdir my-agent
cd my-agent
npx --yes create-atw@latest .
```

For development from a local clone:

```bash
cd /path/to/clone/ai-to-widget
npm run dev:install -- /path/to/my-agent
```

Resulting layout:

```text
my-agent/
├── .atw/
│   ├── config/       # will hold project.md + brief.md
│   ├── artifacts/    # schema-map.md + action-manifest.md + build-plan.md
│   ├── inputs/       # drop your SQL dump here (git-ignored)
│   └── state/
├── .claude/commands/
│   ├── atw.init.md
│   ├── atw.brief.md
│   ├── atw.schema.md
│   ├── atw.api.md
│   ├── atw.plan.md
│   ├── atw.build.md
│   └── atw.embed.md
├── docker-compose.yml
└── README-atw.md
```

### 7.2 Export your client's inputs

AI to Widget **never** connects to your client's production database
(Principle I, red-line). You export two artefacts manually, once:

```bash
# Schema — mandatory
pg_dump --schema-only --no-owner --no-privileges \
  -U <user> -h <host> <db> > schema.sql

# Sample data — recommended (≤50 rows per table)
pg_dump --data-only --inserts --no-owner --no-privileges \
  --rows-per-insert=50 \
  -U <user> -h <host> <db> > sample-data.sql

cat schema.sql sample-data.sql > my-client.sql
cp my-client.sql my-agent/.atw/inputs/
```

Plus your OpenAPI spec (file, URL, or paste when `/atw.api` asks).

### 7.3 Run the five Feature 001 slash commands

```bash
cd my-agent && claude
```

Inside Claude Code:

```text
> /atw.init     # name, languages, deployment type → project.md (~1 min)
> /atw.brief    # guided interview → brief.md (10–15 min)
> /atw.schema   # classifies tables, excludes PII → schema-map.md
> /atw.api      # classifies endpoints → action-manifest.md
> /atw.plan     # cost estimate + summary → build-plan.md
```

> **Hard rule**: `/atw.schema` refuses DSNs (`postgres://user:pass@…`). No
> credentials path.

### 7.4 Run `/atw.build`

```text
> /atw.build      # or /atw.build --no-enrich for $0
```

Pipeline: boot Postgres → migrate → import dump (PII filtered) → enrich
per entity (Opus single call) → render backend → bundle widget → build
Docker image → PII scan → manifest.

Typical wall-clocks (4-core / 16 GB runner):

| Size | Entities | Time | Cost |
|------|----------|------|------|
| Mini | ~20 | 3 min | <$1 |
| Medium | ~1 000 | 30–45 min | ~$40 |

Outputs: `atw_backend:latest`, `dist/widget.{js,css}`, `.atw/state/build-manifest.json`.

### 7.5 Run `/atw.embed`

```text
> /atw.embed
```

Claude asks:

| Question | Options |
|----------|---------|
| Host framework | `next-app-router`, `next-pages-router`, `plain-html`, `custom` |
| ATW backend URL | e.g. `http://localhost:3100` |
| Host auth mode | `cookie` (default), `bearer`, `custom` |
| (bearer only) localStorage token key | e.g. `my_app_token` |
| Host API base URL | default: `window.location.origin` |
| (optional) Login URL | for the anonymous-fallback link |
| (optional) Theme primary / radius / font | widget CSS tokens |

Writes `.atw/artifacts/embed-guide.md` — a copy-paste guide tailored to
your framework with the exact `<script>` snippet, CORS config, theming
example, and troubleshooting checklist.

### 7.6 Install the widget in your host

Copy `dist/widget.js` and `dist/widget.css` into your host's static folder
and paste the snippet from `embed-guide.md` into your root layout.

Configure CORS:

```bash
# On the ATW backend:
export ALLOWED_ORIGINS=http://localhost:3000,https://your-host.example.com
```

On your host API, respond to cross-origin requests with:

- `Access-Control-Allow-Origin: <storefront origin>`
- `Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Allow-Credentials: true` (cookie mode only)

### 7.7 Start the runtime and verify

```bash
docker run --rm -d \
  --name atw_backend \
  -p 3100:3100 \
  --network host \
  -e DATABASE_URL=postgres://atw:atw_local@localhost:5433/atw \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e ALLOWED_ORIGINS=http://localhost:3000 \
  -e HOST_API_BASE_URL=http://localhost:9000 \
  atw_backend:latest

curl http://localhost:3100/health
# {"status":"ok"}
```

Open your host on `http://localhost:3000`. Launcher in the corner, click,
ask a question, get a grounded reply citing products from **your** catalog.

### 7.8 Try an action with confirmation

"Add 2 of <product> to my cart." Confirmation card appears. Click
**Confirm** → `POST /your-host-api/...` with the shopper's own cookie →
host updates → agent narrates success.

DevTools invariant: zero shopper credentials ever hit `localhost:3100`.

---

## 8. Running the tests

### 8.1 Unit + contract — fast, no Docker

```bash
npx vitest run
```

**381 passing, 16 skipped, 0 failing.** Covers zod shapes, error codes,
config loading, credential-strip predicate, logger redaction paths, PII
scrubber, widget auth builder, markdown sanitiser, api-client, action-card
tool allowlist, state FIFO, Preact panel, `/atw.embed` generator.

### 8.2 Integration — Docker-gated

```bash
export ATW_E2E_DOCKER=1
# Stack must be up via Path B or Path C
npx vitest run tests/integration/
```

Unlocks 13 tests (grounded reply, action confirmation, multi-turn,
comparison, credential sovereignty, auth modes, anonymous fallback,
rate-limit, bundle size).

### 8.3 E2E — full stack + Playwright (Path C only)

```bash
npx playwright install chromium firefox webkit
export ATW_E2E_DOCKER=1
npx playwright test
```

- `aurelia-demo.spec.ts` — the scripted 5-turn conversation.
- `accessibility.spec.ts` — axe-core on the open panel.
- `runtime-theming.spec.ts` — CSS custom property override.
- `runtime-tool-allowlist.spec.ts` — forged tool names refused.

---

## 9. Verifying Principle I in DevTools

The widget **never** sends shopper credentials to the ATW backend.

1. Open DevTools.
2. Network tab → filter `localhost:3100`.
3. Send a chat message.
4. Click a captured request → Headers.
5. Verify **no** `Cookie`, **no** `Authorization`, no
   `X-*-Token|Auth|Session` (other than `X-Atw-Session-Id`, which is a
   widget-issued rate-limit UUID).

If any show up, it's a bug — the backend strips them defensively in
`onRequest`, but the widget should never attach them to backend-bound
requests in the first place (see `packages/widget/src/auth.ts`
`buildBackendHeaders`).

---

## 10. What still requires a human

Seven tasks in `specs/003-runtime/tasks.md` remain `[ ]`:

| Task | What it is | Blocks |
|------|------------|--------|
| **Path C bootstrap** (Phase 1–4 above) | Generate Medusa apps with `create-medusa-app`, adapt seed, rewrite Dockerfiles | Path C entirely |
| T073 | Run `/atw.build` against seeded Medusa → `atw.sql` | Path C reviewer path (§6.8) |
| T074 | Pin the three compose image digests | Principle VIII reproducibility on Path C |
| T075 | Verify `atw.sql` init-script mount works on fresh `make demo` | Path C reviewer warmth |
| T115 | Cross-platform verification of the quickstart on macOS / Linux / WSL2 | Demo confidence |
| T116 | Full suite with `ATW_E2E_DOCKER=1` green | CI readiness |
| T117 | Commit `atw.sql` with regeneration notes | Path C reviewer path |
| T118 | Record the 3-minute demo video | Hackathon submission |

**What does NOT require a human and already works:**

- All 381 unit + contract tests.
- Widget bundle compiles under budget (80 KB js / 10 KB css gzipped).
- `/atw.build --no-enrich` produces `atw_backend:latest` and widget bundle.
- ATW backend runs on Docker, `/health` responds, `/v1/chat` handles
  requests end-to-end.
- `/atw.embed` generates deterministic integration guides for four
  frameworks.

Path B proves every one of these in ~15 minutes. **Start there.**

---

## 11. Troubleshooting

### The launcher does not appear

1. Browser console → look for `[atw]` error.
2. Most common: `data-backend-url` missing or malformed.
3. Confirm `widget.js`/`widget.css` load (200 in Network).

### `POST /v1/chat` → 503 `retrieval_unavailable`

`atw_postgres` is down/unhealthy. `docker ps` + `docker logs atw_postgres`.
If initial dump import failed: `docker compose down -v && docker compose up atw_postgres -d --wait`.

### `POST /v1/chat` → 503 `model_unavailable`

`ANTHROPIC_API_KEY` unset or invalid. Edit `.env`, `docker compose
restart atw_backend`.

### Action doesn't change anything on the host

Network tab after clicking Confirm:

- No request → widget refused (unknown tool name; see
  `ATW_TOOL_NOT_ALLOWED` in console).
- Wrong origin → `data-api-base-url` misconfigured.
- 401 → shopper not logged in / SameSite blocked cookie.

### CORS error on the first request

`ALLOWED_ORIGINS` doesn't include the exact storefront origin (trailing
slash / port matters). Edit `.env`, restart.

### Widget says "I don't have that in the catalog" for everything

- `--no-enrich` was used → this is correct behaviour.
- Dump didn't import → check `.atw/state/build-manifest.json`
  `totals.enriched`.
- Query language vs catalog language mismatch. Try the same language as
  the indexed text.
- Lower threshold: `export RETRIEVAL_SIMILARITY_THRESHOLD=0.40` and
  restart.

### Widget tests fail in jsdom

`SecurityError: localStorage is not available` → verify
`packages/widget/vitest.config.ts` has `environment: "jsdom"`.

### Widget build fails "bundle budget exceeded"

Crossed 80 KB js / 10 KB css gzipped (SC-009). Inspect new deps;
`--minify=false` helps diagnose. Last resort: raise budget in
`packages/scripts/src/compile-widget.ts` (spec-level change, justify in
PR).

### `make demo` → "pull access denied for atw_backend"

You skipped building the backend image locally. Run Path B §5.2 first:
`cd demo/atw-aurelia; claude; > /atw.build --no-enrich`. The image is
never published to Docker Hub.

### `make demo` → medusa_backend build fails on `git clone`

This is the Path C bootstrap being incomplete (§6). Follow §6.1–6.4 or
fall back to Path B.

### `make fresh` hangs on `docker compose down -v`

Your `make` is ancient (UnxUtils). Use `.\scripts\make.ps1 fresh` on
Windows, or install Git Bash which ships a modern make.

---

## 12. Quick reference

```bash
# Bootstrap the repo
npm install && npm run build && npm test

# Path B — free circuit test (widget on a plain HTML host)
cd demo/atw-aurelia && claude
> /atw.build --no-enrich
# Then from repo root:
docker compose up atw_postgres atw_backend -d --wait
# And serve a minimal host (see §5.4) on localhost:3000

# Path A — widget in your own host app
cd /path/to/my-agent && claude
> /atw.init
> /atw.brief
> /atw.schema
> /atw.api
> /atw.plan
> /atw.build           # or --no-enrich for $0
> /atw.embed

# Path C — Aurelia Medusa bootstrap (after §6.1–6.4 Phase work)
cp .env.example .env && $EDITOR .env
make demo
open http://localhost:8000

# Nuke and restart
docker compose down -v
docker rmi atw_backend:latest
rm -rf .atw/state backend/src dist
```

---

## 13. Cross-references

- **Feature 001 — Setup flow** —
  [`specs/001-setup-flow/quickstart.md`](specs/001-setup-flow/quickstart.md),
  [`spec.md`](specs/001-setup-flow/spec.md),
  [`contracts/`](specs/001-setup-flow/contracts/).
- **Feature 002 — Build pipeline** —
  [`specs/002-build-pipeline/quickstart.md`](specs/002-build-pipeline/quickstart.md),
  [`spec.md`](specs/002-build-pipeline/spec.md),
  [`contracts/`](specs/002-build-pipeline/contracts/).
- **Feature 003 — Runtime** —
  [`specs/003-runtime/quickstart.md`](specs/003-runtime/quickstart.md),
  [`spec.md`](specs/003-runtime/spec.md),
  [`contracts/`](specs/003-runtime/contracts/).
  [`post-impl-notes.md`](specs/003-runtime/post-impl-notes.md) lists
  every task — done and remaining — with exact resumption commands.
- **Constitution** —
  [`.specify/memory/constitution.md`](.specify/memory/constitution.md).
  Three red lines are non-negotiable across all features: I (User Data
  Sovereignty), V (Anchored Generation), VIII (Reproducibility).
- **Root README** — [`README.md`](README.md).

---

**Report issues or improvements**: open a GitHub issue, or comment on the
PR that closes whichever task you're exercising.

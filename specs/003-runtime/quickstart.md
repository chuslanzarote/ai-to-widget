# Quickstart: Runtime (Feature 003)

**Feature**: Runtime
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-22

This document is the binding reproducibility path for Feature 003.
Reviewers, hackathon judges, and returning contributors use it to
bring the full Aurelia demo up from a fresh clone. It is also the
integration test's golden script: `tests/e2e/aurelia-demo.spec.ts`
follows the same steps and asserts the same invariants.

The doc has two paths:

- **Reviewer path (the default)** — run the pre-built demo with zero
  hand-authored artefacts. Target: first grounded reply in under 3
  minutes.
- **Fresh path** — clear the pre-built artefacts and run Features
  001/002 from scratch before touching the runtime. Target: the
  demo video's compressed-setup portion (~1 minute on camera) films
  this.

---

## 1. Prerequisites

On the reviewer's machine:

- Docker Engine ≥ 24 or Docker Desktop ≥ 4.24 with Compose v2.
- 8 GB RAM free (Medusa + ATW + Postgres + Redis).
- A small open port range: 3100 (ATW backend), 5432, 5433 (two
  Postgres instances), 6379 (Redis), 8000 (storefront), 9000 (Medusa
  backend).
- An Anthropic API key with model access for `claude-opus-4-7`.
- `git`, `make`, and a shell.

No Node install, no `npm install` — the runtime ships as Docker
images.

---

## 2. Reviewer path (`make demo`)

### 2.1 Clone the repository

```sh
git clone https://github.com/<owner>/ai-to-widget.git
cd ai-to-widget
```

### 2.2 Configure the environment

```sh
cp .env.example .env
$EDITOR .env
# Paste your ANTHROPIC_API_KEY into the single required field.
```

### 2.3 Bring the stack up

```sh
make demo
```

This runs:

1. `docker compose pull` — honours pinned digests.
2. `docker compose up -d --wait` — starts all six services and waits
   for healthchecks to pass.

Expected timing on reference hardware (8-core, 16 GB, SSD):

- Cold run (empty volumes): 2 min 30 s ± 30 s.
- Warm run (volumes intact): 20–40 s.

If `docker compose up --wait` fails, inspect with `docker compose logs
<service>` — the typical cause is a port collision.

### 2.4 Open the storefront

Open `http://localhost:8000` in a browser.

Expected:

- The Aurelia-branded storefront loads with the product catalog.
- A chat launcher appears in the bottom-right corner.

### 2.5 Send the first message

Click the launcher. In the input, type:

> Estoy buscando un café chocolatoso, con algo de fruta roja pero sin
> ser demasiado ácido. Para filtro, en V60.

Send with Enter.

Expected within 4 s:

- A typing indicator appears.
- An assistant reply mentions two or three real products from the
  seeded catalog with the actual tasting notes.
- Each named product in the reply is rendered as a link — clicking
  navigates to the real product page on the storefront.

**Invariant** (SC-001): the reply references only products present in
the seed. There are no fabricated products.

### 2.6 Ask for a comparison

> Colombia Huila vs Ethiopia Guji — which for V60?

Expected:

- The reply names both products and cites distinguishing facts
  (origin, flavour notes, process) drawn from the seed.

### 2.7 Add an item to the cart

> Add 2 bags of the Colombia Huila, 250g, to my cart.

Expected:

- A confirmation card appears inline with product name, quantity,
  unit price, and total.
- The storefront's cart-icon count is still zero.
- Click "Add to cart".
- Within 2 s: cart-icon count updates to 2, the agent replies with a
  short success line, and the card transitions to a "succeeded"
  state.

**Invariant** (SC-002): no state-changing HTTP request is made
against Medusa until the primary button click.

### 2.8 Verify credential sovereignty

Open the browser's network tab. Send another chat message.

Expected:

- Only two outbound origins appear: `http://localhost:3100` (ATW
  backend) and `http://localhost:9000` (Medusa backend).
- Requests to `localhost:3100` carry neither `Cookie` nor
  `Authorization`.
- Requests to `localhost:9000` carry Medusa's session cookie
  automatically.

**Invariant** (SC-006, SC-011): no third-party origin appears; no
credential ever reaches the ATW backend.

### 2.9 Tear down (optional)

```sh
docker compose down        # keeps volumes
docker compose down -v     # wipes volumes (slower next start)
```

---

## 3. Fresh path (`make fresh`)

For filming the compressed setup flow or for validating the full
Feature 001 → 002 → 003 chain from zero.

### 3.1 Clear the pre-built artefacts

```sh
make fresh
```

This runs:

1. `docker compose down -v` — wipes all volumes.
2. `rm -rf demo/atw-aurelia/.atw/` — removes pre-generated
   Feature 001/002 artefacts.
3. `docker compose up medusa_postgres medusa_redis medusa_backend
   medusa_storefront -d --wait` — brings the Medusa side up only.

After this command, the Aurelia storefront is running with the full
seeded catalog, but no ATW runtime exists.

### 3.2 Run the Feature 001 flow

Inside the project root, using Claude Code:

```text
> /atw.init
> /atw.brief
> /atw.schema   # accepts the Medusa schema dump from demo/medusa/seed/schema.sql
> /atw.api      # accepts the Medusa OpenAPI spec from demo/medusa/seed/openapi.json
> /atw.plan
```

Each command confirms its output with the Builder before writing; no
hidden state is introduced. Resulting artefacts land under
`demo/atw-aurelia/.atw/`.

Expected total wall-clock: 6–10 minutes (Features 001 commands are
conversational; the actual Opus usage is modest).

### 3.3 Run the Feature 002 build

```text
> /atw.build
```

Expected:

- The command presents a plan summary (entities to enrich, estimated
  cost) and prompts for confirmation.
- After confirmation, the full build completes in ~4–6 minutes for
  the seeded Aurelia catalog (~342 indexable entities).
- Outputs: `atw_backend:latest` image, `dist/widget.{js,css}`,
  `atw_documents` populated, `.atw/state/build-manifest.json` written
  with `result: "success"`.

### 3.4 Run `/atw.embed`

```text
> /atw.embed
```

Answer the interview:

- Framework: `next-app-router`
- Backend URL: `http://localhost:3100`
- Auth mode: `cookie`
- API base URL: `http://localhost:9000`
- Login URL: `http://localhost:8000/login`

Expected: `demo/atw-aurelia/.atw/artifacts/embed-guide.md` is
written; the `<script>` snippet it produces matches the one the
Medusa storefront already has (self-consistency check).

### 3.5 Bring the ATW runtime up

```sh
docker compose up atw_postgres atw_backend -d --wait
```

### 3.6 Verify

Follow §2.5–§2.8 above. All invariants should hold.

---

## 4. Success criteria cross-reference

| Step        | Success criterion                                                  |
|-------------|--------------------------------------------------------------------|
| §2.3 + §2.5 | SC-005 — reproducibility on fresh clone in < 3 min.                |
| §2.5        | SC-001 — grounded reply p50 ≤ 4 s, p95 ≤ 6 s.                      |
| §2.5        | SC-003 — multi-turn coherence (same session).                      |
| §2.5        | SC-007 — citations navigable.                                      |
| §2.6        | SC-001 — grounded comparison.                                      |
| §2.7        | SC-002 — action round trip < 2 s after click.                      |
| §2.8        | SC-006 — credential sovereignty.                                   |
| §2.8        | SC-011 — no third-party origins.                                   |
| §3          | FR-036 — fresh path reproduces setup flow for demo video.          |
| §3.4        | SC-014 — `/atw.embed` completeness for one framework (next-app).   |

Remaining success criteria (SC-004, SC-008, SC-009, SC-010, SC-012,
SC-013, SC-015) are enforced by automated tests and not by this
manual script. `tests/e2e/aurelia-demo.spec.ts` exercises a subset
automatically against the demo stack.

---

## 5. Troubleshooting

### The launcher does not appear

- Open the browser console. If you see
  `[atw] data-backend-url missing`, the storefront's layout is
  missing the `<script>` tag — re-run `make demo` to ensure the
  storefront image is up to date.

### `/v1/chat` returns 503 `retrieval_unavailable`

- `atw_postgres` is not healthy. `docker compose logs atw_postgres`
  for details. Most common cause: the initial dump import failed.
  Run `make fresh && make demo`.

### `/v1/chat` returns 503 `model_unavailable`

- `ANTHROPIC_API_KEY` is unset or invalid. Check `.env` and
  `docker compose restart atw_backend`.

### Cart does not update after confirm

- Open the network tab. The `POST /store/carts/{id}/line-items` call
  should go to `localhost:9000`. If it goes to `localhost:3100`,
  `data-api-base-url` is misconfigured on the storefront.
- If it returns 401, the shopper's Medusa session expired — log in
  again.

### CORS error on the widget

- `ALLOWED_ORIGINS` on `atw_backend` does not include the
  storefront's origin. Update `.env` and restart.

### I want to change the demo data

- Edit files under `demo/medusa/seed/`. Run `make fresh` to clear
  the Medusa DB and re-seed.

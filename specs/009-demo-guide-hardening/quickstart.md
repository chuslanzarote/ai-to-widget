# Phase 1 — Quickstart: Demo-Guide Hardening (post-implementation)

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

This document is the **post-implementation** integrator path that
Feature 009 must enable. It is the verification target for SC-001
(under 30 minutes, zero hand-edits, zero outside-the-guide
debugging) and the basis for the CI regression harness (FR-035).
If any step here requires an extra command, edit, or restart that
is not literally written in the emitted artifacts, the
implementation is incomplete.

---

## Prerequisites (one-time)

- Docker Desktop or Docker Engine running.
- Node.js ≥ 20 installed (`node --version`).
- Claude Code installed (`claude --version`).
- An Anthropic API key.

---

## Step 1 — Clone and bootstrap (≤ 3 minutes)

```bash
git clone https://github.com/<org>/ai-to-widget
cd ai-to-widget
npm ci
npm run build               # compiles packages/scripts/dist/
```

**Verify**: `npx atw-orchestrate --version` prints a version. If
this fails with "dist/ is stale", the build step did not finish
cleanly — re-run `npm run build`.

---

## Step 2 — Initialize a new ATW project (≤ 5 minutes)

In a separate terminal, in the integrator's host project directory:

```bash
claude /atw.init
```

`/atw.init` asks for:

1. Project name.
2. Deployment type (`customer-facing-widget`).
3. **ATW backend origin** (e.g. `http://localhost:3100`).
4. **Host API origin** (e.g. `http://localhost:3200`).
5. **Host page origin** (e.g. `http://localhost:8080`).
6. **Login URL** (optional).
7. Model snapshot (default `claude-opus-4-7`).

URL syntax errors abort at input time (FR-010). Skipping a required
question prevents `project.md` from being written (FR-011).

**Verify**: `cat .atw/config/project.md` shows all six origin
values populated; the YAML frontmatter validates against
`contracts/project-md.schema.json`.

---

## Step 3 — Capture brief, schema, OpenAPI (≤ 8 minutes)

```bash
claude /atw.brief        # ~3 min interview
claude /atw.schema       # paste pg_dump output (works with v17/18)
claude /atw.api          # paste OpenAPI URL or file path
```

`/atw.api` runs the LLM-native pipeline:

```
[classify] Bundling OpenAPI document...
[classify] OpenAPI: 247 operations | model: claude-opus-4-7 | est. cost: ~$0.52
[classify] Continuing in 2s, Ctrl+C to abort...
[classify] Calling Anthropic (attempt 1/3)...
[classify] Manifest validated: 38 operations in scope.
[classify] Wrote .atw/artifacts/action-manifest.md ✓
```

If transient HTTP errors occur, the retry policy kicks in
automatically (FR-008a). Schema-validation failures fail fast with
a field-level error (FR-008).

**Verify**: every entry in `action-manifest.md`'s YAML frontmatter
that has `requires_confirmation: true` (writes) MUST have a
non-empty `input_schema.properties` block. The CI harness (FR-035)
asserts this.

---

## Step 4 — Plan and build (≤ 8 minutes)

```bash
claude /atw.plan
claude /atw.build
```

`/atw.build` runs phases in order: IMPORT, ENRICH, EMBED, RENDER,
COMPOSE. Each phase appends an entry to
`.atw/artifacts/build-provenance.json`. The summary at the end is
honest:

```
✅ Build complete (5 phases succeeded).
```

OR

```
⚠ Build complete with 1 warning:
  COMPOSE: skipped (markers absent in ./docker-compose.yml; rerun
  /atw.build and answer 'y' at the prompt to inject them).
```

If COMPOSE detects markers missing in the host compose file
(`./docker-compose.yml`), it prompts:

```
COMPOSE: ./docker-compose.yml lacks ATW marker block. Inject? [y/N]
```

Default "no" leaves the host file untouched and exits the phase
with a `warning` status (FR-029, Q3).

**Verify**: tail `.atw/artifacts/build-provenance.json`. Every
entry's `status` is `success` or `success_cached`. No `failed`,
no `skipped` without an actionable `skipped_reason`.

---

## Step 5 — Emit embed guide (≤ 2 minutes)

```bash
claude /atw.embed
```

This writes:

- `<host>/atw/embed-guide.md` — single coherent document (FR-012).
- `<host>/atw/.env.example` — pre-filled where known (FR-017).
- Static assets under `<host>/atw/dist/` — widget bundle + CSS.

**Verify (CI)**: a grep over `embed-guide.md` matches none of:
- `<your storefront origin>`
- `[NEEDS CLARIFICATION]`
- `specs/`
- bare `localhost` without "REPLACE THIS" annotations

(SC-006).

---

## Step 6 — Follow the embed guide verbatim (≤ 4 minutes)

Open `embed-guide.md` and follow each section:

1. Copy the `<script>` + `<link>` snippet into the host HTML page.
   The snippet has `data-api-base-url` and `data-backend-url`
   inlined; no `data-allowed-tools` (FR-014, FR-015).
2. Configure CORS on the host API per the framework-specific
   snippet for the detected stack (FR-016).
3. Start the ATW backend per the "Run the backend" section
   (FR-017).
4. If the host frontend is build-time-frozen (Vite/Next.js/nginx
   container), rebuild it per the "Static assets" section warning
   (FR-018).

**Cross-platform**: every command in the guide has both bash and
PowerShell variants OR is platform-agnostic (FR-019).

---

## Step 7 — Confirm a write end-to-end (≤ 1 minute)

Open the host page (`http://localhost:8080` in the demo). The
widget loads, fetches the catalog from the ATW backend at runtime
(FR-015), and is ready.

1. Open the chat panel.
2. Say: *"add one bag of decaf to my cart"*.
3. The ActionCard renders:
   > **Add 1× Decaf Swiss Water 500 g to your cart**

   (Substituted from `summary_template`, FR-022 and Q1.)
4. Click **Confirm**.
5. The widget POSTs to `<host_api_origin>/cart/items` with
   `{"product_id": "...", "quantity": 1}` — both fields populated
   from the conversation context (US1).
6. The host API returns `200`; the widget shows a grounded
   confirmation message.

**Verify**: the response in browser devtools shows no
`citations: []` field — citations are gone end-to-end (Q1, FR-023,
FR-024). The waiting indicator is the language-neutral 3-dot
animation; no Spanish strings (FR-021).

---

## Step 8 — Click-through test (≤ 30 seconds)

While the chat panel is open, scroll the host page. The host page
scrolls normally; clicking outside the panel reaches host-page
elements (FR-027). No modal backdrop blocks anything.

---

## Total time budget: ≤ 30 minutes

The breakdown above sums to ≤ 30 minutes for a first-time
integrator with no ATW context. SC-001 verified.

---

## CI regression harness (FR-035)

A GitHub Actions workflow (`.github/workflows/atw-regression.yml`)
runs Steps 1–7 against `demo/shop` on every PR that touches
`packages/scripts/**`, `demo/shop/**`, or this spec. The CI
asserts:

- **SC-002**: every write in the manifest has non-empty
  `input_schema.properties`.
- **SC-003**: every ActionCard rendered in the simulated flow
  contains at least one argument value (no raw tool name, no Opus
  question).
- **SC-004**: forced-failure scenarios trigger non-success
  summaries.
- **SC-006**: the embed-guide grep finds no placeholder strings.

If any assertion fails, the PR is blocked from merging.

---

## Troubleshooting (the only debugging steps a guide should contain)

- **"dist/ is stale"** — Run `npm run build` (FR-032, Q4). The
  runtime never auto-rebuilds.
- **LLM error after 3 attempts** — The Anthropic API is
  unreachable; check your network and the API key. Re-run the
  command; successful prior phases skip via input-hash
  (FR-008b).
- **CORS error in browser** — The host API hasn't been configured
  yet. Re-read the CORS section of `embed-guide.md` (FR-016).

Anything else falls outside the scope of "the integrator follows
the guide verbatim". If you encounter it, file an issue — the
demo-guide is supposed to handle it.

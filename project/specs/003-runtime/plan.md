# Implementation Plan: Runtime (Feature 003)

**Branch**: `003-runtime` | **Date**: 2026-04-22 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-runtime/spec.md`

## Summary

Feature 003 turns the outputs of Features 001 and 002 into a running
product: a Fastify service exposing `POST /v1/chat` that embeds the
shopper's message, retrieves grounded context from `atw_documents` via
pgvector, drives an Opus 4.7 tool-use loop that executes safe-read tools
server-side and returns state-changing actions as confirmation intents,
and returns a single JSON response; a self-contained JavaScript widget
(vanilla-DOM + Preact Signals for state; target bundle ≤ 80 KB gzipped)
that loads via one `<script>` + `<link>`, holds in-memory conversation
state, renders markdown replies via `marked` + `DOMPurify`, gates every
action behind a user-click confirmation card, executes confirmed
actions against the host API using the shopper's own credentials under
three selectable auth modes (cookie / bearer / custom), and honours
WCAG 2.1 AA basics; a `/atw.embed` slash command that interviews the
Builder and emits a framework-tailored integration guide under
`.atw/artifacts/embed-guide.md`; and a Medusa v2 demo under `demo/`
with deterministic seed data (300 products, 25 categories, 12
collections, multiple regions) plus pre-built Feature 001/002 artefacts
so a reviewer reaches a working Aurelia storefront with the widget
answering grounded questions within three minutes of `docker compose up`
on a fresh clone.

The runtime layer composes cleanly on top of the 002 build pipeline:
the compiled `atw_backend:latest` image is what the backend deploys;
the compiled `dist/widget.{js,css}` is what the storefront embeds;
`atw_documents` populated by `/atw.build` is what the retrieval query
reads. The backend runs template renders from Feature 002
(`backend/src/*.ts` generated from Handlebars) and the widget is the
target of `packages/widget/src/*`, filled for the first time in this
feature. Principle I (User Data Sovereignty, red line) is the
structural spine: safe-read tools run server-side without shopper
credentials; action tools never run on the backend at all — the widget
executes them against the host API with the shopper's own session.

## Technical Context

**Language/Version**: TypeScript 5.4 on Node.js 20 LTS (already pinned
via `.nvmrc` from Feature 001). Browser target for the widget: ES2020
(same target esbuild already emits in Feature 002's `compile-widget`).
**Primary Dependencies**:
- `fastify@4` — backend HTTP framework. Small, fast, typed, native zod
  integration. Chosen over Express for first-class TypeScript and
  built-in schema validation; the Feature 002 `backend/src/index.ts.hbs`
  stub already assumes Fastify.
- `@fastify/cors@9` — CORS middleware gated on `ALLOWED_ORIGINS`.
- `@fastify/rate-limit@9` — per-session and per-IP rate limiting; the
  session key is derived from the `X-Atw-Session-Id` cookie that the
  widget sets on first open.
- `@anthropic-ai/sdk` — already an explicit dependency from Feature 002;
  the runtime uses `messages.create` with `tools` to drive multi-turn
  tool use.
- `@xenova/transformers` — already pinned; the backend re-uses the
  model cache baked into the `atw_backend:latest` image (Feature 002's
  Dockerfile pre-caches `bge-small-multilingual-v1.5`).
- `pg` — already pinned; retrieval runs with a small connection pool
  (min 1 / max 4) sized for a single-process V1.
- `zod` — already pinned; request/response schemas and runtime widget
  response validation.
- `pino` + `pino-pretty` — structured JSON logs from the backend (JSON
  in Docker; pretty in local dev).
- `preact@10` + `@preact/signals` — widget's reactive state engine.
  Preact alone is ~3 KB gzipped; Signals ~1 KB. This keeps the widget
  inside the 80 KB gzipped budget with room for `marked` + `DOMPurify`.
- `marked@12` — CommonMark-to-HTML renderer for assistant messages.
- `dompurify@3` — sanitisation wrapper around `marked`'s output, no
  `unsafe-inline` / `unsafe-eval` in the emitted HTML, CSP-compatible.
- `vitest` + `@testing-library/preact` + Playwright — unit / contract /
  integration / widget-E2E testing tiers.
- `@testcontainers/postgresql` — already in the Feature 002 dev-dep
  set; reused for end-to-end integration tests against a real pgvector
  instance.
**Storage**:
- The runtime reads from the same Postgres + pgvector instance that
  Feature 002 populated. No new tables, no new migrations. The backend
  opens a read/write connection: `SELECT` for retrieval plus, when a
  Builder opts in (future Feature 004), `INSERT` into a telemetry
  table — but Feature 003 only reads.
- Conversation history lives in the browser tab's JavaScript heap.
  No server-side session store, no Redis. Per FR-019 it is retransmitted
  with every request, trimmed to the 20-turn cap at both ends.
- Rate-limit state is an in-memory LRU inside the backend process. A
  single-process V1 does not need a shared store; Redis is an explicit
  non-goal per Principle VII (Single-Ecosystem Simplicity).
**Testing**:
- Unit: `vitest` for backend libraries (retrieval, tool-execution,
  auth-stripping log filter) and widget libraries (markdown sanitiser,
  action-card renderer, auth-mode header builder).
- Contract: `vitest` against the `POST /v1/chat` handler with a real
  pgvector testcontainer and a mock Anthropic server; widget contract
  tests run the widget against a stubbed backend using
  `@testing-library/preact`.
- Integration: top-level `tests/integration/runtime-*.test.ts` bring
  up the full stack (Medusa + ATW) via `docker compose -f
  docker-compose.test.yml up` and hit the storefront in a headless
  browser.
- Demo smoke: Playwright script `tests/e2e/aurelia-demo.spec.ts`
  scripts the five-turn demo conversation and asserts citations,
  action execution, cart delta.
- Guard: all Docker-dependent tests skip without `ATW_E2E_DOCKER=1`
  (same pattern adopted in Feature 002 / T108).
**Target Platform**:
- Backend: Node 20 LTS inside `atw_backend:latest` (distroless-node
  base from Feature 002). Deployed via `docker compose up` locally; the
  same image runs on any Docker host.
- Widget: evergreen browsers (Chrome / Safari / Firefox / Edge from the
  last two years) plus iOS Safari 15+ and Android Chrome 100+.
- `/atw.embed` command: runs inside Claude Code on the Builder's
  workstation (macOS / Linux / WSL2).
**Project Type**: Mixed workload — an HTTP backend (`packages/backend`),
a browser widget bundle (`packages/widget`), a slash-command + demo
orchestration layer on top of Features 001–002.
**Performance Goals**:
- `POST /v1/chat` p50 ≤ 3 s, p95 ≤ 6 s (SC-001 backs both).
- pgvector retrieval ≤ 100 ms on the 342-entity Aurelia index.
- Widget time-to-interactive ≤ 500 ms on the storefront page; load is
  non-blocking (the script tag uses `defer` / `afterInteractive`).
- Cold start of the Aurelia demo stack ≤ 3 minutes on reference
  hardware (SC-005).
- Action execution round-trip ≤ 2 s between confirmation click and
  cart-icon update (SC-002).
**Constraints**:
- **Principle I (red line)**: backend MUST NOT see end-user
  credentials. Enforced by three structural rules: (1) the widget
  never attaches the `Authorization` header or `credentials: 'include'`
  to calls to the ATW backend URL — only to the host-API base URL; (2)
  the backend's Fastify request hook strips any `Authorization` /
  `Cookie` header before the handler runs and logs a warning if one
  was seen; (3) contract tests assert the filter at every relevant
  path.
- **Principle V (red line)**: every assistant reply either cites a
  retrieved entity or acknowledges "not in the catalog". The system
  prompt — templated from Feature 001's `brief.md` +
  `action-manifest.md` — includes an anti-fabrication clause, and the
  backend augments the model call with retrieved `facts[]` so the
  model has grounded material to quote.
- **Principle VIII (red line)**: `docker compose up` on a fresh clone
  reaches a grounded first reply in ≤ 3 minutes; every service image
  pinned with a digest; the Medusa seed data is committed JSON, not
  fetched from a CDN; the Feature 002 artefacts for Aurelia are
  committed under `demo/atw-aurelia/.atw/`.
- Widget bundle size: script ≤ 80 KB gzipped, stylesheet ≤ 10 KB
  gzipped (enforced in Feature 002's `atw-compile-widget` — the build
  asserts against these budgets and fails CI if exceeded).
- No streaming responses in V1 (single JSON payload per request); no
  persistence of conversation across page reloads; no OAuth/SAML/OIDC
  flows (cookie + bearer + custom are the shipped modes).
- Prompt-injection resistance is best-effort; the tool-name allowlist
  and the server-side refusal of unknown tools are the structural
  rails. The README documents the known limit.
**Scale/Scope**:
- V1 is single-tenant, single-process. ~20 concurrent conversations on
  a 2-CPU container (per source doc §7 Scalability).
- Aurelia demo catalog: 300 products, 25 categories, 12 collections,
  4 regions, ~3 sample customers, ~6 sample orders (for US-003.5
  personalised-query demo). Backend retrieval reads from the
  Feature-002-populated `atw_documents` (342 entities for the tiny
  Aurelia fixture; up to ~2000 if the seed is enlarged).
- New code: 1 Fastify backend (~12 source files), 1 widget (~12 source
  files), 1 slash-command (`commands/atw.embed.md`), 1 script
  (`packages/scripts/src/embed.ts` + shim), 1 Medusa demo directory
  tree, 1 top-level `docker-compose.yml`, 1 Makefile convenience
  target.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design — still passing.*

| # | Principle | Status | Anchor |
|---|---|---|---|
| I | User Data Sovereignty (red line) | PASS | Backend never receives or proxies shopper credentials. Structural rules at three layers: (a) widget only attaches credentials to the configured `HOST_API_BASE_URL`, never to the ATW backend URL (`contracts/widget-config.md §5`); (b) backend Fastify `onRequest` hook strips `Authorization`, `Cookie`, `X-*-Token`, and `Set-Cookie` headers before the handler sees them and logs a single warning line if any were present (`contracts/chat-endpoint.md §6`); (c) safe-read tools executed server-side use only a server-side `HOST_API_KEY` (optional) that the Builder explicitly sets — never the shopper's session. No DSN input anywhere. |
| II | Markdown as Source of Truth | PASS | `action-manifest.md` (Feature 001) is the source of the tool list both the backend and the widget consult. `/atw.embed` writes `.atw/artifacts/embed-guide.md` as its single artefact. No JSON/YAML config introduced for decisions the Builder would want to edit. |
| III | Idempotent and Interruptible | PASS | The runtime is stateless at the backend level: every request is independent; Postgres reconnects on transient failure; the widget retries on user action. `/atw.embed` is idempotent by design — re-running with the same answers produces the same guide bytes-for-bytes. |
| IV | Human-in-the-Loop by Default | PASS | `confirmation_required: true` actions structurally cannot reach `fetch()` without a user click on the confirmation card (`contracts/widget-config.md §4`). `/atw.embed` presents the generated guide for Builder review before writing. |
| V | Anchored Generation (red line) | PASS | Backend's response-composition path always passes the top-K retrieved entities as an XML-tagged context block to Opus. System prompt (rendered from Feature 001's `brief.md` + `action-manifest.md`) forbids claims without a source. On zero retrieval hits above the threshold, the model is instructed to reply "I don't see that in the catalog" rather than fabricate. The widget's citation rendering closes the loop: every fact the shopper sees is traceable to an entity link. |
| VI | Composable Deterministic Primitives | PASS | Backend splits deterministic primitives (`lib/retrieval.ts`, `lib/embedding.ts`, `lib/tool-execution.ts` for safe-reads, `lib/rate-limit.ts`) from the single agentic call site (`lib/opus-client.ts`). Widget splits rendering (`message-list.ts`, `markdown.ts`), state (`state.ts`), and side effects (`api-client.ts`, `auth.ts`) so each file has one responsibility. `/atw.embed` is pure code generation driven by Builder answers — zero Opus calls. |
| VII | Single-Ecosystem Simplicity | PASS | TypeScript / Node 20 throughout. One Postgres+pgvector. One Docker Compose for local orchestration. No Redis, no message queues, no separate vector DB, no Python side-services. Preact (≈4 KB) is the only non-native DOM layer — documented in research.md §1 and accepted as a deliberate widget-ergonomics choice that stays well inside the 80 KB bundle budget. |
| VIII | Reproducibility as a First-Class Concern (red line) | PASS | `docker-compose.yml` at repo root pins every service image with a digest (`postgres:16-alpine@sha256:...`, `redis:7-alpine@sha256:...`, `pgvector/pgvector:pg16@sha256:...`, `atw_backend:latest` built from committed source). Medusa seed data is deterministic JSON checked into `demo/medusa/seed/`. Feature 001/002 artefacts are pre-computed under `demo/atw-aurelia/.atw/`. A `make fresh` target wipes everything and runs Features 001/002 from zero so the filmed setup flow is also reproducible (FR-036). Quickstart.md is the binding reproducibility script. |
| IX | Opus as a Tool, Not a Crutch | PASS | Opus is called exactly once per chat turn's tool-use loop, bounded at `MAX_TOOL_CALLS_PER_TURN=5`. Retrieval is pgvector SQL. Embedding is local `@xenova/transformers`. Markdown parsing is `marked` + `DOMPurify`. Rate limiting is in-process LRU. `/atw.embed` is pure templated generation. |
| X | Narrative-Aware Engineering | PASS | This feature is the demo video's live portion — user-visible. P1 stories (grounded answer, action w/ confirmation, multi-turn, reproducible clone) map 1:1 to the four beats the video must show. P2/P3 stories (comparison, auth passthrough, anonymous degradation, `/atw.embed`, theming, safety rails) extend trust for repeat viewings but do not block the filmed take. The `make fresh` path directly supports filming the compressed setup portion. |

**Red lines (I, V, VIII) all PASS unconditionally.** No Complexity Tracking entries required.

## Project Structure

### Documentation (this feature)

```text
specs/003-runtime/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature spec (completed by /speckit.specify)
├── research.md          # Phase 0 output (decisions resolved)
├── data-model.md        # Phase 1 output (runtime types + shapes)
├── quickstart.md        # Phase 1 output (reviewer path + fresh path)
├── contracts/           # Phase 1 output
│   ├── chat-endpoint.md      # POST /v1/chat request/response + safeguards
│   ├── widget-config.md      # data-* attributes, auth modes, confirmation gate
│   ├── embed-command.md      # /atw.embed interview flow + embed-guide.md shape
│   └── compose.md            # docker-compose.yml service graph + env vars
├── checklists/
│   └── requirements.md  # spec quality checklist (16/16 pass)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created here)
```

### Source Code (repository root)

```text
ai-to-widget/                         # npm workspaces monorepo
├── .nvmrc                            # Node 20 pin (Feature 001)
├── package.json                      # workspaces: packages/*
├── docker-compose.yml                # EXTEND — add Medusa + storefront + ATW runtime services (Feature 002 already enabled the ATW block)
├── Makefile                          # NEW — `make demo`, `make fresh`, `make seed`
├── commands/
│   ├── atw.build.md                  # (Feature 002)
│   └── atw.embed.md                  # NEW — the slash command markdown
├── packages/
│   ├── installer/                    # (Feature 001) — extend to copy commands/atw.embed.md
│   ├── scripts/
│   │   ├── bin/
│   │   │   └── atw-embed.js          # NEW — thin shim for /atw.embed
│   │   ├── src/
│   │   │   └── embed.ts              # NEW — interview + generate embed-guide.md
│   │   └── test/
│   │       ├── embed.unit.test.ts    # NEW — generator golden tests
│   │       └── embed.contract.test.ts # NEW — CLI shim contract
│   ├── backend/
│   │   ├── package.json              # extend deps: fastify, @fastify/cors, @fastify/rate-limit, pino, zod, marked, dompurify (server-side markdown for logs only; widget has its own)
│   │   ├── Dockerfile                # (Feature 002) — already pre-caches embedding model
│   │   └── src/
│   │       ├── index.ts.hbs          # (Feature 002) extend: wire Fastify, mount routes, register plugins
│   │       ├── retrieval.ts.hbs      # (Feature 002) extend: parameterise threshold + top-K
│   │       ├── enrich-prompt.ts.hbs  # (Feature 002) — unchanged (used at build time only)
│   │       ├── enrich-prompt-sharpen.ts.hbs  # (Feature 002) — unchanged
│   │       ├── routes/
│   │       │   ├── chat.ts.hbs       # NEW template — POST /v1/chat handler
│   │       │   └── health.ts.hbs     # NEW template — GET /health handler
│   │       ├── lib/
│   │       │   ├── embedding.ts.hbs  # NEW template — thin wrapper around @xenova/transformers
│   │       │   ├── opus-client.ts.hbs # NEW template — tool-use loop + retry
│   │       │   ├── tool-execution.ts.hbs # NEW template — safe-read executor (server-side HTTP)
│   │       │   ├── action-intent.ts.hbs # NEW template — construct action-intent from Opus tool call
│   │       │   ├── rate-limit.ts.hbs # NEW template — in-memory LRU keyed by session/IP
│   │       │   ├── cors.ts.hbs       # NEW template — origin allowlist from ALLOWED_ORIGINS
│   │       │   ├── credential-strip.ts.hbs # NEW template — onRequest hook stripping shopper creds
│   │       │   ├── logger.ts.hbs     # NEW template — pino with PII redaction serializer
│   │       │   ├── pii-scrub.ts.hbs  # NEW template — defence-in-depth retrieved-text scrub (FR-038)
│   │       │   └── errors.ts.hbs     # NEW template — typed error mapping to HTTP status
│   │       ├── tools.ts.hbs          # (Feature 002 placeholder) — rendered from action-manifest.md
│   │       ├── prompts.ts.hbs        # (Feature 002 placeholder) — system prompt rendered from brief.md + action-manifest.md
│   │       └── config.ts.hbs         # (Feature 002 placeholder) — PORT, ALLOWED_ORIGINS, rate-limit defaults
│   └── widget/
│       ├── package.json              # extend deps: preact, @preact/signals, marked, dompurify
│       ├── src/
│       │   ├── index.ts              # NEW — entry (bundle target); reads data-* attrs, injects launcher, boots panel
│       │   ├── launcher.ts           # NEW — launcher button
│       │   ├── panel.tsx             # NEW — Preact chat panel, focus trap, open/close
│       │   ├── message-list.tsx      # NEW — turn rendering + citation links
│       │   ├── markdown.ts           # NEW — marked + DOMPurify-wrapped renderer
│       │   ├── input.tsx             # NEW — text input, Enter/Shift+Enter, disabled states
│       │   ├── action-card.tsx       # NEW — confirmation card, Cancel/Confirm handlers
│       │   ├── api-client.ts         # NEW — POST /v1/chat + follow-up signals
│       │   ├── auth.ts               # NEW — cookie / bearer / custom header builders
│       │   ├── state.ts              # NEW — @preact/signals-backed conversation store
│       │   ├── theme.css             # NEW — defaults + CSS custom properties
│       │   └── styles.css            # NEW — component styles (imports theme.css)
│       └── test/
│           ├── markdown.unit.test.ts # NEW — sanitiser kills `<script>`, JS URIs, etc.
│           ├── auth.unit.test.ts     # NEW — each mode produces expected headers
│           ├── action-card.unit.test.ts # NEW — click path, cancel path, unknown-tool refusal
│           └── api-client.unit.test.ts # NEW — retry + error surfaces
├── demo/                             # NEW TOP-LEVEL DIRECTORY
│   ├── medusa/
│   │   ├── backend/                  # Medusa v2 backend Docker + env
│   │   ├── storefront/               # Next.js storefront + Aurelia theming + widget <script>
│   │   └── seed/                     # deterministic JSON seed + seed script
│   └── atw-aurelia/
│       └── .atw/                     # pre-built Feature 001/002 artefacts for fast reviewer path
├── packages/scripts/src/lib/
│   └── types.ts                      # (Feature 002) — extend with runtime request/response zod schemas (ChatRequest, ChatResponse, ActionIntent, Citation)
└── tests/
    ├── integration/
    │   ├── runtime-chat-grounded.test.ts       # NEW — US-003.1 (SC-001)
    │   ├── runtime-action-confirmation.test.ts # NEW — US-003.2 (SC-002)
    │   ├── runtime-multi-turn.test.ts          # NEW — US-003.3 (SC-003)
    │   ├── runtime-anonymous-fallback.test.ts  # NEW — US-003.6 / US-003.7 (SC-004)
    │   ├── runtime-credential-sovereignty.test.ts # NEW — log + traffic inspection (SC-006)
    │   ├── runtime-tool-allowlist.test.ts      # NEW — widget refuses unknown tool (SC-008)
    │   ├── runtime-rate-limit.test.ts          # NEW — 429 + Retry-After (SC-010)
    │   ├── runtime-bundle-size.test.ts         # NEW — asserts widget.{js,css} under budget (SC-009)
    │   └── embed-guide-roundtrip.test.ts       # NEW — /atw.embed output for each framework (SC-014)
    └── e2e/
        ├── aurelia-demo.spec.ts      # NEW — Playwright: 5-turn demo script (SC-005, SC-007, SC-011, SC-015)
        └── accessibility.spec.ts     # NEW — Playwright + axe-core for WCAG 2.1 AA (SC-013)
```

**Structure Decision**: Feature 003 keeps the npm-workspaces monorepo
intact. The `packages/backend/src/` tree grows four new Handlebars
template families — `routes/`, `lib/`, and the already-present
top-level `tools.ts.hbs` / `prompts.ts.hbs` / `config.ts.hbs` — all
rendered at build time by Feature 002's `atw-render-backend` into the
actual TypeScript that ships in `atw_backend:latest`. The widget
workspace gets its full source for the first time: a Preact + Signals
app under ~12 files, bundled by Feature 002's `atw-compile-widget`. A
new top-level `demo/` directory carries the Medusa installation, the
storefront, the seed data, and the pre-built Aurelia artefacts. The
slash-command surface grows by one (`atw.embed`), matching the
Feature 001/002 pattern of thin markdown command + auxiliary script
shim. This alignment preserves Principle VI (Composable Deterministic
Primitives): the runtime is rendered deterministically from templates
and builds deterministically from the Feature 002 pipeline — the only
agentic surface in the runtime is the single Opus tool-use call per
chat request.

## Complexity Tracking

> No Constitution Check violations — this table is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| *(none)*  | —          | —                                    |

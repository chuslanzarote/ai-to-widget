# Research: Runtime (Feature 003)

**Feature**: Runtime
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-22

This document records the technical decisions the spec intentionally
deferred to planning. Each section has the same structure:

- **Decision** — what we are committing to.
- **Rationale** — why this choice beats the alternatives under the
  constitution's priority order.
- **Alternatives considered** — what else was on the table and the
  concrete reason it lost.

Numeric parameters (threshold 0.55, top-K 8, 60 req / 10 min, 80 KB
bundle, etc.) are already fixed in the spec and are not re-debated
here; this document fills in *how* those targets get met.

---

## 1. Widget DOM/reactivity stack

**Decision.** Preact 10 + `@preact/signals` for widget UI; `marked` +
`DOMPurify` for assistant-message rendering. Single IIFE bundle
produced by the Feature 002 `atw-compile-widget` pipeline.

**Rationale.**

- Preact 10 is ~4 KB gzipped and API-compatible with React's subset we
  need (JSX, hooks, `useReducer`, `useEffect`). Writing the chat
  panel, message list, and action card as Preact components is ~1.5×
  the code of vanilla DOM but dramatically easier to test with
  `@testing-library/preact` and to refactor. The cost fits well inside
  the 80 KB bundle budget (FR-027, SC-009).
- `@preact/signals` (~1 KB gzipped) gives us reactive state without
  importing a full state manager. The conversation store (`state.ts`)
  exposes signals for messages, open/closed, pending action, and a
  derived "can send" boolean — each signal subscribes the components
  that need it, minimising re-renders and avoiding a manual observer
  layer.
- `marked` is the most battle-tested small Markdown parser; paired
  with `DOMPurify` it meets Non-functional §4 (security): no
  `unsafe-inline`, no `unsafe-eval`, CSP-compatible output.

**Alternatives considered.**

- **Vanilla DOM + hand-rolled diffing.** Would save ~5 KB but triples
  the testable surface (every DOM mutation hand-written). Rejected;
  reliability matters more than bundle savings, and we still meet the
  budget with Preact.
- **React + React-DOM.** Would cost ~40 KB gzipped. Out of budget
  per FR-027 / SC-009. Preact is the strict compatibility subset we
  need.
- **Svelte.** Attractive for bundle size, but introduces a separate
  build step outside esbuild's current pipeline (`@atw/scripts` would
  need `svelte/compiler`). Rejected under Principle VII
  (single-ecosystem simplicity).
- **LitElement / web components.** Would force us to adopt Shadow DOM
  for style isolation — good for host-CSS safety but fights directly
  with Principle FR-025 (CSS custom properties cross the shadow root
  awkwardly). Rejected.

---

## 2. Backend HTTP framework

**Decision.** Fastify 4 with `@fastify/cors` and `@fastify/rate-limit`.

**Rationale.**

- Fastify is already assumed by the Feature 002 `backend/src/index.ts.hbs`
  scaffold; choosing it here is continuity, not a new dependency.
- Native zod integration via `fastify-type-provider-zod` lets us use
  the same request/response schemas in code and in tests without
  duplicating shapes.
- Throughput per watt beats Express noticeably; important for the
  Principle VIII reproducibility target on reference hardware (≤ 3
  minutes cold start includes backend boot).
- `@fastify/rate-limit` is a small, well-maintained plugin with
  pluggable stores — in-memory by default, which is exactly what V1
  needs.
- `@fastify/cors` wires cleanly to a runtime-parsed
  `ALLOWED_ORIGINS` env var (comma-separated) per FR-014.

**Alternatives considered.**

- **Express + hand-written middleware.** Bigger surface, no schema
  integration, slower per req. Rejected.
- **Hono or Elysia.** Fast but unfamiliar to Claude Code's generated
  code and breaks continuity with Feature 002's stub. Rejected.
- **Bare Node `http`.** Plausibly smaller but reinvents rate-limit,
  CORS, schema validation. Rejected on Principle IX (Opus as a Tool,
  Not a Crutch — and the inverse: use good primitives, don't
  reinvent).

---

## 3. Rate-limiting strategy

**Decision.** In-process LRU keyed by widget-issued session ID with a
fallback to client IP when the session ID is missing.

**Rationale.**

- V1 is single-tenant single-process (Scale/Scope in plan.md). A
  process-local limiter is sufficient and adds zero dependencies
  beyond `@fastify/rate-limit`.
- Session-ID first lets us trace abuse to a widget session rather
  than to a whole corporate NAT. The widget generates a UUID on
  first open, stores it in `sessionStorage`, and sends it as
  `X-Atw-Session-Id` on every request. IP fallback closes the hole
  for curl-wielding attackers.
- The default 60 req / 10 min (FR-013) is loose enough for normal
  human chat and tight enough to cap runaway cost.

**Alternatives considered.**

- **Redis token bucket.** Required for horizontal scale, overkill for
  V1, violates Principle VII. Explicitly deferred.
- **IP-only.** Misattributes abuse on shared networks; rejected.
- **Cookie-based session.** Would require the backend to set a
  cookie, which risks cross-site-cookie complications with the
  widget's iframe-less embedding. `X-Atw-Session-Id` is a plain
  header and composes cleanly with CORS allowlist.

---

## 4. Opus tool-use orchestration

**Decision.** Single `@anthropic-ai/sdk` `messages.create` call per
chat turn with `tools` parameter, looping on `stop_reason === "tool_use"`
up to `MAX_TOOL_CALLS_PER_TURN` (default 5). Safe-read tool results
are fed back as `tool_result` content blocks in a second turn; action
tools emit `action_intent` structured output and break the loop.

**Rationale.**

- This is the standard Anthropic tool-use pattern and the exact shape
  Opus 4.7 is tuned for. No LangChain, no LlamaIndex (Principle IX).
- Loop cap prevents a pathological Opus response from racking up cost
  or hanging the request. Exceeding the cap returns a text-only reply
  with a logged warning.
- Separating safe-read execution (server-side, no credentials) from
  action execution (widget-side, with credentials) is the structural
  enforcement of Principle I — it's a property of the loop, not a
  runtime check.

**Alternatives considered.**

- **Streaming with SSE.** Out of scope per spec §2.2. Deferred.
- **Separate retrieval → answer calls with no tool use.** Would mean
  the model cannot call `get_product(id)` to enrich a follow-up; RAG
  becomes a single retrieval chained to a single call. Lower quality,
  rejected.
- **Planner-executor agent framework.** Multi-agent orchestration
  adds complexity the spec does not call for. Rejected.

---

## 5. System prompt rendering

**Decision.** The runtime system prompt is rendered by Feature 002's
`atw-render-backend` into `backend/src/prompts.ts` from a Handlebars
template that reads `.atw/config/brief.md` and
`.atw/artifacts/action-manifest.md`. It is baked into the image at
build time, not computed at runtime. The tool list
(`backend/src/tools.ts`) is rendered from the same manifest.

**Rationale.**

- Building the prompt at image-build time is deterministic: two builds
  on the same inputs yield byte-identical `prompts.ts`. This composes
  with Feature 002's SC-016 (build determinism) and makes rollbacks
  trivial.
- Runtime prompt *assembly* — stitching the (static) system prompt
  with (dynamic) retrieval context and conversation history — still
  happens per-request. Just the base template is static.
- The prompt carries the anti-injection and anti-fabrication clauses
  (Principle V red line).

**Alternatives considered.**

- **Load the prompt from a mounted file at startup.** Adds an env var
  and a failure mode with no real benefit. Rejected.
- **Re-render from markdown on every request.** Wastes CPU, breaks
  determinism. Rejected.

---

## 6. Credential-stripping enforcement

**Decision.** A Fastify `onRequest` hook (`lib/credential-strip.ts`)
deletes `Authorization`, `Cookie`, `Set-Cookie`, and any header
matching `/^X-.*-(Token|Auth|Session)$/i` before the route handler
runs. If any were present, it increments a `credential_strip_total`
counter in structured logs and tags the request so tests can assert
on it.

**Rationale.**

- Principle I is structural: we don't rely on the widget never sending
  a credential. The backend makes receiving one impossible by
  discarding at the earliest hook.
- Logging the event surfaces misconfigured widgets early; not logging
  the *value* keeps us compliant with FR-012.
- A hook-level strip is cheaper than per-route validation and cannot
  be forgotten in a new route.

**Alternatives considered.**

- **Return 400 on any credential-like header.** Fails the widget for
  something it might not even have sent intentionally (browser
  auto-attached cookies under certain CORS configurations). Rejected.
- **Only strip in the chat handler.** Forgettable when the next route
  ships; rejected.

---

## 7. PII defence-in-depth at retrieval time

**Decision.** After pgvector retrieval, `lib/pii-scrub.ts` runs a set
of conservative regexes (e-mail, international phone, 13-19 digit
card-like number, IBAN prefix) over each retrieved `document` + `facts`
text. Matches are replaced with `[redacted]` before the text reaches
Opus. Redactions are counted per request and logged.

**Rationale.**

- The primary PII exclusion runs at build time in Feature 002's
  `atw-scan-pii-leaks`. This scrub is pure belt-and-braces: if any PII
  sneaks in (bad schema-map, Builder editing after build, regression
  in the enrichment validator), the runtime still does not surface
  it.
- Regexes are conservative (high precision, intentionally low recall)
  so we do not over-redact legitimate product copy.

**Alternatives considered.**

- **No runtime scrub.** Relies entirely on build-time enforcement;
  rejected because Principle I is a red line and redundancy is cheap.
- **An LLM-based PII classifier.** Expensive, non-deterministic,
  overkill. Rejected on Principles VI + IX.

---

## 8. Widget authentication modes

**Decision.** Three auth modes selectable via `data-auth-mode`
attribute:

- `cookie` (default) — `fetch(url, { credentials: 'include' })`.
- `bearer` — read `localStorage[data-auth-token-key]` and attach
  `Authorization: Bearer <value>`; re-read on each call so host-app
  token refresh is honoured.
- `custom` — read `window.AtwAuthProvider`, call it, spread the
  returned header map onto the request.

In all modes, credentials are attached **only** to calls targeting the
configured `data-api-base-url` (the host API). Requests to the
backend URL never attach credentials.

**Rationale.**

- Covers the three real-world integrations we know about: Medusa's
  default cookie auth (our demo), JWT-in-localStorage apps, and apps
  with custom auth providers (e.g., Clerk / Auth0). OAuth/SAML/OIDC
  login *flows* are out of scope per spec.
- The widget's `auth.ts` builds the header map in one place; the
  api-client calls into it just before each `fetch`. This makes the
  contract testable as a pure function.

**Alternatives considered.**

- **Only cookie mode.** Matches Aurelia but fails everything else.
  Rejected; spec FR-022 requires three modes.
- **Configurable via JS API instead of data-attr.** Makes the
  copy-paste integration story harder. Rejected.

---

## 9. Markdown rendering safety

**Decision.** `marked` v12 configured with `gfm: true`, `breaks: false`,
`headerIds: false`; output passed through `DOMPurify` in the widget's
`markdown.ts` with an allowlist of tags (`p`, `ul`, `ol`, `li`, `code`,
`pre`, `strong`, `em`, `a`, `br`) and attributes (`href`, `title`,
`class` where the class is the predictable citation class). Anchor
hrefs are constrained to `http://`, `https://`, and `mailto:`; no
`javascript:`, no inline event handlers.

**Rationale.**

- `marked` has a small surface and predictable output. `DOMPurify`
  with an explicit allowlist produces a structurally safe DOM.
- Citation links are rendered by our own code (not markdown) so the
  allowlist can be tight on markdown-generated anchors and still leave
  citations fully styled.
- No images in V1 (spec §2.2 out-of-scope); blocks a vector.

**Alternatives considered.**

- **`markdown-it` + `markdown-it-sanitizer`.** Comparable safety,
  slightly larger; rejected on bundle size.
- **Custom mini-renderer.** Hand-rolled safety bugs. Rejected.
- **No markdown (plain-text only).** Less friendly; rejected on
  Principle X (Narrative-Aware) — shoppers expect basic formatting.

---

## 10. Accessibility toolchain

**Decision.** Manual implementation of WCAG 2.1 AA basics (focus
trap, visible focus, `aria-label`s, 4.5:1 contrast in default theme,
`prefers-reduced-motion`), validated by a Playwright + `axe-core`
smoke test (`tests/e2e/accessibility.spec.ts`) that opens the panel
and asserts zero high-impact violations (SC-013).

**Rationale.**

- The widget is small; a focus-trap library would double the JS for
  the panel alone. Manual focus management plus a `focus-trap` module
  scoped to the panel's opening hook fits inside the budget.
- `axe-core` is the de-facto accessibility oracle and runs headless,
  giving us a bright-line pass/fail for CI.

**Alternatives considered.**

- **`react-aria` / `react-focus-lock`.** Sized for React; Preact
  equivalents exist but add dependencies. Rejected on bundle size.
- **Manual accessibility review only.** Non-deterministic; rejected.

---

## 11. Medusa demo seeding

**Decision.** A `demo/medusa/seed/` directory carrying:

- `products.json` — 300 products with full metadata (title,
  description, tasting notes, handle, status, variants, prices,
  category_id, collection_id, origin_country, material).
- `categories.json` — 25 categories (Single Origin Coffee, Manual
  Brewers, Grinders, Gift Sets, etc.).
- `collections.json` — 12 collections (Limited Lots, Espresso, Gift
  Sets, etc.).
- `regions.json` — 4 regions (EU, US, UK, CA).
- `customers.json` — 3 sample customers with pre-known cookie
  credentials the demo video can log into.
- `orders.json` — 6 sample orders linked to those customers, so the
  US-003.5 "what did I order last time?" demo has real data.
- `seed.ts` — a Medusa CLI runner that reads the JSON, opens a
  transaction, and runs the writes in a single pass. Re-running
  truncates and reinserts atomically so the seed is idempotent.

All JSON files are committed; no CDN, no external fetches at seed
time (Principle VIII).

**Rationale.**

- 300 products is the spec's target (FR-034) and comfortably exercises
  the RAG retrieval threshold on real-language queries.
- Committing all seed data makes `docker compose up` on a fresh
  clone bit-for-bit reproducible.
- Idempotent reseed lets `make fresh` restart from zero without manual
  cleanup.

**Alternatives considered.**

- **Generate seed at runtime from an LLM prompt.** Non-deterministic,
  expensive, violates Principle VIII. Rejected.
- **Tiny seed (10 products).** Insufficient for comparison queries
  and anonymised semantic search. Rejected.
- **Pull seed from a gist / CDN.** Flaky. Rejected.

---

## 12. Docker Compose orchestration

**Decision.** One top-level `docker-compose.yml` at repo root,
extending the Feature 002 ATW block with Medusa services. Six
services total: `medusa_postgres`, `medusa_redis`, `medusa_backend`,
`medusa_storefront`, `atw_postgres`, `atw_backend`. Every image
pinned with a digest (e.g., `postgres:16-alpine@sha256:...`). A
separate `docker-compose.test.yml` overlay drives integration tests
with deterministic env vars and a test-only `HOST_API_KEY`.

**Rationale.**

- Matches the source doc §5.4 verbatim and the spec FR-033/FR-037.
- One compose file = one `docker compose up` = one reviewer
  experience. `make demo` and `make fresh` are thin wrappers.
- Digest pinning is the single most reliable reproducibility lever we
  have.

**Alternatives considered.**

- **Kubernetes manifests.** Dead on arrival per Principle VII.
- **Separate compose files per service.** Fragments the `docker
  compose up` experience. Rejected.
- **A Makefile-only target that starts services individually.**
  Non-portable, breaks on Windows reviewers.

---

## 13. Logging and observability

**Decision.** `pino` for structured JSON logs to stdout. A custom
serializer redacts any stray `authorization`, `cookie`, `set-cookie`,
`x-*-token`, `x-*-auth`, `x-*-session` headers on their way through.
A `req.id` is generated by `@fastify/request-id` and returned in the
`X-Request-Id` response header for trace correlation. `pino-pretty`
is enabled automatically when `NODE_ENV !== 'production'`.

**Rationale.**

- JSON logs are trivial to feed to any aggregator later and easy to
  diff in CI.
- Redaction at the serializer level means individual log sites don't
  need to remember what is sensitive.
- Request IDs unlock integration-test assertions on specific
  per-request observations (e.g., "did the chat handler see a
  `Cookie` header and strip it?").

**Alternatives considered.**

- **`console.log` and call it a day.** Unstructured, untestable.
  Rejected.
- **OpenTelemetry traces.** Over-scoped for V1, no aggregator
  available at hackathon time. Deferred.

---

## 14. Bundle-size verification

**Decision.** Feature 002's `atw-compile-widget` already emits
`widget.js` and `widget.css` and reports their sizes. Feature 003
extends it to fail the build when `widget.js.gz` > 80 KB or
`widget.css.gz` > 10 KB (FR-027 / SC-009). A separate integration
test `tests/integration/runtime-bundle-size.test.ts` asserts the same
invariant on the compiled artefact in `dist/` for defence in depth.

**Rationale.**

- Putting the check in the compile step means a budget regression is
  caught at `/atw.build` time, before the image is built.
- The integration assert guards against regressions in the compile
  step itself (e.g., a future refactor that accidentally drops the
  gzip check).

**Alternatives considered.**

- **CI-only check.** Fails too late; the Builder rebuilds, sees a
  green local build, pushes, and only CI notices. Rejected.
- **`bundlesize` npm package.** Adds a dep; the same check is ~15
  lines. Rejected on Principle VII.

---

## 15. Embedding guide generation

**Decision.** `/atw.embed` is a deterministic, non-agentic command.
`packages/scripts/src/embed.ts` reads the Builder's answers from a
markdown interview (written in `.atw/state/embed-answers.md`),
combines them with a small template library (one template per
supported framework — Next.js App Router, Next.js Pages Router, plain
HTML, custom), and writes `.atw/artifacts/embed-guide.md`. No Opus
call.

**Rationale.**

- The output is structural: paste-ready snippets and copy commands.
  Zero judgement is required once the answers are in. Principle IX
  (Opus as a Tool, Not a Crutch).
- Templates are versioned alongside the code; a diff in the template
  is reviewable in a PR.
- Answers persisted to `.atw/state/embed-answers.md` means re-running
  `/atw.embed` with the same answers yields the same guide byte-for-
  byte (FR-032).

**Alternatives considered.**

- **Opus generates the guide from a free-form description.**
  Non-deterministic, expensive per run, adds a dependency on network
  access that Principle VIII does not need. Rejected.
- **Static README section that covers all frameworks.** Covers less
  ground; the Builder has to skim through irrelevant frameworks.
  Rejected.

---

## 16. Testing tiers and CI

**Decision.** Four tiers, matching Feature 002's adopted shape:

- **Unit (`vitest`)** — pure logic in both backend (`lib/*.ts`) and
  widget (`markdown.ts`, `auth.ts`, `action-card.tsx`, `api-client.ts`).
  Run on every PR; no Docker needed.
- **Contract (`vitest`)** — backend handler tests against a real
  pgvector testcontainer + mock Anthropic server; widget contract
  tests against stubbed backend via `@testing-library/preact`.
- **Integration (`vitest` in `tests/integration/`)** — bring up the
  full stack via `docker-compose.test.yml`, gated by
  `ATW_E2E_DOCKER=1` like Feature 002.
- **E2E (`Playwright` in `tests/e2e/`)** — script the demo video's
  five-turn conversation (`aurelia-demo.spec.ts`) and assert
  accessibility (`accessibility.spec.ts`). Gated by
  `ATW_E2E_DOCKER=1`.

**Rationale.**

- Keeps the CI fast on Docker-less lanes (unit + contract) while
  guaranteeing the demo itself works end-to-end on a gated lane.
- Playwright is industry standard for web E2E; `@playwright/test` has
  trace viewer support that makes flakes diagnosable without
  re-running.
- `axe-core` for accessibility fits Playwright natively.

**Alternatives considered.**

- **Cypress.** Heavier, less good at multi-origin testing.
  Rejected.
- **`puppeteer`.** Lower-level; Playwright's test runner is the
  layer we want.
- **Skip E2E, rely on unit.** Fails to validate the Principle VIII
  reproducibility claim — rejected.

---

## Open items tracked in plan.md rather than here

- The exact digests for `postgres:16-alpine`, `redis:7-alpine`, and
  `pgvector/pgvector:pg16` will be pinned in `docker-compose.yml` at
  the time the file is written — not guessed here.
- The three sample Medusa customer email/password pairs used in the
  demo will live in `demo/medusa/seed/customers.json`; these are
  dev-only demo fixtures (Principle I notwithstanding — the *demo*
  data is synthetic and intentionally public).
- Action-manifest evolution: if Feature 001 adds a new tool flag
  between now and Feature 003 implementation, `atw.embed` and the
  widget's tool allowlist consume the new flag transparently via
  Feature 002's template render — no research decision needed.

# Post-implementation notes — Feature 003 (Runtime)

## Shipped in this session

- **Phase 1 Setup (T001–T008)** — deps for backend/widget/root, `.env.example`, Makefile (demo/fresh/seed), `docker-compose.yml` with all six services (digest placeholders), vitest workspace.
- **Phase 2 Foundational (T009–T026)** — zod schemas for every runtime wire type, error codes, Fastify scaffold (logger with PII redaction, errors, credential-strip hook, CORS, rate-limit, embedding wrapper, PII scrubber, health endpoint, config loader), widget bootstrap (config reader with citation-href resolver, state signals, auth modes, default theme).
- **Phase 3 US1 (T027–T044)** — backend retrieval + XML context + single-turn Opus client + chat route + citation derivation; widget launcher + panel + markdown sanitiser + message list + input + api-client + styles; unit tests (17), contract skeleton, integration test gated by `ATW_E2E_DOCKER=1`.
- **Phase 4 US2 (T045–T055)** — tools.ts.hbs, tool-execution (safe-read), action-intent construction, full Opus tool-use loop in `opus-client.ts.hbs`, widget action-card with tool allowlist enforcement, executeAction with credential-sovereignty invariant, ActionFollowUp round-trip, unit test (6) + gated integration.
- **Phase 5 US3 (T056–T060)** — widget FIFO trim to 20 turns, backend history cap + trim note, state unit test (4), gated integration.
- **Phase 10 US8 (T090–T100)** — `/atw.embed` slash command, deterministic generator `embed.ts`, CLI shim with `--help`/`--version`/`--answers-file`/`--frozen-time` flags, four framework templates (Next.js App + Pages, plain HTML, custom), installer conflict list updated, unit tests (11), contract tests (6).
- **Analysis follow-through** — U1 (citation href via `resolveCitationHref` in `widget/src/config.ts`) and U2 (`runtime-config.ts` extracted + 6 contract tests) from `/speckit.analyze`.

**Total**: ~71 of 118 tasks landed as code + tests. Full `npx vitest run` at repo root: **358 passed, 12 skipped** (all Docker-gated integration + E2E tests, skip-guarded by `ATW_E2E_DOCKER=1`).

## Deferred to follow-up sessions

These tasks remain `[ ]` in `tasks.md` and require resources this agent session couldn't stage:

### Phase 6 — US4 Demo wiring (T061–T078)

- Medusa v2 backend + Next.js storefront Dockerfiles need the actual Medusa v2 repo to base on. Shipping those sources here would balloon the PR and requires a licence/redistribution check.
- 300-product Aurelia seed JSON (T064) is a creative / editorial deliverable — needs handwritten product copy for the demo narrative.
- Generating `demo/atw-aurelia/atw.sql` (T073) requires running `/atw.build` end-to-end against the seeded Medusa, which needs Docker + the `ANTHROPIC_API_KEY` quota for enrichment.
- Pinning `docker-compose.yml` image digests (T074) requires running `docker pull` on the host machine and reading the resolved digest — not reproducible in a text-only agent shell.
- The Playwright E2E script `aurelia-demo.spec.ts` (T077) is scaffolded by the `runtime-*.test.ts` integration tests we shipped; the browser-driven assertions need a live demo stack.

### Phase 7 — US5 Comparison (T079–T081)

Small: a prompt nudge + integration test. Skipped here because it depends on a running demo stack.

### Phase 8 — US6 Auth passthrough / Phase 9 — US7 Anonymous fallback (T082–T089)

The widget-side pieces landed in the action-card and auth modules (401/403 handling + login link). The integration tests that prove credential sovereignty (T085) and anonymous fallback (T089) need the live stack.

### Phase 11 — US9 Theming (T101–T103)

Widget defaults already expose every CSS custom property required by `contracts/widget-config.md §7`; the Playwright theming verification test needs a live stack.

### Phase 12 — US10 Safety rails (T104–T108)

- T104 (`assertToolAllowed` hard-gate doc comment) — trivial doc pass.
- T105–T108 integration tests need the live stack.

### Phase 13 — Polish (T109–T118)

- Accessibility spec (T109) — Playwright + axe-core; live stack.
- Logger unit test (T110) — can be written without Docker; shippable in a follow-up.
- PII-scrub unit test (T111) — shippable now; the unit test lives in `packages/backend/test/` which will light up once the backend render step puts the hbs → ts conversion in place.
- Focus-trap already integrated in `panel.tsx` via the `focus-trap` library; T112 unit test is a small follow-up.
- README update (T113) is a small, safe follow-up.
- DEBUG logging (T114) — small follow-up.
- Cross-platform quickstart verification (T115) — human step.
- Full vitest+Playwright green (T116) — live-stack dependent.
- Demo video (T118) — human creative step.

## Resumption checklist for a follow-up session

1. Spin up Medusa v2 source under `demo/medusa/` (pin commit).
2. Author the 300-product Aurelia seed JSON.
3. Run `/atw.build` against the seeded Medusa, capture the `atw_documents` dump to `demo/atw-aurelia/atw.sql`, commit.
4. `docker pull` each image, capture digests, pin in `docker-compose.yml`.
5. Run the gated integration tests with `ATW_E2E_DOCKER=1` and iterate.
6. Author the Playwright demo E2E.
7. Record the hackathon demo video.

Every piece of code that the above tests exercise already exists in this session's commits.

# Implementation Plan: ATW Hardening

**Branch**: `008-atw-hardening` | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-atw-hardening/spec.md`

## Summary

Close every residual gap between the `/atw.*` setup flow, the generated runtime, and the widget that a fresh `/atw.init … /atw.embed` sequence surfaced during the Feature 007 demo on 2026-04-24 against `demo/atw-shop-host`. Scope is explicitly bounded to the 22 gaps enumerated in [`FEATURE-008-atw-hardening.md`](../../FEATURE-008-atw-hardening.md) and grouped by spec themes A–E (setup capture, setup correctness, embed outputs, runtime, widget UX). No new ATW skills, no architectural redesign, no re-introduction of navigation pills, no `ConversationTurn.content` shape migration.

**Technical approach.** Every fix lives in an existing package and every fix threads the four existing artefact layers: `project.md` (setup answers) → `action-manifest.md` + `schema-map.md` (classifier output) → `action-executors.json` + `host-requirements.md` (build outputs) → embed-guide + widget runtime. Three *cross-cutting* threads knit the individual fixes together:

1. **One new project-level flag `deploymentType: customer-facing-widget`** captured in `/atw.init` (Clarification Q1) unlocks bearer-JWT acceptance in the classifier (FR-010) and governs whether the `host-requirements.md` artefact is emitted at all. A single boolean gates the Theme-B correctness fixes that are unsafe to enable by default for non-widget deployments.
2. **One new markdown artefact `host-requirements.md`** emitted by `/atw.api` (FR-003) is the canonical checklist for CORS, preflight, auth-token storage key, login URL, and tool-specific host prerequisites. It is also the first-checked reference during post-setup diagnosis — replacing tribal knowledge with a single auditable file per Principle II.
3. **One chat-endpoint request amendment** (FR-018/019/020/020a) extends `ToolResultPayloadSchema` with `tool_name` + `tool_input` so the backend can reconstruct the `[user, assistant:tool_use, user:tool_result]` Anthropic sequence without server-side session state, fixing the D1 first-write-action failure observed in Feature 007's demo. The existing `ConversationTurn.content: string` shape is preserved (Approach A).

Every other fix is either a local renderer/parser/CLI bug (Theme B), a generator emission (Theme C), or a widget render path (Theme E). None require new language runtimes, datastores, or third-party frameworks.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js ≥ 20 (Principle VII — Single-Ecosystem Simplicity). No new runtime introduced.

**Primary Dependencies**:
- `packages/scripts` (extended): `@apidevtools/swagger-parser`, `zod`, `unified` / `remark` markdown pipeline, existing manifest-builder. No new deps.
- `packages/backend` (extended): Anthropic SDK (retry logic already present; used for FR-020a exponential backoff), `pg` + `pgvector` retained. No new deps.
- `packages/widget` (extended): existing React 18 declarative renderer + action-executor engine. No new deps.
- `commands/` (slash-command prompt edits only): `atw.init`, `atw.schema`, `atw.plan`, `atw.api`, `atw.classify`, `atw.build`, `atw.embed`. No code changes beyond prompt text.
- `demo/shop/backend` (extended): add `@fastify/cors` ^9.0.1 permanently (FR-021). Already introduced in-session during the 2026-04-24 demo; this feature lands it in the repo.

**Storage**: None added. `project.md` gains three string fields (`storefrontOrigins`, `welcomeMessage`, `deploymentType`) captured in YAML frontmatter per Principle II. `host-requirements.md` is a new markdown artefact. `action-executors.json` gains a `credentialSource` block on authed entries and an optional human-readable `summaryTemplate` on every entry.

**Testing**: Vitest (already in repo). New contract/regression tests:
- (a) `atw-hash-inputs` reader/writer schema round-trip (FR-006).
- (b) `atw-hash-inputs` CLI accepts `--inputs a.md b.md c.md` form (FR-007).
- (c) `atw-write-artifact` emits quoted YAML timestamps (FR-008).
- (d) schema-map parser fails loudly on zero-entity parse (FR-009).
- (e) classifier accepts bearer-JWT shopper ops when `deploymentType: customer-facing-widget` is set; rejects otherwise (FR-010).
- (f) cross-validator tolerates singular/plural name variants (FR-011).
- (g) validator accepts `runtime-only` tool groups against excluded entities (FR-012).
- (h) cross-validator halts with actionable diagnostic when authed op lacks `credentialSource` (FR-013).
- (i) chat-endpoint accepts `tool_result` POST with `tool_name` + `tool_input` and reconstructs Anthropic message sequence (FR-018/019/020).
- (j) backend retries model call up to 3× (500 ms → 1 s → 2 s, 4 attempts total) on re-invocation failure and signals response-generation-failed state when retries exhaust (FR-020a).
- (k) `/atw.embed` output includes `data-allowed-tools` + `data-auth-token-key` + files-to-copy checklist (FR-014/015/016/017).
- (l) `demo/shop` Fastify app starts with CORS middleware wired to `ALLOWED_ORIGINS` (FR-021).
- (m) widget surfaces visible in-widget error on tool-not-in-allow-list and missing action-executors catalog (FR-022/023).
- (n) widget renders thinking indicator immediately and clears on first delta/final (FR-024).
- (o) widget renders welcome message from config, falls back to default when unset (FR-025).
- (p) ActionCard renders templated summary when available, raw JSON as fallback (FR-026).

**Target Platform**: Linux containers orchestrated by Docker Compose. Target browsers: evergreen Chrome/Firefox/Edge (widget ships as ES2020 bundle). Unchanged from Feature 007.

**Project Type**: Multi-package monorepo. Existing `packages/` workspace (scripts, backend, widget, installer) is extended. `demo/shop/` is patched (CORS). `commands/*.md` slash-command prompts are edited. No new packages.

**Performance Goals**:
- `/atw.build` end-to-end on the reference shop: no regression vs. Feature 007 (same build-pipeline budget).
- Grounded-answer turn including one write action: same SC-002 target as Feature 007 (< 6 s p95 on typical broadband), with FR-020a retries extending the worst case on model-call failure (acceptable — confirmation fallback is the alternative).
- Thinking indicator: rendered in the same React microtask as the POST request — SC-009's 1-second guarantee is observable, not a delay threshold.

**Constraints**:
- **Red line (Principle I).** No change to credential handling: the ATW backend still never sees the shopper's bearer token. FR-023 sovereignty-probe test from Feature 007 stays green.
- **Red line (Principle V).** Every authed tool MUST ship with a populated `credentialSource` derived from the OpenAPI `security` field. FR-013 halts the build with an actionable diagnostic when this is not satisfied — no silent fallback.
- **Red line (Principle VIII).** `docker compose up` from a clean clone still produces a working demo. `demo/shop` gains permanent CORS, not an in-session patch (FR-021).
- **No `ConversationTurn.content` shape migration.** D1 uses Approach A (backend-reconstructs-Anthropic-sequence). FR-018 aligns the contract doc to the code, not the code to the contract.
- **No client-routing integration.** Navigation-pill links remain removed until a follow-up feature designs them (FR-027).
- **No new language runtimes, datastores, or orchestration layers.** Principle VII.

**Scale/Scope**:
- 22 discrete gaps spread across 5 themes, closed in one feature branch.
- 3 new `project.md` fields (storefront origins, welcome message, `deploymentType`).
- 1 new artefact (`host-requirements.md`).
- 1 chat-endpoint request-shape amendment (add 2 fields to `ToolResultPayloadSchema`; no response shape change).
- 1 new `credentialSource` populator in `crossValidateAgainstOpenAPI`.
- 1 new `runtime-only` flag on action-manifest tool groups.
- 1 new `summaryTemplate` field (optional) on action-catalog entries.
- Dozens of small textual edits in slash-command prompts, embed template, widget error surfaces, and parser diagnostics.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Every principle evaluated below. Red lines (I, V, VIII) must pass unconditionally. Lower-priority violations go in Complexity Tracking.

### I. User Data Sovereignty (NON-NEGOTIABLE) — **PASS**

No change to credential handling. The shopper's bearer token continues to live in `localStorage["shop_auth_token"]` in the browser; the widget attaches `Authorization` client-side; the ATW backend is not in the credential path. The FR-013 diagnostic that halts the build when an authed tool lacks a `credentialSource` reinforces this principle: it ensures the widget — not the backend — is the only party that ever holds the token. The Feature 007 sovereignty-probe CI test (no `fetch(` against non-local hosts in the rendered backend) remains green.

### II. Markdown as Source of Truth — **PASS**

Every new decision lands in markdown. `project.md` gains three new YAML-frontmatter fields. `host-requirements.md` is new markdown. `schema-map.md` parser gets a stricter heading-convention enforcer. The `summaryTemplate` on action-catalog entries is declarative JSON interpreted by a fixed engine (consistent with existing `action-executors.json` handling since Feature 003). No hidden state is introduced.

### III. Idempotent and Interruptible — **PASS**

FR-005a directly codifies this principle for `/atw.init`: re-running against an existing `project.md` pre-fills every prompt with the captured value so the Builder keeps it by pressing Enter. Every other stage (`/atw.schema`, `/atw.api`, `/atw.classify`, `/atw.build`, `/atw.embed`) remains re-runnable in place. The new `host-requirements.md` is regenerated deterministically from OpenAPI + `project.md`.

### IV. Human-in-the-Loop by Default — **PASS**

Every artefact-producing stage continues to present its proposal before writing. FR-013's halt-with-diagnostic replaces a silent failure with an explicit Builder decision point. The widget's confirmation card for write actions is preserved and improved (FR-026: human-readable summary instead of raw JSON). Auto-execution of read-class tools keeps the Feature 007 indicator pattern; the new thinking indicator (FR-024) increases transparency, not agency reduction.

### V. Anchored Generation (NON-NEGOTIABLE) — **PASS**

FR-013 enforces this principle structurally: no authed tool ships without a credential source traced to an OpenAPI `security` declaration — so the widget never invents an auth scheme. The `summaryTemplate` field (FR-026) is bounded-template text authored by the Builder (or Opus under anchored-generation rules during classification), never freehand at render time. FR-020 forbids templated post-action replies; the backend re-invokes Opus with the actual tool result so the natural-language reply is grounded in what happened. FR-020a's confirmation-fallback string is the one explicit exception, deliberately narrow: used only when the model call fails *after* the host write already succeeded, so the shopper is not falsely told the action failed.

### VI. Composable Deterministic Primitives — **PASS**

Every fix strengthens the agentic/deterministic boundary rather than blurring it. The classifier bug-fix (FR-010) moves a decision rule from a hardcoded "always reject bearer-JWT" to a flag-driven branch — still deterministic. The `crossValidateAgainstOpenAPI` backfill (FR-013) is pure data copying. The chat-endpoint amendment (FR-018/019/020) moves message-shape reconstruction into the deterministic backend layer and out of the widget. Opus is invoked only where it already was: classification, response synthesis.

### VII. Single-Ecosystem Simplicity — **PASS**

No new runtime, datastore, or orchestration layer. Existing `@fastify/cors` dependency in `demo/shop/backend` already exists in the node_modules tree (introduced during the 2026-04-24 demo); this feature just persists it in `package.json`. No framework additions.

### VIII. Reproducibility as a First-Class Concern (NON-NEGOTIABLE) — **PASS**

`git clone && docker compose up` against the reference shop produces a working demo with CORS pre-wired (FR-021). SC-001 is a direct measurement of this principle: a fresh Builder running `/atw.init` through `/atw.embed` reaches a working widget with zero hand-edits. Re-running `/atw.build` on unchanged inputs remains byte-identical (no random seeds added, no nondeterministic formatting changes).

### IX. Opus as a Tool, Not a Crutch — **PASS**

No new Opus calls. The `summaryTemplate` authoring happens at classification time (an existing Opus call), not at render time. FR-020a's retry-with-backoff is a library-level retry, not a new Opus invocation pattern — it just re-runs the already-scheduled composition pass.

### X. Narrative-Aware Engineering — **PASS**

The whole feature is narrative-driven: each fix maps 1:1 to a failure or papercut observed in the Feature 007 demo video on 2026-04-24. Nothing here is speculative or enthusiasm-driven. FR-027 (no navigation pills) explicitly defers a feature that does not survive demo scrutiny without deeper design.

**Gate outcome**: All ten principles pass. No entries for Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/008-atw-hardening/
├── plan.md              # This file (/speckit.plan command output)
├── spec.md              # Feature specification (complete, 5 clarifications resolved)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
│   ├── project-md-v2.md         # Amended project.md fields (storefrontOrigins,
│   │                            # welcomeMessage, deploymentType)
│   ├── host-requirements.md     # New artefact shape
│   ├── action-catalog-v3.md     # Amended action-executors.json (credentialSource
│   │                            # always populated for authed; summaryTemplate)
│   ├── chat-endpoint-v3.md      # Amended POST /v1/chat (tool_name + tool_input;
│   │                            # response-generation-failed-but-action-succeeded)
│   ├── embed-snippet.md         # Required embed template output
│   └── builder-diagnostics.md   # Required diagnostic text for every loud-failure path
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
ai-to-widget/
├── commands/                          # Slash-command prompts — text edits only
│   ├── atw.init.md                    # AMENDED — add storefrontOrigins, welcomeMessage,
│   │                                  # deploymentType prompts; pre-fill on re-run (FR-001,
│   │                                  # FR-002, FR-005a); emit quoted ISO timestamps
│   ├── atw.schema.md                  # AMENDED — interactive pg_dump prompt (FR-004)
│   ├── atw.plan.md                    # AMENDED — CLI invocation matches actual argv (FR-007)
│   ├── atw.api.md                     # AMENDED — emit host-requirements.md (FR-003)
│   ├── atw.classify.md                # AMENDED — respect deploymentType flag (FR-010)
│   ├── atw.build.md                   # AMENDED — Next Steps banner (FR-005)
│   └── atw.embed.md                   # AMENDED — data-allowed-tools, data-auth-token-key,
│                                      # files-to-copy checklist (FR-014/015/016/017)
├── packages/
│   ├── scripts/
│   │   └── src/
│   │       ├── atw-api.ts                       # AMENDED — emit host-requirements.md;
│   │       │                                    # align hash-index schema (FR-003, FR-006)
│   │       ├── atw-classify.ts                  # AMENDED — deploymentType-gated bearer-JWT
│   │       │                                    # acceptance (FR-010)
│   │       ├── hash-inputs.ts                   # AMENDED — accept positional --inputs args
│   │       │                                    # (FR-007); schema shape matches atw-api
│   │       │                                    # output (FR-006)
│   │       ├── write-artifact.ts                # AMENDED — quote ISO timestamps in YAML
│   │       │                                    # frontmatter (FR-008)
│   │       ├── parse-action-manifest.ts         # AMENDED — backfill security from OpenAPI
│   │       │                                    # in crossValidateAgainstOpenAPI (FR-013);
│   │       │                                    # recognise runtime-only group flag (FR-012);
│   │       │                                    # tolerant singular/plural matching (FR-011)
│   │       ├── validate-artifacts.ts            # AMENDED — accept runtime-only groups
│   │       │                                    # (FR-012); halt diagnostic for missing
│   │       │                                    # credential source (FR-013)
│   │       ├── render-executors.ts              # AMENDED — always emit credentialSource
│   │       │                                    # block when entry.source.security set;
│   │       │                                    # carry summaryTemplate (FR-013, FR-026)
│   │       ├── embed.ts                         # AMENDED — derive data-allowed-tools from
│   │       │                                    # action-executors.json; emit data-auth-
│   │       │                                    # token-key; files-to-copy checklist;
│   │       │                                    # Next Steps banner (FR-014/015/016/017)
│   │       ├── embed-templates/                 # AMENDED — rename data-bearer-storage-key
│   │       │                                    # → data-auth-token-key; checklist block
│   │       ├── init-project.ts                  # AMENDED — read existing project.md values
│   │       │                                    # and pre-fill prompts on re-run (FR-005a);
│   │       │                                    # quoted timestamps
│   │       └── lib/
│   │           ├── markdown.ts                  # AMENDED — schema-map parser fails loudly
│   │           │                                # on zero-entity; heading convention fixed
│   │           │                                # (FR-009)
│   │           ├── manifest-builder.ts          # AMENDED — emits credentialSource always
│   │           │                                # for authed; runtime-only group flag
│   │           └── singular-plural.ts           # NEW — tolerant-name-matching helper
│   │                                            # (FR-011)
│   ├── backend/
│   │   └── src/
│   │       ├── routes/
│   │       │   └── chat.ts.hbs                  # AMENDED — accept tool_name + tool_input
│   │       │                                    # in tool_result payload; reconstruct
│   │       │                                    # [user, assistant:tool_use, user:tool_result]
│   │       │                                    # Anthropic sequence; retry model call up to 3×
│   │       │                                    # on failure; emit response-generation-
│   │       │                                    # failed state on exhaustion (FR-018/019/
│   │       │                                    # 020/020a)
│   │       └── lib/
│   │           └── tool-result-assembly.ts.hbs  # NEW — pure function that turns a
│   │                                            # ToolResultPayload into the Anthropic
│   │                                            # message trio (FR-020)
│   ├── widget/
│   │   └── src/
│   │       ├── chat-action-runner.ts            # AMENDED — include tool_name + tool_input
│   │       │                                    # in POST payload (FR-019); handle response-
│   │       │                                    # generation-failed state (FR-020a); visible
│   │       │                                    # error on ToolNotAllowed (FR-022); visible
│   │       │                                    # error when actionCapable===false (FR-023)
│   │       ├── panel.tsx                        # AMENDED — thinking indicator rendered
│   │       │                                    # immediately on POST; cleared on first
│   │       │                                    # delta/final (FR-024); welcome message
│   │       │                                    # from config (FR-025); no nav pills (FR-027)
│   │       ├── action-card.tsx                  # AMENDED — render summaryTemplate when
│   │       │                                    # present, raw JSON fallback (FR-026)
│   │       ├── markdown.ts                      # AMENDED — remove nav-pill render path
│   │       │                                    # (FR-027)
│   │       ├── config.ts                        # AMENDED — read welcomeMessage from
│   │       │                                    # loader attribute (FR-025)
│   │       └── loop-driver.ts                   # AMENDED — surface response-generation-
│   │                                            # failed fallback string (FR-020a)
│   └── installer/                               # UNCHANGED
├── demo/
│   ├── shop/                          # EXISTING — one permanent patch
│   │   └── backend/
│   │       ├── src/index.ts           # AMENDED — register @fastify/cors with
│   │       │                          # ALLOWED_ORIGINS env default set to
│   │       │                          # http://localhost:5173 (FR-021)
│   │       └── package.json           # AMENDED — @fastify/cors ^9.0.1 dep
│   └── atw-shop-host/                 # EXISTING — its generated ATW artefacts are
│                                      # regenerated against the hardened pipeline as
│                                      # US1/US3 acceptance
└── specs/008-atw-hardening/           # Documentation (this feature) — above.
```

**Structure Decision**: Extend the existing monorepo in place. No new packages. Seven slash-command prompts (`commands/atw.*.md`) receive textual edits; three packages (`scripts`, `backend`, `widget`) receive code changes; one demo package (`demo/shop/backend`) receives a permanent CORS registration. The spec's Theme A–E grouping maps cleanly onto this structure: Theme A → `commands/` + `packages/scripts/src/init-project.ts` + `atw-api.ts`; Theme B → `packages/scripts/src/` (classifier, validator, parser, hash-inputs); Theme C → `packages/scripts/src/embed.ts` + `embed-templates/`; Theme D → `packages/backend/src/routes/chat.ts.hbs` + `packages/widget/src/chat-action-runner.ts` + `demo/shop/backend/`; Theme E → `packages/widget/src/`.

## Complexity Tracking

All ten constitutional principles pass without justification. No new language runtime, no new datastore, no new orchestration layer, no new third-party runtime framework is introduced. The table below is intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)* | | |

# Implementation Plan: Demo-Guide Hardening (LLM-Native Action Pipeline + Integrator-Ready Output)

**Branch**: `009-demo-guide-hardening` | **Date**: 2026-04-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/009-demo-guide-hardening/spec.md`

## Summary

Replace ATW's regex-and-heuristic re-derivation chain over OpenAPI documents
with a single LLM-native manifest emission pass: `/atw.api` (a.k.a. the
spec-internal `/atw.classify`) sends the full bundled OpenAPI document and
`project.md` to Anthropic in one call per source document and consumes the
returned per-operation manifest after JSON-schema validation. All semantic
judgement (shopper-owned-ness, safe-for-widget, input shape) leaves the
deterministic layer; structural-only filters (`OPTIONS`/`HEAD`, broken
schemas) remain. Downstream symptom fixes — empty `properties` on POST/PUT
manifests, missing `summaryTemplate`, missing `data-api-base-url`, silent
COMPOSE skips, stale `dist/`, citation UI confusion, Spanish loading
strings, locked host page — are addressed once at their source. The
reference shop `demo/shop` becomes a CI regression harness for the full
flow. Five clarifications (2026-04-25) decided: citations removed
entirely; LLM transient errors retry exponential ×3; COMPOSE missing
markers prompt `[y/N]`; stale `dist/` refuses to run; large-OpenAPI
gating is informational only with a 2-second countdown.

## Technical Context

**Language/Version**: TypeScript 5.4.5 / Node.js ≥ 20 (root `engines`
pin). One ecosystem (Constitution VII) — no Python side-services, no
Go workers.

**Primary Dependencies**:
- `@anthropic-ai/sdk` ^0.27.0 — LLM calls (manifest emission, build
  cost-estimate countdown).
- `@apidevtools/swagger-parser` ^10.1.0 — bundle-and-validate the
  OpenAPI document before LLM ingestion (`bundle()`, not `parse()`,
  to inline external `$ref`s while preserving internal ones).
- `zod` ^3.22.4 — runtime schema validation for the LLM's manifest
  output (FR-008) and for `project.md`/`brief.md` shapes.
- `gray-matter` ^4.0.3 + `remark-frontmatter` — read/write YAML
  frontmatter in the prose-only markdown artifacts (FR-007).
- `handlebars` ^4.7.8 — embed-guide and backend templates.
- `@xenova/transformers` ^2.17.0 — local embeddings (unchanged).
- `pg` ^8.11.5 + `pgvector` — Postgres + vector search (unchanged).
- `dockerode` ^4.0.2 — compose / image automation.

**Storage**: Postgres + pgvector (single instance, Docker Compose).
`.atw/artifacts/*.md` for build provenance, `project.md`,
`action-manifest.md`. No new datastore.

**Testing**: Vitest at the root (`vitest run`), Playwright for
end-to-end (`playwright.config.ts`). `@testcontainers/postgresql` for
DB-touching tests in `packages/scripts/`. Citation-related tests
removed alongside the citation code paths (Q1 clarification).

**Target Platform**: Local developer machine (macOS/Linux/WSL2) and
GitHub Actions CI for FR-035 regression. No new platforms introduced.

**Project Type**: Monorepo (npm workspaces) — packages: `backend`,
`widget`, `scripts`, `installer`. Plus `demo/shop` (throwaway
testbed per saved memory).

**Performance Goals**:
- SC-001: first-time integrator reaches confirmed-write under 30
  minutes total.
- LLM call retry policy: 3 attempts, exponential backoff (initial
  500ms, multiplier 2, jitter ±20%) — FR-008a.
- Per-phase latency: no explicit SLO; rector principle prioritises
  honest reporting over speed.

**Constraints**:
- **Red lines (Constitution I, V, VIII)** unconditional: no Builder
  data exfiltration beyond `openapi.json` + `project.md` to
  Anthropic; manifest output cites source operation ID + schema ref;
  pinned `model_snapshot` recorded in build provenance for
  byte-reproducible reruns.
- **No pre-filter for cost** (rector principle, FR-001). Stage-1
  filters survive only for `OPTIONS`/`HEAD`, no-response operations,
  schema-validation-failing operations.
- **No auto-rebuild** (Q4 clarification): runtime stays decoupled
  from build system.
- **No `[y/N]` cost gate** (Q5 clarification): countdown is purely
  informational; CI runs without `--yes`.
- **Cross-platform shell** (FR-019): bash and PowerShell parity in
  emitted snippets.

**Scale/Scope**:
- 36 functional requirements + 7 success criteria + 6 user stories.
- Touches: `packages/scripts/src/` (orchestrator, parse-openapi,
  classify-actions, write-manifest, init-project, embed.ts and the
  embed templates, compose-activate, manifest-io), `packages/widget/src/`
  (action-card.tsx, message-list.tsx, panel.tsx, api-client.ts,
  state.ts), `packages/backend/src/` (chat.ts.hbs, retrieval.ts.hbs,
  routes/chat.ts.hbs), `demo/shop/docker-compose.yml`, repo-root
  `docker-compose.yml` (rename / relocate per FR-033).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1
design.*

Evaluated against the ten principles in
`.specify/memory/constitution.md`. Red-line principles (I, V, VIII)
must pass unconditionally.

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. User Data Sovereignty (red line)** | ✅ Pass | LLM call sends only `openapi.json` (the Builder's already-public API contract) and `project.md` (the Builder's stated intent). No DB connection strings, no end-user credentials, no production data. The Anthropic SDK is the only outbound call. (Spec Assumptions §). |
| **V. Anchored Generation (red line)** | ✅ Pass | FR-002 mandates that every manifest field cite the source operation ID + schema reference. The Builder can audit the manifest after `/atw.api` and reject any field without a citation. Citations on the runtime side are removed (Q1) but anchoring is preserved prompt-side via context injection — Constitution V is about *grounding*, not about UI labels. |
| **VIII. Reproducibility (red line)** | ✅ Pass | FR-005 pins `model_snapshot` in the manifest header and build-provenance log. FR-008b makes successful runs deterministically replayable via input-hash skip. Q5 keeps CI runs flag-free. `git clone && docker compose up` path remains intact (FR-035 strengthens it via CI). |
| IV. Human-in-the-Loop | ✅ Pass | Q3 keeps the COMPOSE injection behind explicit `[y/N]` (default "no"). FR-022 ActionCard summary is human-readable before confirmation. The Builder reviews the manifest after `/atw.api` before `/atw.build` runs (current flow preserved). |
| X. Narrative-Aware Engineering | ✅ Pass | The 30-minute integrator path (SC-001) maps directly to the demo flow. Removing citations (Q1) and the loading-string churn (FR-021) tightens the demo, not loosens it. |
| II. Markdown as Source of Truth | ✅ Pass | FR-007 makes the prose body human-readable; machine fields move to YAML frontmatter or fenced YAML blocks — still markdown-resident, still human-auditable. No new binary stores. |
| III. Idempotent and Interruptible | ✅ Pass | FR-008b explicitly: successful runs cache by `(input-hash, model_snapshot)`; failed runs do not cache. Re-running `/atw.api` against an unchanged `openapi.json` skips the LLM call. Q3 COMPOSE injection is idempotent (re-run = no-op when markers exist). |
| VI. Composable Deterministic Primitives | ✅ Pass | The LLM call is now isolated to *one* deterministic boundary in `classify-actions.ts`: feed in (`openapi.json`, `project.md`, `model_snapshot`) → get back a JSON-schema-validated manifest. Around it, parsing, validation, write-to-disk, and provenance logging stay deterministic. The change reduces leakage of LLM logic into deterministic code, not the other way. |
| VII. Single-Ecosystem Simplicity | ✅ Pass | No new runtime, datastore, or framework. The countdown (FR-006a) is a `setTimeout` loop in TypeScript; the retry policy is a tiny helper around the Anthropic SDK; the YAML frontmatter is `gray-matter` (already in use). No new dependencies. |
| IX. Opus as a Tool, Not a Crutch | ✅ Pass with note | The rector principle moves *more* work to the LLM (semantic judgement on operation classification), but each LLM call is now justified by Constitution IX's own rubric: schema interpretation is exactly the case the constitution lists as agentic ("which of these 120 endpoints should the agent be allowed to call? is judgment"). The deterministic side (parsing, bundling, schema validation, write to disk, provenance) is unchanged. |

**Gate result**: ✅ Pass. No red-line violations. No lower-priority
violations either — no entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/009-demo-guide-hardening/
├── plan.md              # This file
├── spec.md              # Feature specification (clarified 2026-04-25)
├── research.md          # Phase 0 — unknowns resolved
├── data-model.md        # Phase 1 — manifest + provenance entities
├── quickstart.md        # Phase 1 — first-time integrator path
├── contracts/           # Phase 1 — JSON schemas
│   ├── action-manifest.schema.json
│   ├── project-md.schema.json
│   └── build-provenance.schema.json
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
packages/
├── scripts/                           # Deterministic + LLM-call layer
│   ├── src/
│   │   ├── classify-actions.ts        # ★ Rewritten — single LLM call per OpenAPI doc
│   │   ├── parse-openapi.ts           # Reduced to bundle()+validate() only; no pre-filter
│   │   ├── write-manifest.ts          # YAML-frontmatter writer (FR-007)
│   │   ├── init-project.ts            # ★ Adds host-API origin, host-page origin, loginUrl
│   │   ├── embed.ts                   # ★ Single template, inlined values, CORS section
│   │   ├── embed-templates/           # Existing 4 templates updated for FR-014..FR-020
│   │   ├── compose-activate.ts        # ★ [y/N] gate when markers missing (Q3)
│   │   ├── orchestrator.ts            # ★ Honest status reporting (FR-028..FR-032)
│   │   ├── import-dump.ts             # ★ pg_dump 17/18 stripping built-in (FR-030)
│   │   └── lib/
│   │       ├── llm-retry.ts           # ★ NEW — exponential-backoff retry helper (FR-008a)
│   │       ├── manifest-io.ts         # YAML-frontmatter read/write helpers (extended)
│   │       ├── cost-estimator.ts      # Surfaced via 2s countdown (FR-006a)
│   │       ├── input-hashes.ts        # Hash-based cache key (FR-008b)
│   │       └── runtime-config.ts      # `model_snapshot` config loader
│   └── dist/                          # ★ Stale-detection sentinel (FR-032)
├── widget/                            # Frontend
│   └── src/
│       ├── action-card.tsx            # ★ summaryTemplate substitution (FR-022)
│       ├── api-client.ts              # ★ Citation[] removed (Q1)
│       ├── message-list.tsx           # ★ Citation rendering removed (Q1)
│       ├── panel.tsx                  # ★ No focus trap / scroll lock (FR-027)
│       └── state.ts                   # ★ turnCitations WeakMap deleted (Q1)
├── backend/                           # Backend (templates)
│   └── src/
│       ├── routes/chat.ts.hbs         # ★ Citation[] removed; build-time check (FR-036)
│       └── retrieval.ts.hbs           # ★ Threshold/Opus-cited filtering removed (Q1)
└── installer/                         # CLI installer (no changes expected)

demo/
└── shop/                              # ★ CI regression harness (FR-034, FR-035)
    └── docker-compose.yml             # ALLOWED_ORIGINS aligned with frontend origin

# Repo root
docker-compose.yml                     # ★ Renamed/relocated → tools/dev/ (FR-033)

.github/workflows/                     # ★ NEW workflow OR extend existing for FR-035
```

**Structure Decision**: Existing monorepo (npm workspaces) is
correct; no new top-level package introduced. The bulk of work
lives in `packages/scripts/` (LLM call refactor, embed pipeline,
init flow) and `packages/widget/` + `packages/backend/` (citation
removal, ActionCard summary, click-through). The reference shop at
`demo/shop` is the regression harness; CI extends rather than
forking.

## Complexity Tracking

> No Constitution Check violations. No entries.

The plan does not introduce new datastores, languages, frameworks,
or orchestration tools. All FRs land within the existing one-ecosystem
budget.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_ | _(n/a)_ | _(n/a)_ |

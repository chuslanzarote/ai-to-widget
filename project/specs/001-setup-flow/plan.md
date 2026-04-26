# Implementation Plan: Setup Flow (Feature 001)

**Branch**: `001-setup-flow` | **Date**: 2026-04-21 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification at `specs/001-setup-flow/spec.md`; upstream
context in `constitution.md`, `PRD.md`, and `examples/`.

## Summary

Deliver the AI to Widget **setup** half of the product: a one-command npm
installer (`npx create-atw@latest`) plus five Claude Code slash commands
(`/atw.init`, `/atw.brief`, `/atw.schema`, `/atw.api`, `/atw.plan`) that
produce five markdown artifacts describing the Builder's client under
`.atw/`. Implementation is **TypeScript on Node.js ≥ 20**, organized as an
**npm-workspaces monorepo** with two publishable packages
(`@atw/installer`, `@atw/scripts`) plus top-level data directories
(`commands/`, `templates/`) that hold the markdown command definitions and
files the installer copies into a Builder's project. LLM reasoning happens
only inside the slash commands (Claude Code drives the call); every
deterministic step — SQL parsing, OpenAPI parsing, artifact write, change
detection — is a typed Node script invoked from the markdown command. No
Postgres container, no embeddings, no runtime code.

## Technical Context

**Language/Version**: TypeScript 5.4+, Node.js ≥ 20 LTS (`engines.node >=20`)
**Primary Dependencies**:
- Installer (`@atw/installer`): `commander` (CLI parsing), `chalk` (colored
  output), `fs-extra` (cross-platform filesystem), `write-file-atomic`
  (atomic writes with Windows rename-over-existing safety).
- Scripts (`@atw/scripts`): `pgsql-ast-parser` (Postgres-aware SQL AST),
  `@apidevtools/swagger-parser` (OpenAPI 3.x + Swagger 2.0 detection),
  `zod` (runtime type validation of internal JSON + artifact frontmatter),
  `gray-matter` + `unified`/`remark-parse` (markdown artifact loading for
  idempotent re-runs), `write-file-atomic`.
- No Anthropic SDK is required in this feature — LLM calls happen inside
  Claude Code's slash-command execution model, not inside the Node
  auxiliary scripts (per Principle VI).

**Storage**: filesystem only.
- `.atw/config/*.md`, `.atw/artifacts/*.md` — human-readable artifacts.
- `.atw/state/input-hashes.json` — SHA-256 content hashes for idempotency.
- `.atw/inputs/` — optional staging area for SQL dumps and OpenAPI files
  (gitignored; lifecycle owned by the Builder per FR-048).
- Postgres / pgvector are deferred to Feature 002.

**Testing**: `vitest` (TypeScript-native, Node ESM-friendly). Two tiers:
(1) `packages/*/test/**/*.test.ts` unit tests for each auxiliary script;
(2) `tests/integration/**/*.test.ts` that spawn the installer and assert
the produced tree. Fixtures for the Aurelia reference demo (SQL schema +
OpenAPI spec) live under `tests/fixtures/aurelia/` and match the entities
and endpoints assumed by `examples/`.

**Target Platform**: macOS, Linux, and WSL2-on-Windows — all requiring
Node 20, Docker, and Claude Code already installed (per Principle VIII
quickstart test matrix).

**Project Type**: **npm-workspaces monorepo** (single ecosystem per
Principle VII). Two publishable packages, two data directories, one test
root. No Turborepo / Nx / pnpm — plain npm workspaces are sufficient at
this scope.

**Performance Goals**:
- SC-001: installer finishes in < 60 seconds on a reasonable-network
  machine.
- SC-012: `/atw.schema` on ≥ 300 tables completes in < 5 minutes;
  `/atw.api` on ≥ 120 endpoints completes in < 2 minutes.
- SC-002: the full five-command reference run completes in < 30 minutes of
  wall-clock Builder time.

**Constraints**:
- Installer npm-install footprint < 10 MB in the Builder's project.
- Total LLM spend for one full reference run < USD 2 (SC-009).
- No Python runtime (Principle VII).
- Zero telemetry, zero network calls except to the LLM API and (in
  `/atw.api` only) a Builder-supplied OpenAPI URL (FR-042).

**Scale/Scope**: Reference integration is Aurelia on Medusa — ≈ 300
business entities, ≈ 120 API operations. Large-schema chunking (FR-024)
kicks in above 100 tables or 500 columns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Red-line principles (I, V, VIII) — MUST pass unconditionally

| # | Principle | Plan compliance |
|---|---|---|
| I | **User Data Sovereignty** | **PASS.** FR-018 categorically bans database connection strings. The SQL input pathway is file/paste/staged-input only — no live DB. The auxiliary scripts make zero network calls. FR-042 restricts network to the LLM API plus a Builder-supplied OpenAPI URL. No credential material is stored or logged. |
| V | **Anchored Generation** | **PASS.** Every classification carries evidence (FR-020). `/atw.brief` synthesis is anchored to Builder statements only (FR-013). Deterministic parsers produce the factual JSON; LLM output operates over that JSON + the brief, never over imagination. The 50-row-per-table sample cap (FR-016) keeps anchoring bounded. |
| VIII | **Reproducibility** | **PASS.** `quickstart.md` is the single path from `git clone` to a working demo. `package-lock.json` is committed; every runtime dep pins a major.minor version. Hashing is deterministic (SHA-256 over LF-normalized input). Fixtures for the Aurelia demo are committed to the repo. CI validates the quickstart on macOS / Linux / WSL2 before the hackathon deadline. |

### Defaults (II, III, IV, VI, VII, IX, X)

| # | Principle | Plan compliance |
|---|---|---|
| II | Markdown as Source of Truth | Every output artifact is `.md`. Idempotency state uses JSON *inside* `.atw/state/` only for hashes — no structured decisions live there. |
| III | Idempotent & Interruptible | FR-039, FR-049, FR-050 codify the semantics. Two-level change detection in `hash-inputs.ts` + structural-diff helper. Command-level atomicity: no mid-command draft persisted. |
| IV | Human-in-the-Loop | Every `/atw.*` command writes only after explicit Builder confirmation (FR-041, FR-023, FR-032, FR-036). Installer is the one exception — it is deterministic scaffolding, not a material decision. |
| VI | Composable Deterministic Primitives | Six auxiliary scripts, one responsibility each (FR-045). Typed I/O. Non-zero exit + actionable stderr on failure. LLM calls happen only in the markdown-driven conversation layer. |
| VII | Single-Ecosystem Simplicity | TypeScript + Node 20. No Python for embeddings (Feature 002 problem). No Turborepo — plain npm workspaces. |
| IX | Opus as a Tool | 0 LLM calls in `/atw.init`, 1 in `/atw.brief`, 1–5 in `/atw.schema`, 1–3 in `/atw.api`, 1 in `/atw.plan`. Deterministic work (parsing, hashing, diffing, writing) is code. Budget verified by SC-009. |
| X | Narrative-Aware Engineering | Feature 001 drives the demo's setup phase on video. Deferred-but-visible decisions (installer distribution channel) resolved to the simpler option (npm) to keep the demo reproducible. |

**Complexity Tracking**: empty. No principle is violated; no complexity
justification required.

### Post-design re-check (after Phase 1 artifacts)

Re-evaluated after `research.md`, `data-model.md`, `contracts/*.md`,
and `quickstart.md` were written:

- **Red lines (I, V, VIII)**: unchanged — still PASS. No new
  network-dependent component, no fabrication surface, and the
  quickstart crystallizes the reproducibility path.
- **II. Markdown as Source of Truth**: the only JSON file Feature 001
  persists under `.atw/` is `state/input-hashes.json`, which is
  *derivative* (recomputable from inputs at any time) and holds hashes
  only — no Builder decisions. Principle II is upheld.
- **VI. Deterministic primitives**: the six scripts were sized so each
  has exactly one responsibility; [contracts/scripts.md](./contracts/scripts.md)
  locks the CLI contract.
- **VII. Single ecosystem**: every new dependency chosen in
  [research.md](./research.md) is pure JavaScript / TypeScript. No
  native builds, no Python, no Turborepo.

Plan is gate-clean for `/speckit-tasks`.

## Project Structure

### Documentation (this feature)

```text
specs/001-setup-flow/
├── plan.md              # This file
├── research.md          # Phase 0 output — technical decisions
├── data-model.md        # Phase 1 output — artifact & internal JSON shapes
├── quickstart.md        # Phase 1 output — Builder-facing reproducibility path
├── contracts/           # Phase 1 output
│   ├── slash-commands.md    # input / output contract for each /atw.* command
│   ├── scripts.md           # CLI contract for each auxiliary script
│   └── artifacts.md         # pointer + structural contract for .atw/ outputs
└── tasks.md             # Phase 2 output (generated by /speckit-tasks)
```

### Source Code (repository root)

```text
ai-to-widget/
├── package.json                      # npm workspaces root (private: true)
├── package-lock.json                 # committed for Principle VIII
├── tsconfig.base.json                # shared TS config
├── .nvmrc                            # "20"
├── .gitignore
├── vitest.config.ts                  # shared test config
├── packages/
│   ├── installer/                    # published as `create-atw`
│   │   ├── src/
│   │   │   ├── index.ts              # CLI entry
│   │   │   ├── scaffold.ts           # creates .atw tree + command files
│   │   │   ├── conflicts.ts          # --force / conflict detection
│   │   │   ├── gitignore.ts          # .gitignore block management (FR-048)
│   │   │   └── messages.ts           # human-readable output
│   │   ├── bin/create-atw.js         # shebang entry → dist/index.js
│   │   ├── test/
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── scripts/                      # aux deterministic scripts
│       ├── src/
│       │   ├── parse-schema.ts       # SQL dump → JSON schema
│       │   ├── parse-openapi.ts      # OpenAPI spec → JSON operations
│       │   ├── write-artifact.ts     # atomic markdown write + backup
│       │   ├── load-artifact.ts      # artifact → structured JSON
│       │   ├── validate-artifacts.ts # cross-artifact consistency
│       │   ├── hash-inputs.ts        # SHA-256 content hashes + diff L1
│       │   └── lib/
│       │       ├── types.ts          # shared zod schemas
│       │       ├── atomic.ts         # write-file-atomic wrapper
│       │       ├── markdown.ts       # unified/remark artifact parsing
│       │       └── structural-diff.ts # diff L2 (added/removed/modified items)
│       ├── test/
│       ├── bin/                      # one shim per script for CLI use
│       ├── package.json
│       └── tsconfig.json
├── commands/                         # source of .claude/commands/atw.*.md
│   ├── atw.init.md
│   ├── atw.brief.md
│   ├── atw.schema.md
│   ├── atw.api.md
│   └── atw.plan.md
├── templates/                        # copied into the Builder's project
│   ├── atw-tree/                     # becomes .atw/ skeleton
│   │   ├── config/.gitkeep
│   │   ├── artifacts/.gitkeep
│   │   ├── state/.gitkeep
│   │   └── templates/.gitkeep        # staged for Feature 002
│   ├── docker-compose.yml.tmpl       # ATW services commented out
│   ├── README-atw.md.tmpl
│   ├── package.json.tmpl
│   └── gitignore-atw-block.txt       # block appended to Builder .gitignore
├── tests/
│   ├── integration/
│   │   ├── installer.test.ts         # spawns installer, asserts tree
│   │   ├── conflict-detection.test.ts
│   │   ├── gitignore-management.test.ts
│   │   └── idempotency.test.ts       # re-run hash + structural diff
│   └── fixtures/
│       ├── aurelia/                  # reference demo inputs
│       │   ├── schema.sql
│       │   ├── schema-with-data.sql
│       │   └── openapi.json
│       ├── malformed/
│       │   ├── broken.sql
│       │   └── swagger-2.0.yaml
│       └── large-schema.sql          # > 100 tables for chunking test
├── examples/                         # (pre-existing contract artifacts)
│   ├── sample-brief.md
│   ├── sample-schema-map.md
│   ├── sample-action-manifest.md
│   ├── sample-build-plan.md
│   └── sample-runtime-interactions.md
├── specs/001-setup-flow/              # (this feature)
├── constitution.md
├── PRD.md
├── CLAUDE.md
└── 001-setup-flow.md                  # (source specification)
```

**Structure Decision**: adopted. Monorepo root has two workspaces under
`packages/*`. The `commands/` and `templates/` directories at the repo
root are **data**, not code packages — the installer reads from them at
publish time (bundled into `@atw/installer`) and copies them into the
Builder's project. Integration tests live at the repo root under
`tests/` so they can exercise both packages together. `examples/` is
pre-existing and acts as the shape contract for the five artifacts.

## Complexity Tracking

> No violations. No justification required.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| *(none)*  | —          | —                                   |

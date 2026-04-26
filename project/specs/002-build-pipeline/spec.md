# Feature Specification: Build Pipeline (Feature 002)

**Feature Branch**: `002-build-pipeline`
**Created**: 2026-04-22
**Status**: Draft
**Input**: User description sourced from `002-build-pipeline.md` at the project root, with upstream context in `constitution.md`, `PRD.md`, `examples/`, and the delivered Feature 001 artifacts under `specs/001-setup-flow/`.

## Overview

The Build Pipeline is the second of three features comprising AI to Widget.
It covers the single `/atw.build` slash command and everything that command
does: standing up a local Postgres with pgvector, ingesting the Builder's
SQL dump as reference data, enriching each business entity with Opus,
computing embeddings locally, populating the vector index, rendering
backend TypeScript from templates, compiling the widget bundle, and
building the backend Docker image. All decisions live in the markdown
artifacts produced by Feature 001; this feature only executes them.

The pipeline is deterministic by design (same inputs → semantically
equivalent outputs), resumable by design (a failed 15-minute enrichment
never restarts from zero), and anchored by design (every Opus-generated
fact cites a source field from the client's data). It never phones home,
never leaks data outside the Anthropic enrichment calls the Builder
authorized, and never embeds fields flagged as PII in `schema-map.md`.

Nothing in this feature serves HTTP traffic or renders a UI — those are
Feature 003. This feature produces the running database and the compiled
artifacts that Feature 003 consumes.

## Clarifications

### Session 2026-04-22

- Q: What matching rule should the post-build PII compliance scan use when
  comparing a raw PII value against generated `document` / `facts` text?
  → A: Case-insensitive substring match, whitespace-normalized (leading,
  trailing, and collapsed internal whitespace stripped on both sides
  before comparison). False positives halt the build with an actionable
  diagnostic; false negatives are unacceptable per Principle I.
- Q: What exactly does `--force` force? → A: Re-enrich every entity
  regardless of `source_hash` match. The flag MUST NOT drop migrations,
  replace `client_ref` contents, invalidate the embedding model cache,
  delete the Docker volume, or bypass image-layer caching. Destructive
  resets remain opt-in via separate future flags.
- Q: What reference hardware baseline should the duration SCs be
  measured against? → A: GitHub Actions `ubuntu-latest` runner
  (4-core / 16 GB RAM / SSD), the same class used by the Feature 001
  CI matrix. SCs hold on that runner; Builder-laptop performance is
  expected to be at least as good.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — One-command build from markdown artifacts (Priority: P1)

**As a Builder**, I want a single command that takes me from the markdown
artifacts Feature 001 produced to a running local system, so that I don't
have to orchestrate Postgres, migrations, enrichment, and bundling by
hand.

**Why this priority**: This *is* the feature. Without a working
one-command build, everything else (cost transparency, resumability,
incremental rebuild) is decoration. The hackathon MVP needs this alone.

**Independent Test**: In a project with complete Feature 001 artifacts
and a fresh SQL dump, run `/atw.build`, confirm the plan summary, wait
for completion. Verify a local Postgres container is running with
`atw_documents` populated, a backend Docker image has been built, a
widget bundle has been written to `dist/`, and `build-manifest.json`
records the run. No manual steps between invocation and completion.

**Acceptance Scenarios**:

1. **Given** a project directory with valid `project.md`, `brief.md`,
   `schema-map.md`, `action-manifest.md`, `build-plan.md`, and a SQL
   dump under `.atw/inputs/`, **when** the Builder runs `/atw.build`
   and confirms the plan summary, **then** the command completes
   successfully, the `atw_postgres` container runs, the
   `atw_documents` table holds one row per indexable entity in
   `schema-map.md`, and `backend/src/*.ts` + `dist/widget.js` +
   `dist/widget.css` + `atw_backend:latest` all exist.
2. **Given** the same starting state, **when** the Builder refuses the
   plan summary, **then** the command halts before any container,
   migration, or enrichment call runs, and nothing is written under
   `.atw/` or elsewhere in the project.

---

### User Story 2 — Anchored enrichment with traceable provenance (Priority: P1)

**As a Builder**, I want every enriched entity to cite the source field
each fact came from, so that I can audit the agent's knowledge and be
confident it is not inventing claims about my client's products.

**Why this priority**: Constitution Principle V is a red-line principle.
An enrichment step that silently invents facts is worse than no
enrichment at all — it poisons the retrieval index and destroys trust
in the whole system. This must hold on the MVP.

**Independent Test**: After a build, sample any ten rows from
`atw_documents`. For each row, every claim in `facts` must cite a
`source` field; every such source must exist in the structured input
that was passed to Opus. Zero invented facts.

**Acceptance Scenarios**:

1. **Given** a completed build over the Aurelia fixture, **when** the
   Builder inspects ten random rows in `atw_documents`, **then** every
   fact in every row has a non-empty `source` field, and every source
   field references a column or relationship present in the source
   data.
2. **Given** Opus returns an enrichment with an uncited fact, **when**
   the validator runs on that response, **then** the entity is retried
   once with a sharpened prompt; on a second validation failure, the
   entity is flagged as `validation_failed` and not indexed.

---

### User Story 3 — Resumable build that never restarts from zero (Priority: P1)

**As a Builder**, I want to be able to restart a failed build without
losing progress, so that a 15-minute enrichment run that dies halfway
through costs me seven more minutes, not fifteen.

**Why this priority**: Constitution Principle III is a red-line principle
for any multi-minute operation. A non-resumable build is unacceptable at
real-world scale — Builders will hit network flakes, rate limits, and
laptop lid-close events; the command must survive all of them.

**Independent Test**: Deliberately kill `/atw.build` mid-enrichment
after N entities are done. Re-run `/atw.build`. Verify the second run
skips the N already-enriched entities, does not re-invoke Opus for
them, and completes the remainder. Total Opus cost across both runs
must be within 5 % of the cost of a single uninterrupted run.

**Acceptance Scenarios**:

1. **Given** an in-flight enrichment run, **when** the Builder kills the
   process (Ctrl+C, connection drop, or laptop suspension), **then** no
   half-written state lingers in `atw_documents`, and a subsequent
   `/atw.build` invocation detects the already-enriched entities by
   their `source_hash` and skips them without making Opus calls.
2. **Given** an entity whose source data has not changed since the last
   successful build, **when** `/atw.build` re-runs without `--force`,
   **then** the entity's row is unchanged and zero Opus calls are
   issued for it.

---

### User Story 4 — Cost and duration transparency (Priority: P2)

**As a Builder**, I want to see the estimated cost and duration before a
build starts, and the actual cost and duration when it finishes, so that
I know what I am spending on my client's behalf.

**Why this priority**: Cost surprises kill Builder trust. The estimate
lives in `build-plan.md` (produced by Feature 001); this feature must
surface it at the start and report the real number at the end.
Important, but secondary to the build itself working.

**Independent Test**: Before a build, the command shows the estimate
from `build-plan.md`. After a successful build, the command prints the
actual Opus cost and wall-clock duration, and the same numbers appear
in `build-manifest.json`. The actual cost on the Aurelia fixture must
fall within 20 % of the estimate.

**Acceptance Scenarios**:

1. **Given** `build-plan.md` contains a $10.41 cost estimate and a
   12–18 min duration estimate, **when** the Builder runs `/atw.build`,
   **then** the plan summary shown before confirmation includes both
   numbers verbatim.
2. **Given** a build completes successfully, **when** the Builder reads
   the final output and `build-manifest.json`, **then** both surface
   the real Opus cost (`opus_cost_usd`), the real duration
   (`duration_seconds`), and the count of enriched vs skipped vs
   failed entities.

---

### User Story 5 — Incremental rebuild on changed artifacts (Priority: P2)

**As a Builder**, I want to rebuild only what changed when I update my
schema, artifacts, or source data, so that a new product line added to
my client's catalog costs me minutes and dollars rather than hours.

**Why this priority**: This extends Principle III from Feature 001 into
the build phase. Without it, Builders avoid re-running `/atw.build`
after edits, which defeats the point of keeping decisions in markdown.

**Independent Test**: After a complete build, append three new
indexable tables to `schema-map.md`, re-run `/atw.build`. Verify: only
the new entities are enriched (Opus calls only for them); unchanged
`backend/src/*.ts` files are not rewritten; the widget bundle is
rebuilt only if its inputs changed.

**Acceptance Scenarios**:

1. **Given** a completed build with unchanged inputs, **when** the
   Builder re-runs `/atw.build`, **then** the command reports "nothing
   to do" within 30 seconds, makes zero Opus calls, and does not
   rebuild the Docker image.
2. **Given** only `action-manifest.md` changed (not `brief.md` or
   `schema-map.md`), **when** the Builder re-runs `/atw.build`,
   **then** the enrichment phase is skipped entirely and only backend
   template rendering plus image rebuild happen.
3. **Given** `brief.md` changed, **when** the Builder re-runs
   `/atw.build`, **then** the backend prompt files are re-rendered,
   and the Builder is warned that existing enrichments were anchored
   to the old brief and may want `--force`.

---

### User Story 6 — Clear failure reporting without silent skips (Priority: P2)

**As a Builder**, I want to know clearly when something goes wrong,
which entities failed, why, and what I can do about it — never a bare
stack trace.

**Why this priority**: Partial-success builds are the norm at real-world
scale (empty descriptions, malformed rows, transient Opus errors). The
Builder must be able to decide whether to fix the data or accept the
skip; the command must give them the information to decide.

**Independent Test**: Introduce a row with an empty description into
the SQL dump before building. The build completes for the rest of the
entities, the failing entity appears in `build-manifest.json` under
`failures` with a specific reason, and the final command output names
the failure count and points the Builder at the manifest.

**Acceptance Scenarios**:

1. **Given** fifteen entities have insufficient source data, **when**
   `/atw.build` finishes, **then** the summary reports "fifteen
   entities flagged — see `build-manifest.json`", lists the entity
   ids with their failure reason, and does not halt the build.
2. **Given** an authentication error occurs on the first Opus call
   (invalid API key), **when** the command detects it, **then** the
   build halts immediately before enrichment begins, with a one-line
   message instructing the Builder to set `ANTHROPIC_API_KEY`, and no
   partial state is left behind.
3. **Given** a non-fatal error (bad input for a single entity), **when**
   it occurs mid-build, **then** the entity is flagged and the build
   continues with the remaining entities.

---

### User Story 7 — Clean abort that leaves the database consistent (Priority: P2)

**As a Builder**, I want to abort a build cleanly with Ctrl+C and not
end up with half-populated state that confuses the next run.

**Why this priority**: Real Builders hit Ctrl+C. If that leaves the
database in a state the next build cannot recognize, resumability
(US-003) breaks. Close relative of US-003 but worth stating explicitly.

**Independent Test**: Start a build, hit Ctrl+C during enrichment
(after ≥ 5 entities completed). Verify: no row in `atw_documents` is
in an inconsistent state, every upserted row has a valid `source_hash`
and `embedding`, and the next `/atw.build` picks up from exactly the
right point.

**Acceptance Scenarios**:

1. **Given** an in-flight enrichment loop, **when** the Builder sends
   SIGINT, **then** in-flight Opus responses are still validated and
   upserted (their cost has already been paid), no partial row is
   written, and the process exits with a non-zero status.
2. **Given** an interrupted build, **when** the Builder re-runs
   `/atw.build`, **then** the resume path is taken automatically and
   no Opus cost is duplicated for entities whose `source_hash` already
   matches.

---

### User Story 8 — Deterministic, auditable generated code (Priority: P2)

**As a Builder**, I want the generated backend code to be readable,
auditable, and something I could edit by hand in an emergency without
the build magically re-authoring my edits.

**Why this priority**: Constitution Principle II (markdown as source of
truth) extends to the generated code: if the Builder cannot read and
audit the backend, they cannot take the system to production with
confidence. Also protects against surprise overwrites.

**Independent Test**: Run the build twice on unchanged inputs. Compare
`backend/src/*.ts` byte-for-byte across the two runs — they must be
identical. Open any generated file; it must be readable TypeScript
with named exports matching `action-manifest.md` entry-for-entry.

**Acceptance Scenarios**:

1. **Given** two builds with identical inputs, **when** the Builder
   compares the generated backend files, **then** every rendered
   `.ts` file is byte-identical across the two runs.
2. **Given** a Builder has edited `backend/src/tools.ts` by hand after
   a previous build, **when** the next build detects no change to the
   source template or the action-manifest, **then** the hand-edited
   file is left untouched; if the template or manifest *did* change,
   the file is overwritten only after a backup is written to
   `backend/src/tools.ts.bak`.

---

### User Story 9 — Configurable concurrency for slow machines or rate limits (Priority: P3)

**As a Builder**, I want to throttle enrichment concurrency when I am
on a slow machine or tight Anthropic rate limits, without editing
configuration files.

**Why this priority**: Nice-to-have. The default concurrency (10) works
for most Builders; a flag is cheap insurance for the rest. Not
required for MVP.

**Independent Test**: Run `/atw.build --concurrency 3`. Verify at most
three Opus calls are in flight at any moment and the overall cost is
unchanged from a default-concurrency run.

**Acceptance Scenarios**:

1. **Given** `--concurrency 3` is supplied, **when** enrichment
   begins, **then** no more than three Opus requests are in flight
   simultaneously.
2. **Given** sustained HTTP 429 responses, **when** the retry logic
   detects them, **then** the effective concurrency is automatically
   reduced (default 10 → 3); if rate limits continue, the build
   halts with a diagnostic.

---

### Edge Cases

- Docker is not running when `/atw.build` starts → command halts
  before any migration or Opus call, with a one-line instruction to
  start Docker.
- Port 5433 (Postgres default override) is already in use → command
  surfaces the conflict and suggests the `--postgres-port` override.
- Embedding model download fails mid-first-run → halt with the manual
  download URL so the Builder can fetch it out-of-band.
- SQL dump references Postgres extensions the container does not have
  → warn, skip those extensions, continue with tables that do import.
- Opus returns `{"insufficient_data": true}` for an entity → flag the
  entity in `build-manifest.json`, do not index, continue the build.
- Builder hand-edited a rendered `backend/src/*.ts` file → preserved
  if the underlying template and inputs have not changed; otherwise
  the file is overwritten after writing a `.bak` sibling.
- Build is interrupted between enrichment and template rendering →
  next run resumes enrichment as no-op (hashes match) and proceeds
  straight to template rendering.
- A PII-flagged column (from `schema-map.md`) is somehow present in
  the assembled input → the assembler refuses to include it;
  regression-guarded by a post-build scan of all `document` and
  `facts` text for any PII value.
- Builder runs `/atw.build` with no changes → the command reports
  "nothing to do" in under 30 seconds and exits with success.

## Requirements *(mandatory)*

### Functional Requirements

#### `/atw.build` command shape (FR-051 – FR-056)

- **FR-051**: The `/atw.build` command MUST be delivered as a markdown
  file at `commands/atw.build.md` and copied by the Feature 001
  installer into the Builder's `.claude/commands/` directory.
- **FR-052**: `/atw.build` MUST accept the following flags:
  `--concurrency <n>`, `--force`, `--entities-only`, `--no-enrich`,
  `--dry-run`, `--backup`, `--postgres-port <n>`. `--force` scope is
  limited to re-enrichment only: it MUST re-invoke Opus for every
  indexable entity regardless of `source_hash` match, and MUST NOT
  drop migrations, replace `client_ref` contents, invalidate the
  embedding model cache, delete the Postgres volume, or bypass
  Docker image-layer caching.
- **FR-053**: `/atw.build` MUST validate, before any container,
  migration, or Opus call, that `project.md`, `brief.md`,
  `schema-map.md`, `action-manifest.md`, and `build-plan.md` all
  exist under `.atw/`. When any is missing, the command MUST halt
  naming the prior command (`/atw.init`, `/atw.brief`, `/atw.schema`,
  `/atw.api`, or `/atw.plan`) the Builder needs to run.
- **FR-054**: `/atw.build` MUST present a plan summary (entity count,
  cost estimate, duration estimate, container port, output paths) and
  MUST NOT execute any step that writes to disk, a container, or
  Anthropic until the Builder confirms (Principle IV, FR-041).
- **FR-055**: `/atw.build` MUST stream progress to the Claude Code
  session at least every five entities or every ten seconds,
  whichever comes first, and the progress line MUST include running
  counts of enriched / skipped / failed entities, cumulative cost,
  elapsed time, and an ETA.
- **FR-056**: `/atw.build` MUST, on `--dry-run`, execute validation
  and the plan summary, then exit without making any container,
  filesystem, or Anthropic call.

#### Database orchestration (FR-057 – FR-061)

- **FR-057**: The command MUST start a Postgres container pinned to
  `pgvector/pgvector:pg16` (or a successor pin declared in
  `build-plan.md`), named `atw_postgres`, with a named volume so that
  data survives container restarts, and expose a port that defaults
  to 5433 and is configurable via `build-plan.md` or
  `--postgres-port`.
- **FR-058**: The command MUST apply migrations idempotently, tracked
  by an `atw_migrations` table. The first migration MUST create the
  `vector` extension, a `client_ref` schema, the `atw_documents`
  table with the fields specified in the build-plan contract
  (including `source_hash`), and both the HNSW embedding index and
  the `(entity_type, entity_id)` uniqueness + lookup indexes.
- **FR-059**: The command MUST import the Builder's SQL dump into the
  `client_ref` schema, and MUST filter the dump so that only tables
  listed in `schema-map.md` as primary or related are imported.
  Tables classified as PII-excluded MUST NOT be imported.
- **FR-060**: The command MUST NOT request, accept, log, or store a
  production database connection string at any point — dumps are the
  only accepted ingress (Principle I).
- **FR-061**: Re-running the import MUST be idempotent. Existing
  tables are detected; the Builder may replace or skip, but no data
  is dropped without explicit confirmation.

#### Embedding model (FR-062 – FR-064)

- **FR-062**: The command MUST use the embedding model named in
  `build-plan.md` (default: a multilingual 384-dimension model that
  runs on CPU without Python), download it on first use, and cache
  it locally for subsequent runs.
- **FR-063**: Embedding computation MUST be deterministic: the same
  input text MUST produce a bit-identical embedding vector across
  runs on the same platform.
- **FR-064**: The command MUST NOT ship secrets or API keys inside
  the cached model directory.

#### Enrichment pipeline (FR-065 – FR-072)

- **FR-065**: For each indexable entity in `schema-map.md`, the
  command MUST:
  1. Deterministically assemble a structured JSON input from
     `client_ref`, joining tables declared in the schema map.
  2. Compute a SHA-256 `source_hash` over the structured input plus
     the enrichment prompt version.
  3. If `source_hash` already matches the row in `atw_documents`
     and `--force` was not supplied, skip Opus invocation.
  4. Otherwise, invoke Opus with the anchored prompt from
     `build-plan.md`, validate the response, embed the `document`
     text, and upsert into `atw_documents`.
- **FR-066**: The enrichment prompt MUST include, verbatim, the
  anchoring rules from Constitution Principle V: no invented facts,
  every claim cites a source field, refuse on insufficient data.
- **FR-067**: The command MUST reject an Opus response in which any
  `fact.claim` lacks a non-empty `source`, any `source` does not
  correspond to a field in the assembled input, or any category
  label is outside the vocabulary declared in `build-plan.md`. On
  first rejection the command MUST retry once with a sharpened
  prompt citing the specific rule violated; on second rejection the
  entity MUST be flagged and skipped (not indexed).
- **FR-068**: The command MUST NOT include any column flagged as PII
  in `schema-map.md` in the assembled input or the Opus prompt.
- **FR-069**: The command MUST back off on HTTP 429 with exponential
  delay plus jitter, retry once on HTTP 5xx, halt the entire build on
  HTTP 401 or 403, and flag the entity and continue on HTTP 400.
- **FR-070**: When sustained 429 responses are detected, the command
  MUST automatically reduce concurrency (default 10 → 3); if that
  still fails, the command halts with a diagnostic.
- **FR-071**: The command MUST support a configurable parallelism
  bounded by a semaphore in the build process, defaulting to the
  value in `build-plan.md` (typically 10) and overridable via
  `--concurrency`.
- **FR-072**: The command MUST NOT issue Opus calls on
  `--entities-only=false` combined with `--no-enrich`, and MUST halt
  early with a clear message if the flag combination is meaningless.

#### Code generation (FR-073 – FR-076)

- **FR-073**: After enrichment (or when `--no-enrich` is set), the
  command MUST render backend TypeScript files from templates under
  `packages/backend/src/*.hbs`, injecting values from `project.md`,
  `brief.md`, `action-manifest.md`, and `build-plan.md`.
- **FR-074**: Template rendering MUST be idempotent: if a rendered
  file's content is byte-identical to the existing target, the target
  MUST NOT be rewritten; if different, the existing target MUST be
  overwritten only after a `.bak` sibling is written when `--backup`
  is set.
- **FR-075**: The command MUST compile the widget bundle from
  `packages/widget/src/` into `dist/widget.js` (single-file IIFE) and
  `dist/widget.css`, with configuration values injected at compile
  time from the build-plan's runtime block.
- **FR-076**: Two consecutive builds on unchanged inputs MUST produce
  byte-identical `backend/src/*.ts` and byte-identical `dist/widget.js`
  / `dist/widget.css`.

#### Container image build (FR-077 – FR-078)

- **FR-077**: The command MUST build the backend Docker image
  (`atw_backend:latest`) using a multi-stage Dockerfile, ship the
  embedding model pre-cached into the image layer so runtime
  containers start without a first-call download, and MUST NOT bake
  any API key or secret into the image.
- **FR-078**: The command MUST update the project root
  `docker-compose.yml` to activate the AI to Widget services
  (uncomment the block written by Feature 001) if they are not
  already active. If they are already active, the file MUST NOT be
  rewritten.

#### State, idempotency, and manifest (FR-079 – FR-083)

- **FR-079**: The command MUST write `.atw/state/build-manifest.json`
  after every run (success, partial, or aborted), containing at
  minimum: `build_id`, `started_at`, `completed_at`,
  `duration_seconds`, totals (`total_entities`, `enriched`,
  `skipped_unchanged`, `failed`), a `failures` array with an entry
  per failed entity, `opus_calls`, `opus_cost_usd`, and
  `input_hashes` for every consumed artifact.
- **FR-080**: A successful re-run with no changes to any consumed
  artifact, no changes to `client_ref` row-level data, and no
  `--force` flag MUST complete in under 30 seconds, issue zero Opus
  calls, and report "nothing to do."
- **FR-081**: A change detected only in `action-manifest.md` MUST
  trigger only template rendering and image rebuild — no enrichment
  calls.
- **FR-082**: A change detected in `brief.md` MUST trigger backend
  prompt re-rendering AND surface a warning that existing
  enrichments were anchored to the previous brief, prompting the
  Builder to choose whether to re-enrich with `--force`.
- **FR-083**: The command MUST be interruptible at the command
  boundary: Ctrl+C mid-enrichment MUST let in-flight Opus responses
  finish validation and upsert (their cost is already paid), MUST
  NOT leave partial rows in `atw_documents`, and MUST exit with a
  non-zero status so the next invocation takes the resume path.

#### Cross-cutting constraints (FR-084 – FR-090)

- **FR-084**: The command MUST make network calls only to the
  Anthropic API (for enrichment), the embedding model registry on
  first-run only (for the model download), and the local Docker
  daemon and local Postgres container. No telemetry. No other hosts.
- **FR-085**: On Anthropic authentication failure, the command MUST
  halt with a one-line message naming `ANTHROPIC_API_KEY` as the
  variable to set.
- **FR-086**: The command MUST refuse to run when Docker is not
  reachable, surfacing a one-line diagnostic.
- **FR-087**: All writes to disk (`backend/src/*.ts`,
  `dist/widget.js`, `dist/widget.css`, `build-manifest.json`) MUST be
  atomic (write to a temporary path, fsync, rename).
- **FR-088**: After the build, a compliance scan MUST confirm that no
  value from a PII-flagged column in `schema-map.md` appears in any
  `atw_documents.document` or `atw_documents.facts` text under a
  case-insensitive, whitespace-normalized substring comparison (both
  the PII value and the generated text are lower-cased and have
  leading/trailing whitespace trimmed with collapsed internal
  whitespace before the substring check). The scan MUST fail the
  build if any match is found and surface every matching `(entity_id,
  pii_column, matched_snippet)` triple so the Builder can act.
- **FR-089**: The command MUST ship auxiliary scripts under
  `packages/scripts/` covering: SQL dump import (filtered to
  schema-map primary/related tables), structured-input assembly,
  Opus enrichment wrapper, enrichment validator, embedding wrapper,
  `atw_documents` upsert, template renderer, widget compiler,
  backend image builder, and manifest writer. Each script MUST be
  independently invocable, typed, and testable.
- **FR-090**: The build MUST be reproducible on macOS, Linux, and
  Windows (via WSL2 where Docker is hosted). No platform-specific
  steps, no shell-scripted assumptions about the POSIX environment.

### Key Entities

- **Structured enrichment input**: A per-entity JSON object assembled
  deterministically from `client_ref` rows, joined across the tables
  the schema map declares as related. Excludes PII-flagged columns.
  Used both as the Opus prompt input and as the basis for the
  `source_hash` that gates re-enrichment.
- **Enrichment response**: The JSON object Opus returns for one
  entity. Contains `document` (the natural-language text that will
  be embedded), `facts` (a list of `{claim, source}` pairs), and
  `categories` (a map of label arrays drawn from allowed
  vocabularies). Validated structurally before any write.
- **`atw_documents` row**: The persisted representation of one
  enriched entity. Holds `entity_type`, `entity_id`, the `document`
  text, the `facts` and `categories` JSON, the `embedding` vector,
  a `source_hash`, and timestamps. Unique on `(entity_type, entity_id)`.
- **Build manifest**: `.atw/state/build-manifest.json` — the
  post-build log of what was built, when, at what cost, with which
  input hashes, and which entities failed. The Builder's primary
  audit trail for any single build.
- **Rendered backend source**: TypeScript files under `backend/src/`
  produced deterministically from Handlebars templates and the five
  Feature 001 artifacts. Owned by the Builder after generation;
  overwritten only after `.bak` when templates or inputs change.
- **Widget bundle**: `dist/widget.js` (single-file IIFE) plus
  `dist/widget.css`, compiled from `packages/widget/src/` with
  configuration injected at compile time.
- **Backend image**: `atw_backend:latest`, a multi-stage Docker
  image holding the compiled backend and the pre-cached embedding
  model. No secrets baked in.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-012**: On the Aurelia reference fixture (~342 entities), a
  fresh build from clean state completes in under 20 minutes of
  wall-clock time on the reference CI runner (GitHub Actions
  `ubuntu-latest`: 4-core / 16 GB RAM / SSD).
- **SC-013**: Re-running the build on unchanged inputs completes in
  under 30 seconds and issues zero Opus calls.
- **SC-014**: After any build, inspecting any ten random rows in
  `atw_documents` shows that 100 % of `facts.claim` entries cite a
  non-empty `source` that exists in the source data. Zero invented
  facts.
- **SC-015**: Killing the command mid-enrichment and re-running
  yields a total Opus cost within 5 % of a single uninterrupted run
  for the same inputs.
- **SC-016**: Two consecutive builds with identical inputs produce
  byte-identical `backend/src/*.ts` and byte-identical
  `dist/widget.js` + `dist/widget.css`.
- **SC-017**: The actual Opus cost on the Aurelia fixture falls
  within 20 % of the estimate surfaced from `build-plan.md`.
- **SC-018**: A post-build compliance scan confirms that zero value
  from any PII-flagged column in `schema-map.md` appears in any
  `atw_documents.document` or `atw_documents.facts` text under a
  case-insensitive, whitespace-normalized substring match.
- **SC-019**: On the small-project fixture (< 50 entities), a fresh
  build completes in under 5 minutes on the reference CI runner
  (GitHub Actions `ubuntu-latest`: 4-core / 16 GB RAM / SSD).
- **SC-020**: On at least one failing-input scenario (e.g., missing
  `build-plan.md`, Docker not running, bad `ANTHROPIC_API_KEY`), the
  command surfaces a one-line actionable diagnostic rather than a
  stack trace, and leaves no partial state behind.

## Assumptions

- The Builder has completed Feature 001 and the `.atw/` directory
  contains valid `project.md`, `brief.md`, `schema-map.md`,
  `action-manifest.md`, and `build-plan.md`.
- The Builder has Docker Desktop or Docker Engine installed and
  running; the command will not attempt to start the Docker daemon
  itself.
- The Builder has an `ANTHROPIC_API_KEY` environment variable set
  in the shell where Claude Code runs. Without it, enrichment halts
  immediately.
- The Builder's machine has enough free disk space to hold the
  Postgres volume (≤ 1 GB for Aurelia-scale data), the cached
  embedding model (≤ 200 MB), and the built backend image
  (≤ 300 MB). The command does not pre-check disk space; it surfaces
  "disk full" as a clean failure.
- The SQL dump under `.atw/inputs/` is valid Postgres syntax
  (already validated by `/atw.schema` in Feature 001).
- Feature 003's widget source code (`packages/widget/src/`) is
  either already present (when the pipeline runs after Feature 003
  lands) or the widget compilation step is skipped cleanly when the
  source directory is empty. This feature ships the compiler plumbing
  but does not author the widget UI.
- The Anthropic rate limits available to the Builder's account can
  sustain the default concurrency of 10 for short bursts; higher
  concurrency is opt-in via `--concurrency`.
- The embedding model ships with the same version in both the build
  command and the backend runtime image, so the embeddings computed
  here match the ones Feature 003's retrieval query expects.
- The command runs in the Builder's local development environment;
  multi-tenant isolation and shared-infrastructure concerns are out
  of scope for V1.

## Out of scope *(for this feature)*

- The runtime behavior of the generated backend (Feature 003 serves
  HTTP from it; this feature only builds it).
- The widget UI implementation (Feature 003 authors the TypeScript
  under `packages/widget/src/`; this feature only compiles it).
- The `/atw.embed` and `/atw.verify` commands.
- Integration with the Medusa demo storefront or any other host
  application.
- Real-time database synchronization or change-data capture
  (permanently out of scope in V1).
- Multi-project or multi-tenant isolation within a single
  installation.
- Cross-machine build caches or remote image registries (the built
  image is local-only).

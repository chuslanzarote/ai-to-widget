# Feature 002 — Build Pipeline

> **What this document is.** This is the input for `/speckit.specify` for the second of three features of AI to Widget. It scopes the `/atw.build` command and everything it does: standing up Postgres with pgvector, ingesting the Builder's SQL dump as reference data, enriching each business entity with Opus, computing embeddings, populating the vector index, rendering backend code templates, and compiling the widget bundle. Feature 001 produces the markdown artifacts; this feature turns them into a running local system.
>
> **Upstream dependencies.**
> - The constitution (`constitution.md`) and PRD (`PRD.md`) are in the repository root.
> - Feature 001 is complete. The `.atw/` directory in the Builder's project contains valid `project.md`, `brief.md`, `schema-map.md`, `action-manifest.md`, and `build-plan.md`. The `.atw/templates/` directory is populated. A `docker-compose.yml` template is present at the project root.
> - The Builder's SQL dump (schema + optional samples) is accessible to the command.
> - `examples/sample-build-plan.md` is the canonical reference for plan content consumed here.
>
> **Downstream consumers.** Feature 003 (runtime) uses the compiled backend container and the compiled widget bundle this feature produces. It also depends on the populated Postgres database with `atw_documents` indexed.

---

## 1. Context and purpose

Feature 001 left the Builder with a complete specification of the agent as markdown: what the client's business is, what data exists and what to index, what actions the agent can take, and how to build it all. This feature executes that specification. It is the most technical and the most time-consuming of the three features at runtime — a typical Aurelia-scale build takes 12-18 minutes — because it performs real work: hundreds of Opus calls, hundreds of embeddings, database writes, code rendering.

The build pipeline is deterministic *by design*: given the same inputs, it must produce semantically equivalent outputs. Opus is used only where genuine semantic interpretation is needed — the enrichment step — with hard anchoring rules to prevent invented facts (see Constitution Principle 5). All other work is typed TypeScript scripts: parsing, embedding (local, via `@xenova/transformers`), inserting, rendering templates.

The build is also resumable. A 15-minute enrichment run that fails halfway does not restart from zero. Idempotency is enforced through content hashing and database state checks (Constitution Principle 3).

---

## 2. Scope

### 2.1 In scope

- **The `/atw.build` slash command**, delivered as a markdown file at `.claude/commands/atw.build.md`. The installer (from Feature 001) copies it in place; this feature provides the file and makes it work.
- **Database orchestration.**
  - Starting the AI to Widget Postgres container (pgvector image, pinned version) via Docker Compose.
  - Applying migrations that create the `atw_documents` table, the HNSW index, and supporting structures.
  - Importing the Builder's SQL dump into an isolated `client_ref` schema.
- **Embedding model management.**
  - Downloading the chosen embedding model (default `Xenova/bge-small-multilingual-v1.5`) on first run.
  - Caching it locally so subsequent runs are fast.
  - Loading it into the build process when needed.
- **The enrichment pipeline**, per entity listed in `schema-map.md`:
  - Deterministic assembly of input (query `client_ref`, join related tables).
  - Opus enrichment call with anchored prompt.
  - Deterministic validation that every fact cites a source field.
  - Local embedding computation.
  - Upsert into `atw_documents`.
- **Concurrency and resumability.**
  - Configurable parallelism (default 10 concurrent Opus calls).
  - Exponential backoff on rate limits.
  - Skip already-enriched entities on re-run unless forced.
  - Progress streaming to the Claude Code session.
- **Code generation from templates.**
  - Rendering `packages/backend/src/` files from templates, using values from the artifacts.
  - Compiling the widget JavaScript bundle with `esbuild`.
  - Compiling the widget CSS bundle.
- **Container image build.**
  - Building the Docker image for the AI to Widget backend.
  - Wiring it into the project's `docker-compose.yml`.
- **Build state tracking.**
  - Writing `.atw/state/build-manifest.json` with what was built, when, input hashes, cost, and duration.

### 2.2 Out of scope (for this feature)

- The runtime behavior of the generated backend — rendering it is in scope, but testing its actual request/response cycle is Feature 003.
- The runtime behavior of the generated widget — compiling it is in scope, but integrating it into the Medusa storefront is Feature 003.
- The `/atw.embed` command (Feature 003).
- The `/atw.verify` command (stretch, Feature 003 or beyond).
- The Medusa demo environment wiring (Feature 003 — this feature must work with a SQL dump from *any* Postgres database, not just Medusa's).
- Real-time database synchronization (permanently out of scope in V1).

### 2.3 Relationship to other features

- Feature 001 **produces** markdown artifacts; this feature **consumes** them.
- This feature **produces** a running Postgres with populated `atw_documents`, a backend Docker image, and a compiled widget bundle.
- Feature 003 **depends on** everything this feature produces. If this feature changes the shape of `atw_documents`, the retrieval query in Feature 003's backend needs corresponding updates.

---

## 3. Mental model for the Builder

From the Builder's point of view, `/atw.build` is one long command with visible progress:

```
> /atw.build

Validating artifacts in .atw/...
  ✓ project.md       (aurelia-agent)
  ✓ brief.md         (Aurelia coffee shop)
  ✓ schema-map.md    (4 entities: Product, Category, Collection, Region)
  ✓ action-manifest.md  (11 tools)
  ✓ build-plan.md    (~342 entities, ~$10.41 estimated)

Continue? [y/N] y

Starting Postgres container (pgvector/pgvector:pg16)...
  ✓ atw_postgres up on port 5433
Applying migrations...
  ✓ 3 migrations applied
Importing SQL dump into client_ref schema...
  ✓ 74 tables imported, ~2,100 rows total
Loading embedding model (Xenova/bge-small-multilingual-v1.5)...
  ✓ Model cached (98MB)

Enriching entities (342 total, concurrency 10):
  [████████████████████] 100% │ 342/342 │ 15m 42s │ $10.18

Validating enrichments...
  ✓ 340 entities indexed
  ⚠ 2 entities flagged (insufficient data) — see state/build-manifest.json

Rendering backend...
  ✓ src/server.ts
  ✓ src/tools.ts
  ✓ src/prompts.ts
  ✓ src/config.ts
Building backend Docker image...
  ✓ atw_backend:latest (238MB)
Compiling widget bundle...
  ✓ dist/widget.js (72KB gzipped)
  ✓ dist/widget.css (4KB gzipped)

Build complete.
  Cost:     $10.18
  Duration: 16m 03s
  Next:     run /atw.embed to integrate the widget into your host app.
```

The Builder sees everything. Nothing is hidden. Failures are reported clearly. Re-runs skip what's already done.

---

## 4. User stories

### US-002.1 — One-command build
*As a Builder, I want a single command that takes me from markdown artifacts to a running local system, so that I don't have to orchestrate multiple scripts manually.*

**Scenario.** The Builder has completed Feature 001's flow. They type `/atw.build`. Claude Code validates the artifacts, shows a plan summary, asks for confirmation, then executes all the steps in sequence. When it finishes, a Postgres container is running with enriched data, a backend image is built, and a widget bundle is ready to embed.

### US-002.2 — Cost and duration transparency
*As a Builder, I want to see the estimated and actual cost and duration of the build, so that I know what I'm spending.*

**Scenario.** Before the build starts, the Builder sees *"~342 entities, ~$10.41 estimated, ~12-18 minutes"* and confirms. During the build, progress is streamed. After completion, the exact cost and duration are reported and persisted in `build-manifest.json`.

### US-002.3 — Anchored enrichment
*As a Builder, I want every enriched entity to have traceable provenance, so that I can audit the agent's knowledge and be confident it's not inventing facts about my client's products.*

**Scenario.** The Builder opens a sample record in the `atw_documents` table, or reads a sample from the build log. Every fact listed is annotated with the source field it came from. Nothing is invented. If the Builder spots a claim they don't recognize, they can trace it back to the original field in the SQL dump.

### US-002.4 — Resumability
*As a Builder, I want to be able to restart a failed build without losing progress.*

**Scenario.** Halfway through enrichment, the Builder's internet connection drops. The command errors out cleanly. The Builder reconnects and runs `/atw.build` again. The command detects that 140 of 342 entities are already enriched (present in `atw_documents` with up-to-date source hashes), skips them, and continues with the remaining 202.

### US-002.5 — Incremental rebuild
*As a Builder, I want to rebuild only what changed when I update my schema or artifacts.*

**Scenario.** The Builder's client releases a new collection of products. The Builder exports a fresh SQL dump, re-runs `/atw.schema` (it detects new tables and proposes updates — idempotency from Feature 001), accepts, runs `/atw.build` again. This time, only the new products and any products whose `updated_at` changed are re-enriched. Everything else is skipped. Cost and duration scale with the delta, not the total.

### US-002.6 — Failure visibility
*As a Builder, I want to know clearly when something goes wrong, and what to do about it.*

**Scenario.** 15 entities fail enrichment because their source records have empty descriptions. The command continues with the rest and produces a clear report at the end: *"15 entities flagged as insufficient data — see `.atw/state/build-manifest.json` for details."* The Builder can decide whether to fix the source data or to accept the skip.

### US-002.7 — Configurable concurrency
*As a Builder, I want to throttle the build if I'm on a slow machine or tight rate limits.*

**Scenario.** The Builder runs `/atw.build --concurrency 3` instead of the default 10. The enrichment pipeline respects the override. The cost is the same; the duration is longer but more gentle on the Anthropic rate limits.

### US-002.8 — Clean abort
*As a Builder, I want to abort a build cleanly and not end up with half-populated state.*

**Scenario.** The Builder hits `Ctrl+C` during enrichment. The in-flight Opus calls complete (they've been paid for); already-upserted entities remain in `atw_documents`; the command exits. The next `/atw.build` resumes from where this one left off.

### US-002.9 — Constitution-aligned defaults
*As a Builder, I trust that the build pipeline does not phone home, leaks data, or does unsafe things by default.*

**Scenario.** The build makes calls only to: the local Postgres container, the locally cached embedding model, and Anthropic's API (for enrichment calls). No telemetry, no external databases, no shared services. The Builder verifies this by running with network monitoring if they want to.

### US-002.10 — Deterministic templates
*As a Builder, I want the generated backend code to be readable, auditable, and something I could edit myself if needed.*

**Scenario.** After the build, the Builder looks at `backend/src/tools.ts` and sees a TypeScript file that declares each tool as a named export, with the arguments schema and description exactly as `action-manifest.md` specified. No obfuscation, no dynamic code loading, nothing surprising. They could edit it if they wanted (and re-run the build to regenerate it).

---

## 5. Functional requirements

### 5.1 Slash command `/atw.build`

**Invocation.** Called from Claude Code. Flags supported:
- `--concurrency <n>` — override the default enrichment concurrency (default from `build-plan.md`, typically 10).
- `--force` — re-enrich entities even if they exist and appear up-to-date.
- `--entities-only` — skip template rendering and image build; stop after enrichment.
- `--no-enrich` — skip enrichment; only re-render templates and rebuild image/widget (useful when only config changed).
- `--dry-run` — validate artifacts and show what would happen without executing.

**Control flow (pseudocode).**

```
validate artifacts in .atw/
present summary to Builder
await confirmation

start atw_postgres container (idempotent)
apply migrations (idempotent)
import SQL dump into client_ref (idempotent by row hash)
load embedding model (cached)

for each entity in schema-map.md:
    if entity already enriched and up-to-date and not --force:
        skip
    else:
        assemble input (deterministic query)
        enrich (Opus call, anchored prompt)
        validate enrichment (every fact cites source)
        embed the document
        upsert into atw_documents

if not --entities-only:
    render backend templates
    compile widget bundle
    build backend Docker image

write build-manifest.json
report summary
```

Each step is wrapped to catch errors and report cleanly.

### 5.2 Database setup

**Postgres container.** Uses pinned `pgvector/pgvector:pg16`. Exposed on port 5433 (configurable in `build-plan.md`) to avoid conflict with the host application's own Postgres in demos. Named `atw_postgres`. Volume-backed for persistence across runs.

**Migrations.** SQL files in `packages/backend/migrations/` applied in filename order. Tracked in a `atw_migrations` table to support idempotency. First migration creates:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE SCHEMA IF NOT EXISTS client_ref;

CREATE TABLE atw_documents (
  id           text PRIMARY KEY,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  document     text NOT NULL,
  facts        jsonb NOT NULL,
  categories   jsonb NOT NULL,
  metadata     jsonb NOT NULL,
  source_hash  text NOT NULL,
  embedding    vector(384) NOT NULL,
  created_at   timestamp DEFAULT now(),
  updated_at   timestamp DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX atw_documents_embedding_idx
  ON atw_documents USING hnsw (embedding vector_cosine_ops);

CREATE INDEX atw_documents_entity_idx
  ON atw_documents (entity_type, entity_id);

CREATE INDEX atw_documents_source_hash_idx
  ON atw_documents (source_hash);
```

The dimension (384) is taken from the embedding model in `build-plan.md`. If a different model is chosen, the migration is parameterized.

**SQL dump import.** Runs `psql` via `docker exec` to load the Builder's schema-only dump into `client_ref`. Then loads the data-only dump if present. Only tables present in `schema-map.md` as primary or related are imported — others are skipped at import time (filtered by a small preprocessing script). This keeps the database compact and resists tempting future code into relying on tables that were not reviewed.

Imports are idempotent. Re-running detects existing tables and offers to replace or skip.

### 5.3 Embedding model

**Default.** `Xenova/bge-small-multilingual-v1.5` (384-dim, multilingual). Chosen in `build-plan.md` based on the primary language in `brief.md`.

**Runtime.** `@xenova/transformers` running in the Node process of the build command. ONNX-based, CPU-friendly, no Python required.

**Caching.** First run downloads the model to `~/.cache/atw/models/` (or equivalent per-platform path). Subsequent runs load from cache in a few seconds.

**Deterministic output.** For the same input text, embeddings are deterministic bit-for-bit (important for idempotency checks and for reproducibility in the demo).

### 5.4 Enrichment pipeline

**Per-entity flow.**

1. **Assemble input.** A deterministic script reads the entity's row from `client_ref`, joins with the related tables per `schema-map.md`, and produces a structured JSON input. Example for a product: title, subtitle, description, metadata keys filtered to the allowed list, variant summary, category names, tag values (filtered to allowed prefixes), collection title.

2. **Compute source hash.** SHA-256 over the structured input plus the enrichment prompt version. Used for idempotency: if the hash matches the existing row's `source_hash`, no re-enrichment needed.

3. **Call Opus.** Uses the anchored prompt template from `build-plan.md` (which was generated in Feature 001). Injects: the structured input, the allowed category vocabularies, the target language from `project.md`. Model: `claude-opus-4-7`.

4. **Validate output.** A deterministic validator checks:
   - JSON is parseable and matches expected schema.
   - Every `claim` in `facts` has a non-empty `source` field.
   - Every source field referenced exists in the input.
   - Every category label belongs to an allowed vocabulary.
   - `document` is non-empty and under a reasonable length cap.
   - If `{"insufficient_data": true}` is returned, the entity is flagged but not indexed.

   If validation fails, the entity is retried once with a sharpened prompt ("your previous output violated rule X"). On second failure, the entity is flagged and skipped, with details in `build-manifest.json`.

5. **Embed.** The `document` text is passed through the embedding model.

6. **Upsert.** Inserts into `atw_documents` on conflict (entity_type, entity_id) do update.

**Prompt template.** Injected from `build-plan.md`. Includes all the hard rules from Constitution Principle 5 (no invented facts, every claim cites a source, refuse on insufficient data). Category vocabularies are inline in the prompt; unknown labels are rejected by the validator. The full prompt structure is documented in `PRD.md` §5.2.6.

**Concurrency.** Default 10 parallel requests. Configurable via `--concurrency` or in `build-plan.md`. Parallelism is bounded by a semaphore in the build process.

**Retry policy.**
- On HTTP 429 (rate limit): exponential backoff with jitter, up to 3 attempts per entity.
- On HTTP 5xx: immediate retry once, then same backoff.
- On HTTP 401/403 (auth): halt the whole build with a clear message about `ANTHROPIC_API_KEY`.
- On HTTP 400 (bad request): flag the entity, continue with others.

**Progress streaming.** Every 5 entities (or every 10 seconds, whichever comes first), the command emits a progress line:
```
Enriched 127/342 entities · Cost $3.81 · Elapsed 6m 14s · ETA 7m 08s
```

### 5.5 Code generation

After enrichment completes (or in parallel with the last phase), the build renders:

**Backend templates.** Handlebars templates in `packages/backend/src/*.hbs` → corresponding `.ts` files. Templates injected with values from:
- `project.md` (project name, language)
- `brief.md` (system prompt preamble)
- `action-manifest.md` (tool list, system prompt rules)
- `build-plan.md` (Postgres URL, CORS origins, retrieval params, model ID)

Specific files generated:
- `backend/src/server.ts` — Fastify bootstrapping, route registration, middleware.
- `backend/src/routes/chat.ts` — the `/v1/chat` endpoint (the actual runtime logic is defined in Feature 003; this feature sets up the scaffolding).
- `backend/src/tools.ts` — typed tool definitions, one per entry in `action-manifest.md`.
- `backend/src/prompts.ts` — the system prompt composed from `brief.md` and `action-manifest.md`.
- `backend/src/config.ts` — environment variable schema, defaults, validation (with zod).

**Widget bundle.** `esbuild` run over `packages/widget/src/index.ts` → `dist/widget.js` (IIFE) and `dist/widget.css`. Target size: ≤80KB gzipped. Configuration values injected at build time via `define` (backend URL placeholder, theme, feature flags).

The actual widget UI logic is implemented in Feature 003; this feature ensures the build command can produce the bundle when Feature 003's source exists.

**Rendering is idempotent.** A template's output is compared to the existing file before writing. If identical, no write happens. If different, the file is overwritten (with a backup suffix if `--backup` is specified).

### 5.6 Docker image build

`docker build -t atw_backend:latest backend/` runs as the final step. Base image: `node:20-alpine`. Multi-stage build: one stage installs and compiles TypeScript, final stage copies only the compiled output and production dependencies.

The image ships with the embedding model pre-cached so that the runtime container starts quickly (no first-call model download).

After build, the image is referenced in the project root `docker-compose.yml` (which was templated in Feature 001). If the file still has ATW services commented out, this command uncomments them. If they're already active, nothing changes.

### 5.7 State and idempotency

**`.atw/state/build-manifest.json`** is written after every build (successful or partial). Structure:

```json
{
  "build_id": "2026-04-22T14:12:03Z",
  "started_at": "2026-04-22T14:12:03Z",
  "completed_at": "2026-04-22T14:28:06Z",
  "duration_seconds": 963,
  "total_entities": 342,
  "enriched": 340,
  "skipped_unchanged": 0,
  "failed": 2,
  "failures": [
    { "entity_type": "product", "entity_id": "prod_xyz", "reason": "insufficient_data", "details": "..." },
    { "entity_type": "product", "entity_id": "prod_abc", "reason": "validation_failed", "details": "fact without source" }
  ],
  "opus_calls": 342,
  "opus_cost_usd": 10.18,
  "input_hashes": {
    "brief": "sha256:...",
    "schema-map": "sha256:...",
    "action-manifest": "sha256:...",
    "build-plan": "sha256:..."
  },
  "artifacts_produced": [
    "atw_postgres container (image pinned)",
    "atw_documents table with 340 rows",
    "backend/src/*.ts rendered",
    "dist/widget.js (72kb gz)",
    "dist/widget.css (4kb gz)",
    "atw_backend:latest image"
  ]
}
```

**Idempotency logic:**
- Re-running with unchanged artifact hashes and unchanged `client_ref` data skips to "nothing to do."
- A changed `schema-map.md` triggers re-enrichment of newly added entities and re-evaluation of previously ignored tables.
- A changed `action-manifest.md` triggers only template re-rendering and image rebuild (no enrichment changes).
- A changed `brief.md` triggers re-rendering of the system prompt (backend) plus a warning that existing enrichments were anchored to the old brief — the Builder decides whether to re-enrich with `--force`.

### 5.8 Auxiliary scripts introduced in this feature

Under `packages/scripts/`:
- `import-sql-dump.ts` — runs `psql` to load the dump, filtered by schema-map tables.
- `assemble-entity.ts` — produces the structured JSON input for enrichment given an entity definition and a Postgres connection.
- `enrich-entity.ts` — wraps the Opus call with prompt rendering and validation.
- `validate-enrichment.ts` — the structural validator for Opus output.
- `embed-text.ts` — wraps `@xenova/transformers` inference.
- `upsert-document.ts` — writes to `atw_documents`.
- `render-template.ts` — renders a Handlebars template to a file, with idempotency.
- `compile-widget.ts` — drives esbuild.
- `build-backend-image.ts` — orchestrates `docker build`.
- `write-build-manifest.ts` — serializes state to JSON.

All single-responsibility, typed, testable.

---

## 6. Artifacts produced by this feature

After Feature 002 completes:

**In the Builder's project:**
```
.atw/
└── state/
    └── build-manifest.json

backend/                 (rendered)
├── src/
│   ├── server.ts
│   ├── routes/
│   │   └── chat.ts
│   ├── tools.ts
│   ├── prompts.ts
│   └── config.ts
├── Dockerfile
├── package.json
└── tsconfig.json

dist/
├── widget.js
└── widget.css

docker-compose.yml       (updated: ATW services active)
```

**In the running Postgres (`atw_postgres`):**
- `client_ref` schema populated with tables from the Builder's dump.
- `atw_documents` table populated with ~340 enriched entity documents.

**In the Docker images:**
- `atw_backend:latest` image built locally.

**In the AI to Widget package (source of truth):**
```
packages/
├── backend/
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   └── 002_documents.sql
│   ├── src/
│   │   ├── server.ts.hbs
│   │   ├── routes/chat.ts.hbs
│   │   ├── tools.ts.hbs
│   │   ├── prompts.ts.hbs
│   │   └── config.ts.hbs
│   ├── Dockerfile.hbs
│   └── package.json.hbs
├── widget/
│   └── src/...              (populated in Feature 003; this feature establishes the structure)
└── scripts/
    ├── import-sql-dump.ts
    ├── assemble-entity.ts
    ├── enrich-entity.ts
    ├── validate-enrichment.ts
    ├── embed-text.ts
    ├── upsert-document.ts
    ├── render-template.ts
    ├── compile-widget.ts
    ├── build-backend-image.ts
    └── write-build-manifest.ts

commands/
└── atw.build.md
```

---

## 7. Non-functional requirements

**Performance.**
- For the Aurelia demo (~342 entities), full build completes in 12-18 minutes on a modern developer laptop.
- For small projects (<50 entities), full build completes in under 5 minutes.
- Idempotent re-run with no changes completes in under 30 seconds.
- Embedding computation: ≥100 embeddings per minute on CPU.

**Cost.**
- Enrichment is the only Opus-driven step. Cost scales linearly with entity count.
- Aurelia-scale build: ~$10.
- Estimate in `build-plan.md` must be within 20% of actual.

**Reliability.**
- Transient network errors never abort the build; they trigger retries.
- A fatal error (auth, disk full, Docker down) aborts cleanly with a diagnostic message.
- Partial builds do not leave the database in an inconsistent state: every upsert is atomic, and `build-manifest.json` is written at the end (after success) or as a partial-state record on abort.

**Determinism.**
- Same inputs, same prompts → semantically equivalent outputs. Prose may vary; structural content does not.
- Embedding output is deterministic.
- Template rendering is deterministic.

**Security.**
- The SQL dump is loaded into a local Postgres container over a local socket; it never leaves the Builder's machine except as the content of Opus enrichment prompts (which the Builder has chosen to send).
- Opus prompts for enrichment never include fields flagged as PII in `schema-map.md`.
- The backend image does not bake in any secrets; secrets are provided at runtime via environment variables.
- The `atw_postgres` container's credentials are local-only (`atw_local` or similar) and do not grant any privileges outside the container.

**Reproducibility.**
- The build runs on macOS, Linux, and WSL2 with Docker installed. No platform-specific steps.
- Dependencies pinned (image tags, package versions).
- Model download verified by hash.

---

## 8. Success criteria for this feature

1. **Fresh-run success.** Starting from a fresh clone with Feature 001's artifacts in place for the Aurelia demo, `/atw.build` completes successfully in under 20 minutes with no manual intervention.

2. **Anchored enrichment.** Inspecting any 10 random rows in `atw_documents`, every `claim` in `facts` cites a source field that appears in the source data. Zero invented facts.

3. **Resumable.** Killing the command halfway through enrichment and rerunning resumes from where it left off; total cost for two halves equals cost for one complete run (within 5% for retry overhead).

4. **Deterministic structure.** Running the build twice on unchanged inputs produces bit-identical `backend/src/*.ts` files, bit-identical `dist/widget.js`, and semantically equivalent `atw_documents` rows (same entity ids, same facts structure, embeddings within cosine similarity 0.999).

5. **Clean failure reporting.** Deliberately introducing a bad input (e.g., an OpenAPI spec referencing an action that's not in the manifest) surfaces a clear error identifying the root cause, not a stack trace.

6. **Cost estimate accuracy.** The estimate shown at command start is within 20% of actual cost for the Aurelia demo.

7. **Idempotent-on-nothing.** Re-running with zero changes completes in under 30 seconds and reports "nothing to do" with no Opus calls.

8. **PII not embedded.** Searching the content of all `atw_documents.document` and `atw_documents.facts` fields, no PII-flagged column value from `schema-map.md` appears anywhere.

9. **Constitution compliance.** Strict adherence to principles 1, 3, 5, 6, 7, 8, 9.

---

## 9. Handoff to Feature 003

Feature 003 (runtime) assumes:

- `atw_postgres` is running with `atw_documents` populated (~340 rows for Aurelia).
- `atw_backend:latest` Docker image is built locally.
- `dist/widget.js` and `dist/widget.css` exist at the project root.
- `backend/` contains readable, working TypeScript source that compiles with `tsc`.
- The system prompt in `backend/src/prompts.ts` reflects `brief.md` and `action-manifest.md`.
- The tool definitions in `backend/src/tools.ts` reflect `action-manifest.md` exactly.
- The schema of `atw_documents` matches what Feature 003's retrieval query expects.

Feature 003 must not change the schema of `atw_documents` or the shape of any rendered file without also updating this feature's templates and migrations.

---

## 10. Out of scope for this feature (explicit reminder)

- Serving HTTP traffic from the backend. The backend is compiled and imaged but not exercised.
- Rendering the widget UI in a browser. The widget is compiled but not loaded.
- The `/atw.embed` and `/atw.verify` commands.
- Integration with the Medusa demo storefront.
- Any real-time database sync mechanism.
- Multi-tenant data isolation (single project per installation).

---

## 11. Failure modes and edge cases

| Situation | Handling |
|---|---|
| Docker not running | Detect at start; ask Builder to start Docker; halt |
| Disk full | Halt with clear message; point to the Postgres volume path |
| Port 5433 already in use | Surface conflict; suggest `--postgres-port` override |
| Migration fails | Halt; Postgres volume can be inspected/removed for retry |
| SQL dump contains extensions we can't replicate | Warn and skip those extensions; continue with tables that do import |
| SQL dump references missing data | Import continues table by table; missing referential integrity is reported but not fatal |
| Opus 401 mid-build | Halt; don't consume quota we can't use |
| Opus 429 sustained | Lower concurrency automatically (10 → 3); if still failing, halt |
| Opus 5xx sustained | Halt after 10% of entities fail; partial state preserved |
| Validation fails for an entity | Retry once with sharpened prompt; on second failure, flag and continue |
| Disk OOM on embedding model | Halt; suggest smaller model or more RAM |
| Model download fails | Halt; print alternative manual download instructions |
| Build interrupted by Ctrl+C | In-flight requests complete; partial state is recoverable; next run resumes |
| Builder edits a template file between builds | Template edit is preserved only if the source `.hbs` wasn't modified; otherwise overwritten with backup |

---

## 12. Constitution principles that apply most strongly

- **P1 (User Data Sovereignty).** SQL dump stays local; no remote database access.
- **P3 (Idempotent and Interruptible).** Core requirement of this feature.
- **P5 (Anchored Generation).** Enrichment is the moment this principle is actually enforced.
- **P6 (Composable Deterministic Primitives).** Parsers, assemblers, validators, embedders, renderers are all typed deterministic scripts. Opus is isolated to one step.
- **P7 (Single-Ecosystem Simplicity).** TypeScript + Postgres + Docker.
- **P8 (Reproducibility).** Pinned images, deterministic embeddings, deterministic rendering.
- **P9 (Opus as a Tool, Not a Crutch).** One Opus call per entity, with a budgeted cost estimate.

---

*End of Feature 002 specification. Pass this document to `/speckit.specify` along with a prompt like: "Specify this feature based on the document, following the project constitution in constitution.md. This feature consumes the markdown artifacts produced by Feature 001 (samples in examples/) and produces a running local system."*

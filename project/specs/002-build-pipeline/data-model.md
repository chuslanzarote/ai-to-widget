# Data Model: Build Pipeline (Feature 002)

**Feature**: Build Pipeline
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-22

This document is the authoritative shape reference for every piece of
persistent or semi-persistent state that Feature 002 produces or
consumes. It covers three layers:

1. Database schema (Postgres + pgvector)
2. On-disk state and derived files
3. In-flight pipeline objects (TypeScript types held only during a build)

Every type listed here is mirrored by a `zod` schema in
`packages/scripts/src/lib/types.ts` and validated at the boundary where
the data first enters the pipeline.

---

## 1. Database schema

All tables live under the default `public` schema **except** the
Builder's imported data, which is quarantined under `client_ref`. The
`atw_migrations` runner creates schemas and tables in this order:

### 1.1 `atw_migrations`

Tracks which SQL migration files have been applied.

| Column      | Type                      | Notes                                   |
|-------------|---------------------------|-----------------------------------------|
| `id`        | `text PRIMARY KEY`        | e.g. `001_init`                         |
| `filename`  | `text NOT NULL`           | e.g. `001_init.sql`                     |
| `sha256`    | `text NOT NULL`           | SHA-256 of the SQL file contents        |
| `applied_at`| `timestamptz NOT NULL DEFAULT now()` | one row written per successful migration |

**Rules.**

- A migration is only applied when no row exists for its `id`.
- If a row exists but the `sha256` differs from the file on disk, the
  runner halts with a diagnostic (file was edited after application).
  Editing applied migrations is never allowed; add a new migration.

### 1.2 `client_ref` schema

Holds the Builder's imported SQL dump, filtered at import to include
only tables classified as `primary` or `related` in `schema-map.md`.
PII-flagged tables are never imported; PII-flagged columns are
`ALTER TABLE ... DROP COLUMN`'d immediately after dump replay completes.

The exact table set is Builder-specific. Ownership and grants are
scoped such that only the AI to Widget runtime role can `SELECT` from
these tables.

### 1.3 `atw_documents`

The enriched document index. One row per indexable entity instance.

| Column          | Type                              | Notes                                                |
|-----------------|-----------------------------------|------------------------------------------------------|
| `entity_type`   | `text NOT NULL`                   | e.g. `product`, `variant`, `collection`, `region`    |
| `entity_id`     | `text NOT NULL`                   | the primary key value from `client_ref.<table>`      |
| `document`      | `text NOT NULL`                   | natural-language enriched description (embedded)     |
| `facts`         | `jsonb NOT NULL`                  | array of `{claim, source}` pairs (Principle V)       |
| `categories`    | `jsonb NOT NULL`                  | map of vocabulary label arrays                       |
| `embedding`     | `vector(384) NOT NULL`            | pgvector, 384-dim, from bge-small-multilingual-v1.5  |
| `source_hash`   | `text NOT NULL`                   | SHA-256 over assembled input + prompt version + model id |
| `opus_tokens`   | `jsonb NOT NULL`                  | `{input_tokens, output_tokens}` for cost attribution  |
| `created_at`    | `timestamptz NOT NULL DEFAULT now()` |                                                   |
| `updated_at`    | `timestamptz NOT NULL DEFAULT now()` | refreshed on upsert                               |

**Constraints.**

- `PRIMARY KEY (entity_type, entity_id)` — unique per entity instance.
- `CREATE INDEX atw_documents_embedding_hnsw_idx ON atw_documents USING hnsw (embedding vector_cosine_ops)`.
- `CREATE INDEX atw_documents_source_hash_idx ON atw_documents (source_hash)` — fast resume-path lookup.

**Upsert semantics** (FR-065 step 4):

- If `(entity_type, entity_id)` already exists AND `source_hash` matches
  AND `--force` was not supplied → the row is untouched; zero writes.
- If the row exists but `source_hash` differs OR `--force` is supplied →
  `UPDATE` is performed in a single statement that sets all columns and
  updates `updated_at`.
- If no row exists → `INSERT`.

**Validation.**

- `facts` is validated against `FactsArraySchema` in `types.ts`.
- `categories` labels are validated against the vocabulary declared in
  `build-plan.md` for the entity type; unknown labels cause the Opus
  response to be rejected at enrichment time, not at upsert.
- `embedding` dimension is validated at `upsert-document.ts` entry;
  any length other than 384 is a bug.

---

## 2. On-disk state

All Feature 002 on-disk state lives under `.atw/` in the Builder's
project. Feature 001's files are re-used as inputs; this feature writes
two new files.

### 2.1 `.atw/state/build-manifest.json`

**Shape** (zod schema in `types.ts` as `BuildManifestSchema`):

```jsonc
{
  "schema_version": "1",
  "build_id": "atw-build-20260422T143022-7f3c",          // ISO-8601 compact + short random
  "started_at": "2026-04-22T14:30:22.481Z",
  "completed_at": "2026-04-22T14:47:11.902Z",
  "duration_seconds": 1009.421,
  "result": "success",                                   // "success" | "partial" | "aborted" | "failed"
  "totals": {
    "total_entities": 342,
    "enriched": 327,
    "skipped_unchanged": 0,
    "failed": 15
  },
  "failures": [
    {
      "entity_type": "product",
      "entity_id": "prod_01H2X...",
      "reason": "insufficient_data",
      "opus_response_excerpt": "..."
    }
  ],
  "opus": {
    "calls": 327,
    "input_tokens": 1_842_103,
    "output_tokens": 418_221,
    "cost_usd": 12.31,
    "estimated_cost_usd": 12.50,
    "cost_variance_pct": -1.52
  },
  "concurrency": {
    "configured": 10,
    "effective_max": 10,             // reduced if sustained 429 was detected
    "reductions": []
  },
  "input_hashes": {
    "project.md": "sha256:...",
    "brief.md": "sha256:...",
    "schema-map.md": "sha256:...",
    "action-manifest.md": "sha256:...",
    "build-plan.md": "sha256:...",
    "sql_dump": "sha256:...",
    "prompt_template_version": "enrich-v1"
  },
  "outputs": {
    "backend_files": [
      { "path": "backend/src/index.ts",     "sha256": "...", "bytes": 2418 },
      { "path": "backend/src/retrieval.ts", "sha256": "...", "bytes": 1802 }
    ],
    "widget_bundle": {
      "js":  { "path": "dist/widget.js",  "sha256": "...", "bytes": 74218 },
      "css": { "path": "dist/widget.css", "sha256": "...", "bytes": 3210 }
    },
    "backend_image": {
      "ref": "atw_backend:latest",
      "image_id": "sha256:...",
      "size_bytes": 284_013_312
    }
  },
  "environment": {
    "platform": "linux-x64",
    "node_version": "20.14.0",
    "docker_server_version": "24.0.7",
    "postgres_image": "pgvector/pgvector@sha256:...",
    "embedding_model": "Xenova/bge-small-multilingual-v1.5@1.0.0"
  }
}
```

**Rules.**

- Written atomically (tmp + fsync + rename) at the end of every run,
  including aborted and failed runs. An aborted run sets `result` to
  `aborted` and `completed_at` to the abort timestamp.
- Every Opus call is accounted for in `opus.calls` regardless of
  whether its response validated — Builder cost does not change based
  on whether the response was usable.
- `schema_version` is incremented with any breaking change to this
  shape. Consumers MUST tolerate unknown fields.
- Read on next invocation to drive the "nothing to do" short-circuit
  and to populate the final Builder-facing cost summary.

### 2.2 `.atw/state/input-hashes.json` (extended from Feature 001)

Feature 001 already maintains this file. Feature 002 adds two keys:

- `sql_dump` — SHA-256 of the SQL dump file most recently imported.
- `prompt_template_version` — literal string taken from the prompt
  template file header.

Feature 001's existing keys (per-artifact hashes) are untouched.

### 2.3 Cached embedding model

- Path: `~/.cache/atw/models/Xenova/bge-small-multilingual-v1.5/`
  (via `env-paths('atw').cache`).
- Contents: the ONNX model, tokenizer JSON, and a version lockfile
  `.atw-model-lock.json` carrying `{model_id, version, sha256}`.
- Refreshed only when the version in `build-plan.md` changes or the
  lockfile is missing.
- Never holds secrets. The directory is world-readable where possible.

### 2.4 Rendered backend source (written into Builder project)

- Path: `backend/src/*.ts` at the Builder's project root.
- Owned by the Builder after generation. Overwritten only when the
  template or its inputs (project.md, brief.md, action-manifest.md,
  build-plan.md) change — and then only after writing a `.bak` sibling
  if `--backup` is set.
- A manifest-stored `sha256` per file supports the incremental rebuild
  decision.

### 2.5 Widget bundle

- Paths: `dist/widget.js`, `dist/widget.css` (IIFE + CSS).
- Overwritten on every build when inputs changed. Deterministic under
  unchanged inputs.

---

## 3. In-flight pipeline objects (transient, not persisted)

These types exist only during a single run. They are still first-class
citizens in the code because the scripts that produce and consume them
MUST agree on their shape.

### 3.1 `AssembledEntityInput`

The structured JSON object passed to Opus for enrichment. Produced by
`assemble-entity-input.ts`.

```ts
type AssembledEntityInput = {
  entity_type: string;                 // "product", "variant", etc.
  entity_id: string;                   // primary key value
  primary_record: Record<string, JsonValue>;  // PII-column-filtered row
  related: Array<{
    relation: string;                  // the relation name from schema-map.md
    rows: Array<Record<string, JsonValue>>;  // PII-column-filtered joined rows
  }>;
  metadata: {
    assembled_at: string;              // ISO-8601, NOT hashed (excluded from source_hash)
    assembler_version: string;         // bumped if the assembler logic changes
  };
};
```

**Invariants.**

- Every column present in the primary or related record MUST be either
  non-PII per `schema-map.md` or an explicitly-whitelisted technical
  key (primary key, entity_type). PII-present is a bug that trips the
  compliance scan as a belt-and-suspenders check.
- `metadata` is NOT included in the `source_hash` computation (so
  assembling at different times does not force re-enrichment).
- Keys in any object are sorted alphabetically before JSON
  canonicalization (for `source_hash` stability).

### 3.2 `EnrichmentResponse`

Opus's structured output for one entity. Received from the Anthropic
SDK, structurally validated by `enrichment-validator.ts` before any
write.

```ts
type EnrichmentResponse =
  | {
      kind: "enriched";
      document: string;                  // ≥ 40 chars, the text to embed
      facts: Array<{
        claim: string;                   // non-empty
        source: string;                  // MUST appear in the assembled input
      }>;
      categories: Record<string, string[]>;
    }
  | {
      kind: "insufficient_data";
      reason: string;                    // short Builder-facing explanation
    };
```

**Validation rules.** See `research.md` §10.

### 3.3 `BuildPlan`

Loaded once at the start of a build from `.atw/artifacts/build-plan.md`.
Holds the knobs the pipeline defers to.

```ts
type BuildPlan = {
  schema_version: "1";
  postgres: {
    image: string;                       // "pgvector/pgvector@sha256:..."
    port: number;                        // default 5433
    container_name: string;              // "atw_postgres"
    volume_name: string;                 // "atw_postgres_data"
  };
  embedding: {
    model_id: string;                    // "Xenova/bge-small-multilingual-v1.5"
    version: string;                     // "1.0.0"
    dimensions: 384;
  };
  enrichment: {
    model: "claude-opus-4-7";
    prompt_template_version: string;    // "enrich-v1"
    default_concurrency: number;         // 10
    estimated_cost_usd: number;          // used for pre-build plan summary
    estimated_duration_minutes: [number, number]; // [low, high]
    category_vocabularies: Record<string, string[]>; // label allow-list per entity type
  };
  runtime: {
    backend_image_ref: string;           // "atw_backend:latest"
    dockerfile_path: string;             // relative to repo root
  };
};
```

### 3.4 `PipelineProgress`

A single progress event streamed to the Builder (every ≥ 5 entities or
≥ 10 seconds). Not persisted, but formally typed so the terminal
formatter can trust it.

```ts
type PipelineProgress = {
  phase: "boot" | "import" | "enrich" | "render" | "bundle" | "image";
  enriched: number;
  skipped: number;
  failed: number;
  total_entities: number;
  cumulative_cost_usd: number;
  elapsed_seconds: number;
  eta_seconds: number | null;
};
```

---

## 4. Relationships at a glance

```text
Feature 001 artifacts (markdown)      →  BuildPlan (runtime config)
                                      →  AssembledEntityInput (per entity)
                                         →  Opus →  EnrichmentResponse
                                                    ↓ validator (Principle V)
                                                    ↓ embed-text.ts
                                                    ↓ upsert-document.ts
                                                    →  atw_documents row
                                                         ↓
                                                         PII compliance scan
                                                         ↓
Feature 001 artifacts (markdown)      →  Handlebars  →  backend/src/*.ts (atomic)
                                      →  esbuild     →  dist/widget.js + widget.css
                                                         ↓
                                                         multi-stage Dockerfile
                                                         →  atw_backend:latest
                                                              ↓
                                                              docker-compose activation
                                                              ↓
                                                              build-manifest.json
                                                              ↓
                                                              input-hashes.json update
```

---

## Principle compliance notes

- **I (red line).** `client_ref` schema quarantines Builder data. PII
  columns never enter `AssembledEntityInput`. The compliance scan
  (§2.1 outputs + `scan-pii-leaks.ts`) catches belt-and-suspenders
  failures.
- **II.** Every decision lives in markdown (`build-plan.md` especially).
  Database state is operational, manifest is derivative.
- **V (red line).** `EnrichmentResponse` validation rejects uncited
  facts; `source_hash` binds persistence to the exact assembled input
  and prompt that produced it.
- **VIII (red line).** `embedding_model`, `postgres_image`, and every
  dependency version are captured in `build-manifest.json.environment`
  so runs are forensically reproducible.

# Contract: auxiliary scripts

**Feature**: Build Pipeline (Feature 002)
**Date**: 2026-04-22

This contract fixes the CLI shape for every new auxiliary script that
`packages/scripts` ships under Feature 002. Every script is invoked by
a sibling binary shim in `packages/scripts/bin/atw-*.js` (so the
`/atw.build` markdown can call them via `npx atw-<script>`), returns
zero on success and a meaningful non-zero code on failure, logs a
one-line diagnostic to stderr on any non-zero exit, and is
independently unit-testable.

Every script accepts `--help`, `--version`, and `--json` (the last one
enables machine-readable stdout for composition by the `/atw.build`
command).

---

## Scripts delivered by this feature

### 1. `atw-start-postgres`

**Purpose.** Start (or no-op if already running) the `atw_postgres`
container with the image and port declared in `build-plan.md`.

```
atw-start-postgres [--port <n>] [--wait-seconds <n>] [--json]
```

- Exit 0: container is running and accepting connections.
- Exit 3: Docker unreachable.
- Exit 4: port conflict — stderr names the occupying PID when detectable.

**JSON output.** `{ "container_id": "...", "port": 5433, "started": true|false }`.

---

### 2. `atw-apply-migrations`

**Purpose.** Apply any pending SQL migrations from
`packages/scripts/src/migrations/` to the running `atw_postgres`.
Idempotent via the `atw_migrations` table.

```
atw-apply-migrations [--dry-run] [--json]
```

- Exit 0: all migrations present and checksums match.
- Exit 5: a prior-applied migration's on-disk file was edited.
- Exit 6: a migration failed to apply (SQL error).

**JSON output.** `{ "applied": ["001_init"], "skipped": ["002_..."], "failed": [] }`.

---

### 3. `atw-import-dump`

**Purpose.** Replay a filtered SQL dump into the `client_ref` schema.
Filtering: only primary/related tables from `schema-map.md`; drop
PII-flagged columns; skip PII-flagged tables entirely.

```
atw-import-dump --dump <path> --schema-map <path> [--replace] [--json]
```

- `--replace` drops and re-creates the matching tables in `client_ref`
  before replaying. Without `--replace`, existing tables are left
  alone and only new ones are imported (FR-061).
- Exit 0: all expected tables imported.
- Exit 7: dump references a Postgres extension not available in the
  container (warn + skip — still exit 0 for tables that did import;
  set `warnings` array in JSON output).
- Exit 8: dump parse error.

**JSON output.**

```jsonc
{
  "imported": ["product", "product_variant", "product_collection"],
  "excluded_pii_tables": ["customer", "customer_address"],
  "dropped_pii_columns": [["product", "internal_note"], ...],
  "warnings": ["Skipped unsupported extension: pg_repack"]
}
```

---

### 4. `atw-assemble-entity-input`

**Purpose.** Produce one `AssembledEntityInput` JSON object for one
entity. Invoked once per entity by the enrichment orchestrator.

```
atw-assemble-entity-input --entity-type <t> --entity-id <id> --schema-map <path> [--json]
```

- Exit 0: structured JSON printed to stdout.
- Exit 9: entity_id not found in `client_ref`.
- Exit 10: schema-map refers to tables/columns not present in
  `client_ref` (corruption — halt the build).

**JSON output.** Matches `AssembledEntityInput`
([data-model.md §3.1](../data-model.md)).

---

### 5. `atw-enrich-entity`

**Purpose.** Send one assembled input to Opus, validate the response,
return a typed `EnrichmentResponse`. Does not write to Postgres —
composition with upsert is the caller's job.

```
atw-enrich-entity --input <path-or-stdin> --build-plan <path> [--retry-strategy aggressive|conservative] [--json]
```

- Exit 0: validation passed (either enriched or `insufficient_data`).
- Exit 11: validation failed twice (FR-067) — response attached to
  JSON output for debugging.
- Exit 12: Anthropic API authentication failed (halt the whole build).
- Exit 13: Anthropic API rate limit exhausted even after backoff.

**JSON output.** `{ "response": EnrichmentResponse, "tokens": {...}, "cost_usd": number }`.

---

### 6. `atw-embed-text`

**Purpose.** Produce a 384-dim embedding for a given text via
`@xenova/transformers`. Loads (and caches) the model on first call.

```
atw-embed-text --text <string> [--model <id>] [--json]
```

- Exit 0: vector printed to stdout as JSON array.
- Exit 14: model download failed on first call — stderr gives the
  manual download URL.

**JSON output.** `{ "embedding": [0.0123, -0.0471, ...], "dimensions": 384 }`.

---

### 7. `atw-upsert-document`

**Purpose.** Upsert one row into `atw_documents`, honoring the
`source_hash` skip rule.

```
atw-upsert-document --row <path-or-stdin> [--force] [--json]
```

- Input is a JSON object matching the `atw_documents` row shape plus
  `source_hash` and `opus_tokens`.
- Exit 0: row inserted, updated, or deliberately skipped
  (JSON `action` field records which).
- Exit 15: embedding dimension mismatch (bug — halt the build).
- Exit 16: Postgres not reachable.

**JSON output.** `{ "action": "inserted"|"updated"|"skipped", "entity_type": "...", "entity_id": "..." }`.

---

### 8. `atw-render-backend`

**Purpose.** Render every `packages/backend/src/*.hbs` template
idempotently into the Builder's `backend/src/*.ts`. Writes `.bak`
siblings only when `--backup` is set AND the target exists AND the
content differs from the template output.

```
atw-render-backend [--backup] [--json]
```

- Exit 0: rendering complete.
- Exit 17: template compile error.

**JSON output.**

```jsonc
{
  "rendered": [
    { "path": "backend/src/index.ts",     "action": "unchanged" },
    { "path": "backend/src/retrieval.ts", "action": "rewritten", "backup": "backend/src/retrieval.ts.bak" }
  ]
}
```

---

### 9. `atw-compile-widget`

**Purpose.** Bundle `packages/widget/src/` into `dist/widget.js` +
`dist/widget.css` via esbuild. Emits a no-op bundle when the source
directory has no TypeScript entry (Feature 003 will populate later).

```
atw-compile-widget [--minify|--no-minify] [--json]
```

- Exit 0: bundle written (or no-op written for empty source).
- Exit 18: esbuild error (syntax / import).

**JSON output.**

```jsonc
{
  "js":  { "path": "dist/widget.js",  "bytes": 74218, "sha256": "..." },
  "css": { "path": "dist/widget.css", "bytes": 3210,  "sha256": "..." },
  "noop": false
}
```

---

### 10. `atw-build-backend-image`

**Purpose.** Build `atw_backend:latest` via `dockerode` using the
multi-stage Dockerfile at `packages/backend/Dockerfile`. Pre-cache the
embedding model into the image (FR-077).

```
atw-build-backend-image [--tag <ref>] [--json]
```

- Exit 0: image built, tagged, and queryable.
- Exit 19: Docker build error (stderr has the BuildKit output).
- Exit 20: secret detected in build context (pre-build guard — stderr
  names the file).

**JSON output.** `{ "image_id": "sha256:...", "ref": "atw_backend:latest", "size_bytes": 284013312 }`.

---

### 11. `atw-compose-activate`

**Purpose.** Uncomment the AI to Widget block in the project-root
`docker-compose.yml` (written by Feature 001 as a commented-out stub).
No-op when already active.

```
atw-compose-activate [--compose-file <path>] [--json]
```

- Exit 0: block is active (was already or now is).
- Exit 21: compose file not found.

**JSON output.** `{ "action": "activated"|"unchanged", "services": ["atw_postgres", "atw_backend"] }`.

---

### 12. `atw-scan-pii-leaks`

**Purpose.** After the build, compare every PII value from
PII-flagged columns in `schema-map.md` against every
`atw_documents.document` and `atw_documents.facts` text. Matching rule
is case-insensitive substring after whitespace normalization
(Clarifications Q1).

```
atw-scan-pii-leaks --schema-map <path> [--json]
```

- Exit 0: scan clean.
- Exit 22: one or more PII values matched — JSON output has the full
  triple list.

**JSON output.**

```jsonc
{
  "clean": false,
  "matches": [
    {
      "entity_type": "product",
      "entity_id":   "prod_01H2X...",
      "pii_column":  "customer.email",
      "pii_value":   "jdoe@example.com",
      "matched_in":  "facts",
      "snippet":     "...contact jdoe@example.com for..."
    }
  ]
}
```

---

### 13. `atw-write-manifest`

**Purpose.** Atomically write `.atw/state/build-manifest.json` from
the in-memory manifest the orchestrator built during the run.

```
atw-write-manifest --manifest <path-or-stdin> [--json]
```

- Exit 0: file written; path printed.
- Exit 23: manifest schema validation failed (bug — halt build).

**JSON output.** `{ "path": ".atw/state/build-manifest.json", "sha256": "..." }`.

---

## Cross-cutting behavior

All scripts:

- Print exactly one line to stderr on any non-zero exit.
- Emit machine-readable JSON on stdout when `--json` is passed.
- Terminate cleanly on SIGINT (no orphaned subprocesses, open DB
  connections, or Docker exec handles).
- Obey the `DEBUG=atw:*` environment variable for verbose
  diagnostics (using `debug`, which is already a transitive dep).

## Test coverage required

Each script MUST have:

1. A unit test (or skipped with documented reason if it is pure
   orchestration) under `packages/scripts/test/<name>.unit.test.ts`.
2. A contract test verifying the CLI shape under
   `packages/scripts/test/<name>.contract.test.ts`.

Integration is handled collectively by the `tests/integration/build-*`
suite.

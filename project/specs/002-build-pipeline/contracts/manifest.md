# Contract: `build-manifest.json`

**Feature**: Build Pipeline (Feature 002)
**Date**: 2026-04-22
**Path**: `.atw/state/build-manifest.json`
**Schema version**: `"1"`

The build manifest is the single source of truth for "what did this
build do, for how much, and which entities failed." It is written
atomically at the end of every run (including aborted and failed
runs). Consumers: the next `/atw.build` invocation (for "nothing to
do" detection), the Builder during audit, Feature 003's runtime (for
the /info endpoint), and `/speckit.analyze` during compliance review.

---

## 1. Shape (normative)

Shape follows `BuildManifestSchema` in
`packages/scripts/src/lib/types.ts`. The canonical example:

```jsonc
{
  "schema_version": "1",
  "build_id": "atw-build-20260422T143022-7f3c",
  "started_at": "2026-04-22T14:30:22.481Z",
  "completed_at": "2026-04-22T14:47:11.902Z",
  "duration_seconds": 1009.421,
  "result": "success",

  "totals": {
    "total_entities": 342,
    "enriched": 327,
    "skipped_unchanged": 0,
    "failed": 15
  },

  "failures": [
    {
      "entity_type": "product",
      "entity_id": "prod_01H2XABC",
      "reason": "insufficient_data",
      "details": "Opus returned {insufficient_data: true}; no product description column populated"
    }
  ],

  "opus": {
    "calls": 327,
    "input_tokens": 1842103,
    "output_tokens": 418221,
    "cost_usd": 12.31,
    "estimated_cost_usd": 12.50,
    "cost_variance_pct": -1.52
  },

  "concurrency": {
    "configured": 10,
    "effective_max": 10,
    "reductions": []
  },

  "input_hashes": {
    "project.md": "sha256:1a2b...",
    "brief.md":  "sha256:...",
    "schema-map.md": "sha256:...",
    "action-manifest.md": "sha256:...",
    "build-plan.md": "sha256:...",
    "sql_dump": "sha256:...",
    "prompt_template_version": "enrich-v1"
  },

  "outputs": {
    "backend_files": [
      { "path": "backend/src/index.ts",     "sha256": "...", "bytes": 2418,  "action": "rewritten" },
      { "path": "backend/src/retrieval.ts", "sha256": "...", "bytes": 1802,  "action": "unchanged" }
    ],
    "widget_bundle": {
      "js":  { "path": "dist/widget.js",  "sha256": "...", "bytes": 74218 },
      "css": { "path": "dist/widget.css", "sha256": "...", "bytes": 3210 }
    },
    "backend_image": {
      "ref": "atw_backend:latest",
      "image_id": "sha256:...",
      "size_bytes": 284013312
    }
  },

  "environment": {
    "platform": "linux-x64",
    "node_version": "20.14.0",
    "docker_server_version": "24.0.7",
    "postgres_image_digest": "pgvector/pgvector@sha256:...",
    "embedding_model": "Xenova/bge-small-multilingual-v1.5@1.0.0"
  },

  "compliance_scan": {
    "ran": true,
    "clean": true,
    "values_checked": 2401,
    "matches": []
  }
}
```

---

## 2. Field semantics

### 2.1 Identity

- `schema_version` — starts at `"1"`. Breaking-shape changes MUST
  bump this and retain backward-compatible parsing in the next
  reader.
- `build_id` — unique per run. Format: `atw-build-<ISO8601-compact>-<4-hex>`.
  The hex suffix is derived from `crypto.randomBytes(2)`.

### 2.2 Timing

- `started_at` — instant the plan summary was confirmed (so timing
  does not include Builder deliberation).
- `completed_at` — instant just before manifest write.
- `duration_seconds` — `completed_at - started_at`, as a float.

### 2.3 Result

One of:

- `"success"` — all entities enriched (or skipped-unchanged),
  outputs written, compliance scan clean. No failures.
- `"partial"` — build completed end-to-end but `failed > 0`.
- `"aborted"` — SIGINT was received; an ordered shutdown ran.
- `"failed"` — fatal error; no outputs beyond what was already
  written atomically. Includes auth halts, Docker-down halts, and
  compliance-scan failures.

### 2.4 Totals

- `total_entities` — count of indexable entities in `schema-map.md`
  at build-start.
- `enriched` — rows that received a fresh Opus call this build.
- `skipped_unchanged` — rows where `source_hash` matched and
  `--force` was not supplied.
- `failed` — entries in `failures[]`.

Invariant: `enriched + skipped_unchanged + failed == total_entities`
for any `result != "aborted"`.

### 2.5 Failures

One entry per entity the build could not index. `reason` is a short
enum string:

- `insufficient_data` — Opus said so.
- `validation_failed_twice` — see `contracts/enrichment.md` §3.
- `opus_400` — Anthropic returned 400.
- `opus_5xx_twice` — two 5xx responses in a row for one entity.
- `missing_source_data` — assembler found no primary row for the
  entity_id.

`details` is a free-form human-readable string, never a bare stack
trace.

### 2.6 Opus accounting

- `calls` — every Opus API call made during enrichment, regardless
  of whether its response validated. Cost is paid either way.
- `input_tokens`, `output_tokens` — sum across all calls.
- `cost_usd` — computed from the pricing constants in
  `packages/scripts/src/lib/pricing.ts`.
- `estimated_cost_usd` — value from `build-plan.md`.
- `cost_variance_pct` — `(actual - estimated) / estimated * 100`,
  signed. SC-017 asserts `|variance| ≤ 20` on the Aurelia fixture.

### 2.7 Concurrency

- `configured` — the value the Builder invoked with (default 10).
- `effective_max` — the highest concurrency actually used during
  the build (may be lower than configured after auto-reduction).
- `reductions` — each `{at, from, to, reason}` record of an
  auto-reduce event (typically triggered by sustained 429s).

### 2.8 Input hashes

Every content hash that participates in the "nothing to do"
short-circuit decision. Prefixed `sha256:`. `prompt_template_version`
is a literal string, not a hash — it's already a version.

### 2.9 Outputs

Records per-file result of rendering (`rewritten` vs `unchanged`)
and per-bundle byte size + content hash. `backend_image.image_id`
and `size_bytes` come from the Docker daemon post-build.

### 2.10 Environment

Captured at build-start from the host and the Docker daemon.
`postgres_image_digest` is the actual digest the daemon resolved (not
the tag), so reproducibility is verifiable.

### 2.11 Compliance scan

- `ran` — false only when `--entities-only` was passed and the scan
  was skipped by design.
- `clean` — true iff `matches.length === 0`.
- `values_checked` — product of (PII values observed in
  `client_ref`) × (matchable text fragments in `atw_documents`).
- `matches` — one entry per `(entity, pii_column, matched_snippet)`
  triple detected.

---

## 3. Atomic-write contract

The manifest MUST be written atomically:

1. Serialize JSON with stable key order and 2-space indent.
2. Write to `.atw/state/build-manifest.json.tmp`.
3. `fsync` the temp file.
4. `rename` over the target.
5. `fsync` the parent directory.

A crashed write MUST leave either the previous manifest or no
manifest at all — never a half-written file. The orchestrator
tolerates a missing manifest on next invocation (treats the build
as "never run before").

---

## 4. Compatibility guarantees

- Unknown fields — parsers MUST tolerate and preserve them on
  round-trip.
- Missing optional fields — consumers substitute defaults rather
  than crashing (`concurrency.reductions = []` if absent).
- Schema version bumps — the reader library exposes a `migrate(old)`
  function that upconverts older manifests to the current shape.

---

## 5. Contract tests

`packages/scripts/test/write-manifest.contract.test.ts`:

- A synthesized manifest round-trips through zod validation.
- A manifest with unknown fields parses without error.
- A manifest missing optional fields parses with defaults.
- Two writes at the same path with identical content produce
  byte-identical files (determinism).
- An interrupted write leaves no partial file.

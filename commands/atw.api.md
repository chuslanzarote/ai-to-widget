---
description: "Emit the action manifest in a single LLM-native pass."
argument-hint: "[openapi-file-or-url]"
---

# `/atw.api` (alias: `/atw.classify`)

**Purpose.** Hand the Builder's full bundled OpenAPI document and the
Builder's `project.md` to the model in one call, and let the model emit a
schema-validated action manifest. Writes
`.atw/artifacts/action-manifest.md` (YAML frontmatter + markdown body) and
records the LLM-call provenance into `build-provenance.json`. **One**
LLM call per source document — no chunking, no pre-filter passes, no
allowlist heuristics (Feature 009 / FR-001, FR-002, FR-003, FR-005).

`/atw.classify` is the same command — both names invoke the same
`packages/scripts/src/classify-actions.ts` entry point (R11).

## Preconditions

- `.atw/config/project.md` exists and validates against the
  `project-md.schema.json` contract (origins, deployment, optional
  `model_snapshot`).
- The Builder can provide an OpenAPI 3.0 or 3.1 document (local path
  or URL). Swagger 2.0 is detected and refused with a conversion hint.
- `dist/` is fresh (the bin shim refuses on stale `dist/` per FR-032).

## Steps

1. **Accept input.** Local file path or `http(s)://` URL. Swagger 2.0
   → halt with the conversion hint, no LLM call. OpenAPI 3.x → continue.

2. **Deterministic parse + bundle.** `parse-openapi.ts` calls
   `@apidevtools/swagger-parser`'s `bundle()` so external `$ref`s are
   inlined while internal `$ref`s remain (R1). Structural-only filters
   apply: `OPTIONS`/`HEAD` excluded, no-response operations excluded
   (FR-003, FR-004). **No semantic pre-filtering.**

3. **Cost preview (FR-006a, R5, Q5).** Print exactly:

   ```
   [classify] OpenAPI: <N> operations | model: <snapshot> | est. cost: ~$<X.XX>
   [classify] Continuing in 2s, Ctrl+C to abort...
   ```

   Wait 2 seconds informationally — there is no `[y/N]` prompt and no
   `--yes` flag. Ctrl+C aborts.

4. **Single LLM call (FR-001, FR-002, R2).** One
   `messages.create()` in `tool_use` mode against the model named in
   `project.md.model_snapshot` (default `claude-opus-4-7`).
   - System prompt states the Constitution V citation requirement.
   - User content blocks: `<project_md>`, `<openapi>` (bundled JSON),
     `<output_schema>` (the action-manifest JSON schema).
   - Tool: `emit_manifest` with the schema as `input_schema`.
   - `temperature: 0`, `tool_choice: { type: "tool", name: "emit_manifest" }`.
   - SDK built-in retries are disabled (`maxRetries: 0`).

5. **Retry policy (FR-008a, R4, Q2).** The call is wrapped in
   `lib/llm-retry.ts`: 3 attempts, 500 ms initial backoff, 2× multiplier,
   ±20% deterministic jitter seeded from
   `(model_snapshot, openapi_sha256, project_md_sha256)`. Retryable:
   408 / 429 / 5xx / network errors. Non-retryable: 400 / 401 / 403 /
   404, schema-validation failures, citation cross-check failures.

6. **Validate (FR-002, FR-008).** Post-call:
   - Run the LLM's tool-call arguments through `ActionManifestSchema`
     (zod). Field-level errors abort the write.
   - Cross-check every `operations[].citation.operation_id` against the
     bundled source. Missing IDs abort.
   - Cross-check that every write operation whose source declares a
     request body has non-empty `input_schema.properties`.
   - Cross-check that every `summary_template` placeholder resolves to
     an `input_schema.properties` key.

7. **Server-side stamp.** The classifier injects `schema_version: "1.0"`,
   `generated_at`, `model_snapshot`, `input_hashes.openapi_sha256`,
   `input_hashes.project_md_sha256`, `operation_count_total`, and
   `operation_count_in_scope` — the LLM cannot stamp those reliably.

8. **Write the artifact (FR-005, FR-007).** YAML frontmatter +
   markdown body via `gray-matter`, written atomically to
   `.atw/artifacts/action-manifest.md` (.tmp + rename).

9. **Announce next step.** End with exactly:

   *"Action manifest written. Next: run `/atw.embed` (or `/atw.build`)."*

## Re-run semantics (FR-008b)

- **Unchanged `(input_hashes, model_snapshot)`** → orchestrator marks
  the CLASSIFY phase `success_cached` and skips the LLM call.
- **Changed inputs or model snapshot** → re-run the call.
- **Failed runs are never cached** (E2).

## Failure handling

- **Parse error** → exit 1, no LLM call.
- **Swagger 2.0** → exit 3, no LLM call, conversion hint surfaced.
- **URL unreachable** → exit 2, offer the local-file fallback.
- **Retry budget exhausted** → exit 4, last error logged.
- **Schema or citation validation fails** → exit 23 with field-level
  paths; the manifest is *not* written.

## Tooling

All deterministic work lives in `@atw/scripts`:

- `atw-parse-openapi --source <path|url> [--out <path>]` —
  `packages/scripts/src/parse-openapi.ts`. Bundle-only, structural
  filters only. Exit codes: 0 ok, 1 parse error / missing file,
  2 URL unreachable, 3 bad CLI args / Swagger 2.0.
- `atw-classify-actions --source <path|url> [--out <path>] [--no-countdown]` —
  `packages/scripts/src/classify-actions.ts`. Single LLM call,
  schema-validated, written via the manifest-io round-trip helper.
- `atw-write-manifest --kind action --manifest <json>` —
  CLI helper to write a pre-validated action manifest from JSON
  (used by tests and replay scripts).

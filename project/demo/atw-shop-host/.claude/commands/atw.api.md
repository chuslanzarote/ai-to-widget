---
description: "Ingest an OpenAPI 3.0.x document and pin it as the project's canonical input artefact."
argument-hint: "[openapi-file-or-url]"
---

# `/atw.api`

**Purpose.** Accept the host's OpenAPI 3.0.x document (file path or
`http(s)://` URL), validate its shape, canonicalise it, and pin it as
a first-class input artefact at `.atw/artifacts/openapi.json` with a
provenance sidecar at `.atw/state/openapi-meta.json`. Deterministic
and LLM-free; this step does **not** classify — that is the job of
`/atw.classify`. Feature 006 split the old combined flow into two
stages so the Builder can iterate on classification without re-fetching
the OpenAPI each time (Principle VIII, FR-002, FR-003).

## Preconditions

- `.atw/config/project.md` and `.atw/config/brief.md` both exist.
- `.atw/artifacts/schema-map.md` recommended but not required (the
  classifier consumes both; this ingest step does not).
- The Builder can provide an OpenAPI 3.0.x document:
  - a local file path (`.json` or `.yaml`), OR
  - an `http(s)://` URL the machine running `/atw.api` can reach.

## Steps

1. **Accept input.** Two forms (FR-002):
   - Path to a local spec file — preferred when the Builder can stage
     it under `.atw/inputs/`.
   - Remote URL. On fetch failure (non-2xx, network error), halt with
     a tip to download locally and pass the path instead. No retries.

2. **Version detection (FR-002).**
   - **Swagger 2.0** → exit 3 with diagnostic
     `Swagger 2.0 input detected. /atw.api requires OpenAPI 3.x.`
     Suggestion: convert via `swagger2openapi` before retrying.
   - **OpenAPI 3.1.x** → exit 1 with a version-out-of-range
     diagnostic. v1 of this feature pins to 3.0.x; 3.1 is deferred.
   - **OpenAPI 3.0.x** → proceed.

3. **Deterministic parse + bundle.** Run `atw-api --source <path|url>`.
   `$ref` resolution goes through `@apidevtools/swagger-parser.bundle()`.
   Duplicate `operationId`s are rejected at this step. On any parse
   error, exit 1 with a diagnostic that names the file offset or the
   duplicate.

4. **Canonicalise + hash.** The bundled document is serialised via
   recursive object-key sort, 2-space indent, and a trailing LF. The
   sha256 is computed over the resulting bytes — not over the parsed
   in-memory shape — so cross-platform byte-identity holds.

5. **Compare + write.** Against the prior `openapi.json` (if present):
   - Hash matches → action `"unchanged"`; no write; mtime preserved.
   - Hash differs AND `--backup` → copy prior to `openapi.json.bak`
     before overwriting.
   - Hash differs (no backup) → overwrite.
   - No prior file → action `"created"`; write.

6. **Emit provenance sidecar.** On `created` or `rewritten`, write
   `.atw/state/openapi-meta.json` with `{sha256, source, fetchedAt}`.
   On `unchanged`, the prior sidecar is preserved so re-runs do not
   churn `fetchedAt`.

7. **Update the determinism ledger.** Set the `openapi` slot in
   `.atw/state/input-hashes.json` to `sha256:<hex>`. Every other slot
   in the ledger is preserved untouched.

8. **Announce next step.** End with exactly:

   *"OpenAPI pinned. Next: run `/atw.classify`."*

## Re-run semantics (Principle VIII, FR-003)

- **Same source bytes** → action is `"unchanged"`; no write; no meta
  churn. Safe to re-run as often as wanted.
- **Source changed** → action is `"rewritten"`; `openapi.json`,
  `openapi-meta.json`, and the ledger's `openapi` slot update
  atomically. The prior file is preserved at `openapi.json.bak` when
  `--backup` is passed.
- **Builder edits to `openapi.json` by hand** → NOT supported. This
  artefact is a machine-canonicalised copy of the Builder's source.
  Edit the source and re-run. The classifier's manifest
  (`action-manifest.md`) is the Builder-edit surface.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success (created / unchanged / rewritten). |
| 1 | Input validation failed (malformed JSON/YAML, ENOENT, unresolved `$ref`, duplicate `operationId`, version outside 3.0.x). |
| 2 | Source URL fetch failed (HTTP non-2xx or network). |
| 3 | Usage error (unknown flag, missing `--source`, Swagger 2.0 input). |

All non-zero exits include a stderr diagnostic beginning with
`atw-api:`.

## Tooling

All deterministic work is delegated to `@atw/scripts`:

- `atw-api --source <path|url> [--backup] [--json]` — wraps
  `packages/scripts/src/atw-api.ts` (programmatic entry `runAtwApi`).
- `packages/scripts/src/parse-openapi.ts` — load → version-check
  (`Swagger20DetectedError`) → `SwaggerParser.bundle()`
  (`ParseOpenAPIError` on unresolved `$ref`) → normalize
  (`DuplicateOperationIdError`).
- `packages/scripts/src/lib/input-hashes.ts` — two-level re-run
  detection; this CLI touches only the `openapi` slot.

See the binding contract at
[`specs/006-openapi-action-catalog/contracts/atw-api-command.md`](../specs/006-openapi-action-catalog/contracts/atw-api-command.md).

# Contract: `/atw.api` command

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §1](../data-model.md)

This contract defines the shape, behaviour, and exit-code semantics of
the `/atw.api` CLI subcommand introduced by this feature. Every bullet
is testable; the contract test
`packages/scripts/test/atw-api.contract.test.ts` enforces it.

---

## 1. Invocation

- **Command**: `atw-api --source <path|url>`
- **Binary**: `packages/scripts/src/atw-api.ts` (new entry; registered
  in `packages/scripts/package.json` under `bin`).
- **Cwd convention**: assumes the current working directory is the
  project root (same convention as `/atw.build`, `/atw.schema`, etc.).
  All artefact writes go under `<cwd>/.atw/`.

## 2. Flags

| Flag               | Type     | Required | Default | Purpose |
|--------------------|----------|----------|---------|---------|
| `--source <path>`  | string   | yes      | —       | File path (absolute or project-relative) OR `http(s)://` URL of the OpenAPI document to ingest. |
| `--backup`         | boolean  | no       | false   | When present AND an `openapi.json` already exists, the prior file is copied to `openapi.json.bak` before overwrite. |
| `--json`           | boolean  | no       | false   | Emit a one-line JSON result on stdout instead of the human-readable status; used by the orchestrator when `/atw.api` is composed. |
| `-h, --help`       | boolean  | no       | false   | Print usage and exit 0. |
| `-v, --version`    | boolean  | no       | false   | Print version and exit 0. |

Unknown flags: exit 3 (usage error), no artefact changes.

## 3. Happy path (new ingest)

1. Parse flags; `--source` is required.
2. Load the document:
   - If `--source` matches `^https?://`, `fetch()` it. On non-2xx,
     exit 2 with `OpenAPIFetchError: HTTP <status>`.
   - Else read from the local filesystem. On `ENOENT`, exit 1 with
     `file not found: <path>`.
3. Pass through `parseOpenAPI({ source })` (existing; see
   `packages/scripts/src/parse-openapi.ts`).
4. On `Swagger20DetectedError`: exit 3 with the diagnostic
   `Swagger 2.0 input detected. /atw.api requires OpenAPI 3.x.`
5. On any `ParseOpenAPIError` (including unresolved `$ref`, invalid
   JSON/YAML, missing `openapi` version, version outside 3.0.x):
   exit 1 with `atw-api: <message>`.
6. Duplicate-operationId detection: walk `paths[*][method].operationId`,
   fail on first duplicate. Diagnostic names both occurrences:
   `duplicate operationId "<id>" at (<method1> <path1>) and
   (<method2> <path2>)`. Exit 1.
7. Canonicalise the bundled document (recursive object-key sort,
   2-space indent, trailing newline).
8. Compute `sha256` of the canonicalised bytes.
9. Compare to the prior `openapi.json` (if present):
   - If hash matches → action is `"unchanged"`; write nothing (mtime
     preserved); emit `unchanged .atw/artifacts/openapi.json`.
   - If hash differs AND `--backup` → write prior to
     `openapi.json.bak` then overwrite.
   - If hash differs AND no backup → overwrite.
   - If no prior file → action is `"created"`; write.
10. Update `.atw/state/input-hashes.json`: set `openapi` to
    `sha256:<hex>`.
11. On `--json`, emit `{"action":"created|unchanged|rewritten","path":".atw/artifacts/openapi.json","sha256":"sha256:..."}` on stdout.
12. Exit 0.

## 4. Exit codes

| Code | Meaning |
|------|---------|
| 0    | Success (created / unchanged / rewritten). |
| 1    | Input validation failed (malformed JSON/YAML, ENOENT, unresolved `$ref`, duplicate operationId, version outside 3.0.x). Diagnostic on stderr names the failure mode. |
| 2    | Source URL fetch failed (HTTP non-2xx or network error). Diagnostic includes a tip to download locally and pass a path instead. |
| 3    | Usage error (unknown flag, missing `--source`, Swagger 2.0 input). |

All non-zero exits include a stderr diagnostic beginning with
`atw-api: ` (matching the `atw-parse-openapi:` prefix used by the
underlying parser).

## 5. Validation invariants (testable)

- Document version matches `^3\.0\.\d+$`. Anything else (3.1.x, 2.0)
  rejected at ingest. (FR-002)
- `info.version` present and non-empty.
- `paths` object present with at least one operation.
- All `operationId`s unique within the document. Duplicates rejected.
- All `$ref`s resolve via `SwaggerParser.bundle()`; unresolvable
  refs rejected.
- Post-bundle document is JSON-stringifiable without cycles (the
  bundle step would have thrown).

## 6. Determinism contract

- Same `--source` bytes → same `openapi.json` bytes, across
  machines, across Node versions ≥ 20, across OS newline conventions.
  Enforcement: canonicalise + LF + trailing newline.
- `sha256` is computed over the written bytes, not over the parsed
  in-memory shape. (`parse-openapi` normalises; we hash the serialised
  canonical form.)
- Re-running `/atw.api` with the same source is a no-op (`unchanged`).

## 7. Out-of-scope for v1

- `.well-known` discovery.
- `swagger.json` probing.
- Chained source URLs (`--source-fallback`).
- Pre-resolution of external `$ref`s (the bundle step only resolves
  references into the local `#/components` namespace; external files
  are rejected).

## 8. Contract test outline

`packages/scripts/test/atw-api.contract.test.ts` MUST cover:

1. Fresh run with valid OpenAPI 3.0 JSON fixture → exit 0, file
   written, hash recorded.
2. Fresh run with valid OpenAPI 3.0 YAML fixture → same.
3. Fresh run with Swagger 2.0 fixture → exit 3, diagnostic names
   "Swagger 2.0".
4. Fresh run with duplicate operationId fixture → exit 1, diagnostic
   names both occurrences.
5. Fresh run with unresolved external `$ref` → exit 1, diagnostic
   names the ref.
6. Fresh run with URL source (mocked fetch 200) → exit 0, `sourceUrl`
   captured in canonicalised document metadata.
7. URL fetch 404 → exit 2, diagnostic includes "download locally" tip.
8. Re-run on identical source → exit 0, action `unchanged`.
9. Re-run with different source → exit 0, action `rewritten`, prior
   file backed up when `--backup` passed.
10. Cross-platform byte-identical: run on Linux and Windows, assert
    same sha256.

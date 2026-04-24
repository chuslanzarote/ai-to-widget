---
description: "Parse an OpenAPI spec and produce the tool action manifest."
argument-hint: "[openapi-file-or-url]"
---

# `/atw.api`

**Purpose.** Interpret the Builder's HTTP surface, decide which
operations become agent tools, exclude admin endpoints by default, and
mark destructive operations as `requires_confirmation: true`. Writes
`.atw/artifacts/action-manifest.md`. 1–5 LLM calls, chunked by entity
(FR-026, FR-027, FR-029, FR-031).

## Preconditions

- `.atw/config/project.md`, `.atw/config/brief.md`, and
  `.atw/artifacts/schema-map.md` all exist.
- The Builder can provide an OpenAPI 3.0 or 3.1 document (local path
  or URL). Swagger 2.0 is detected and handled per FR-033.

## Steps

1. **Accept input.** Three forms (FR-026):
   - Path to a local spec file (`.json` or `.yaml`) — preferred when
     the Builder can stage it under `.atw/inputs/` (FR-048).
   - Remote URL. If unreachable, fall back immediately to asking for a
     file path rather than retrying indefinitely (FR-033).
   - Pasted spec text.

2. **Version detection (FR-033).**
   - **Swagger 2.0** → halt, surface the version number, and suggest
     converting with `swagger2openapi` before retrying. No LLM call.
   - **OpenAPI 3.0.x / 3.1.x** → proceed.

3. **Deterministic parse.** Run
   `atw-parse-openapi --spec <path-or-url>`. `$ref` resolution and
   bundling happen here via `@apidevtools/swagger-parser.bundle()`
   (FR-027). On parse failure, surface the file offset and halt
   (exit 1, no LLM call).

4. **Hash + change detection (FR-047, FR-049).**

   ```bash
   atw-hash-inputs --root .atw --inputs <spec-path>
   ```

   - **Level 1**: unchanged hash + existing `action-manifest.md` →
     refinement mode: summarize current manifest, ask *"What would
     you like to change?"*. **No LLM call.**
   - **Level 2**: hash changed → structural diff at the operation
     level (method + path as the key); LLM invoked only on added /
     removed / modified operations.

5. **LLM classification.** For each operation, produce a proposal
   with **evidence** (Principle V, FR-030):
   - HTTP method, path, operationId, tags, summary, description.
   - Request/response schemas as signals for destructive intent.
   - A direct quote from `brief.md` when the operation matches a
     Builder-allowed or Builder-forbidden action.
   - `schema-map.md` entity linkage when the operation's path or
     request body references a classified entity.

   Chunk by entity (one entity = one LLM call) when the spec exceeds
   60 operations (FR-027).

6. **Default exclusions (FR-029, SC-005).**
   - Paths matching `/admin/*`, operations with `x-admin: true`, and
     operations whose only security scheme is an admin-only scope →
     **excluded by default**. The Builder may override individually.
   - Operations whose `brief.md` maps to a forbidden action →
     excluded by default.

7. **Destructive-operation flag (FR-031).** Any of the following
   produce `requires_confirmation: true` in the proposal:
   - HTTP method is `DELETE`.
   - operationId contains `cancel`, `delete`, `remove`, `void`,
     `refund`, `close` as a whole word.
   - Operation mutates a resource class whose `schema-map.md` entry
     is tagged as externally-visible state (orders, payments, etc.).

8. **Interactive review (FR-032).** Walk the Builder through each
   entity group, showing classification, evidence, admin/destructive
   flags, and asking for confirm / override. Overrides update the
   draft in memory only.

9. **Final confirmation gate (FR-041).** Summarize:
   *"Writing N tools across M entities; K operations admin-excluded;
   J operations require confirmation."*. Wait for affirmative reply.

10. **Write the artifact.** Pipe the serialized markdown through
    `atw-write-artifact --target .atw/artifacts/action-manifest.md`.
    The write is atomic with a `.bak` sibling (FR-046).

11. **Announce next step.** End with exactly:

    *"Action manifest written. Next: run `/atw.plan`."*

## Re-run semantics (FR-032, FR-040, FR-049)

- **Unchanged inputs** → Level 1 refinement mode (no LLM call).
- **Changed inputs** → Level 2 operation-level diff; LLM invoked
  only on the delta. Builder hand-edits to `action-manifest.md` are
  the ground truth and are preserved.
- **Mid-command close before confirmation** → no persisted draft
  state; a re-run re-synthesizes from the same inputs (FR-050).

## Failure handling

- **Parse error** → exit 1, surface offset, no LLM call.
- **Swagger 2.0** → halt with conversion suggestion (FR-033).
- **URL unreachable** → offer file-path fallback immediately, do
  not retry indefinitely (FR-033).
- **LLM auth / rate limit** → same handling as `/atw.brief`.
- **Builder disagrees with > 50 % of classifications** → suggest
  revisiting `/atw.brief` (the allowed/forbidden sections) or
  `/atw.schema` (entity scoping); offer to restart.

## Tooling

All deterministic work is delegated to `@atw/scripts`:

- `atw-parse-openapi --source <path|url> [--out <path>]` — wraps
  `packages/scripts/src/parse-openapi.ts`. Exit codes: `0` ok,
  `1` parse error / missing file, `2` URL unreachable (offer file
  fallback), `3` bad CLI args or Swagger 2.0 detected (FR-033),
  `4` reserved for credentials (unused here).
- `packages/scripts/src/lib/admin-detection.ts` — recognises
  `/admin/*` paths, `x-admin` vendor extensions, `admin` tags, and
  admin-named security schemes (FR-029).
- `packages/scripts/src/lib/destructive-detection.ts` — flags DELETE
  verbs, destructive verbs in operationIds (`cancel`, `delete`,
  `remove`, `revoke`, `refund`, `void`, `destroy`, `purge`, `wipe`),
  and destructive path suffixes (FR-031).
- `atw-hash-inputs --root .atw --inputs …` — two-level re-run
  detection (FR-047, FR-049).
- `atw-write-artifact --target .atw/artifacts/action-manifest.md` —
  atomic write with `.bak` sibling (FR-046).

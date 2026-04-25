---
description: "Parse a Postgres schema and produce a PII-safe decision map."
argument-hint: "[schema-file]"
---

# `/atw.schema`

**Purpose.** Interpret the Builder's database schema, classify every
business-relevant entity, and produce `.atw/artifacts/schema-map.md`
that the build phase (Feature 002) will index. 1–5 LLM calls, chunked
by foreign-key cluster when the schema is large (FR-024).

## Preconditions

- `.atw/config/project.md` and `.atw/config/brief.md` both exist.
- The Builder can provide a `pg_dump --schema-only` SQL file.

## Banned inputs (FR-018, SC-010)

- Database connection strings (`postgres://...`, `postgresql://...`,
  `host=... password=...`).
- Credentials of any kind.
- Live-DB instructions.

If the Builder pastes one of the above, refuse with:

> *"I don't accept database connection strings. Please export a schema
> with `pg_dump --schema-only` and share the file path or paste its
> contents. Feature 001 never talks to a database directly."*

## Steps

1. **Accept input.** Three forms (FR-016):
   - Path to a local SQL file (preferred — the Builder can stage it
     under `.atw/inputs/` for durability).
   - Pasted SQL text.
   - Path to an optional `--data-only --inserts` sample file; up to
     50 rows per table are used as classification evidence.

   **Interactive SQL-dump capture (FR-004).** If the Builder does not
   yet have a dump, walk them through producing one *here* so
   `/atw.build` never halts with D-SQLDUMP later:

   a. Ask for connection info one field at a time — host, port,
      username, dbname — or accept a full `postgres://user@host:port/db`
      URL and destructure it. Never accept a password; `pg_dump` reads
      `PGPASSWORD` / `~/.pgpass` from the Builder's environment.
   b. Compose the exact invocation:

      ```bash
      pg_dump \
        --host=<host> \
        --port=<port> \
        --username=<user> \
        --dbname=<db> \
        --schema-only \
        --no-owner --no-privileges \
        > .atw/inputs/<name>.sql
      ```

      `<name>` matches the schema input filename the Builder will
      reference from `/atw.build` (default: `schema`).
   c. Write the invocation verbatim into `.atw/inputs/README.md` via
      `atw-write-artifact --target .atw/inputs/README.md` so the
      Builder can re-run it any time. The file is a plain
      Builder-facing note; it is **not** hashed as a build input.
   d. Ask the Builder to run the command in another terminal and
      supply the resulting path. Proceed with the normal flow once
      the file exists.

2. **Deterministic parse.** Run `atw-parse-schema --schema <path>
   [--data <sample-path>]`. On parse failure, surface the reported
   line and column and halt (FR-017). No LLM call on parse failure.

3. **Hash + change detection (FR-047, FR-049).**

   ```bash
   atw-hash-inputs --root .atw --inputs <schema-path> [<sample-path>]
   ```

   - **Level 1**: if the hash is unchanged and `schema-map.md` exists,
     enter refinement mode: load the artifact, show a short summary,
     ask *"What would you like to change?"*. **No LLM call.**
   - **Level 2**: if the hash changed, load the prior parse result
     (from the existing artifact plus the new parse), compute a
     structural diff, and plan LLM calls only over added / removed /
     modified tables.

4. **LLM classification.** Chunk by FK cluster only when the schema
   exceeds 100 tables or 500 columns (FR-024). Each classification
   proposal includes **evidence** (Principle V, FR-020):
   - column-name signals (e.g., `email`, `phone`, `ssn` → PII),
   - foreign-key graph structure,
   - up-to-50-row sample when provided,
   - a direct quote from `brief.md` when applicable.

5. **PII defaults (FR-021, FR-022).**
   - Column level: names or sample values matching email, phone,
     names, addresses, payment data, government IDs, or free-text
     biographical fields → flagged PII; excluded from indexing by
     default.
   - Table level: customers, addresses, payments, and their analogues
     (`customer`, `customer_address`, `payment`) → excluded wholesale
     by default.
   - The Builder may override both during review.

6. **Interactive review (FR-023).** Walk the Builder through each
   entity, showing the proposed classification, the evidence, and
   asking for confirm / override. Individual overrides update the
   draft in memory only.

7. **Final confirmation gate (FR-041).** After all entities are
   reviewed, summarize: *"Writing N entities, M reference tables, K
   PII-excluded tables."*. Wait for an affirmative reply.

8. **Write the artifact.** Pipe the serialized markdown through
   `atw-write-artifact --target .atw/artifacts/schema-map.md`. The
   write is atomic with a `.bak` sibling (FR-046).

9. **Announce next step.** End with exactly:

   *"Schema map written. Next: run `/atw.api`."*

## Re-run semantics (FR-025, FR-040, FR-049)

- **Unchanged inputs** → Level 1 refinement mode (no LLM call).
- **Changed inputs** → Level 2 structural diff; LLM invoked only on
  added / modified tables. Builder hand-edits to the existing
  `schema-map.md` are the ground truth and are preserved.
- **Mid-command close before confirmation** → no persisted draft
  state; a re-run re-synthesizes from the same inputs (FR-050).

## Failure handling

- **Parse error** → show line/column, halt. No LLM call (FR-017).
- **Connection-string paste** → refuse as above (FR-018, SC-010).
- **LLM auth / rate limit** → same handling as `/atw.brief`.
- **Builder disagrees with > 50 % of classifications** → suggest
  revisiting `/atw.brief`; offer to restart.

## Tooling

All deterministic work is delegated to `@atw/scripts`:

- `atw-parse-schema --schema <path> [--data <path>] [--out <path>]` —
  wraps `packages/scripts/src/parse-schema.ts`. Exit codes: `0` ok,
  `1` parse error / missing file, `2` I/O error, `3` bad CLI args,
  `4` credential rejection (FR-018).
- `packages/scripts/src/lib/pii-detection.ts` — column-name heuristics,
  sample-value heuristics, and table-level defaults (FR-021, FR-022).
- `packages/scripts/src/lib/fk-clusters.ts` — union-find clustering for
  chunking the LLM classification pass (FR-024).
- `packages/scripts/src/lib/credential-guard.ts` — guard applied at
  the script boundary *before* any parsing happens.
- `atw-hash-inputs --root .atw --inputs …` — two-level re-run detection
  (FR-047, FR-049).
- `atw-write-artifact --target .atw/artifacts/schema-map.md` — atomic
  write with `.bak` sibling (FR-046).

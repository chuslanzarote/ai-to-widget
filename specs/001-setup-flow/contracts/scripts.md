# Contract: Auxiliary Scripts (`packages/scripts`)

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

Each script is a standalone Node 20 CLI under `packages/scripts/bin/`,
invoked by a slash command via shell. Every script:

- has a single responsibility (FR-045, Principle VI),
- reads typed JSON from stdin or file args,
- writes typed JSON to stdout (results) or human-readable text to
  stderr (errors + progress),
- returns a non-zero exit code with actionable stderr on failure.

All input and output shapes are validated with `zod` at the boundary;
the zod schemas live in `packages/scripts/src/lib/types.ts` and are
the canonical typed contract.

---

## 1. `parse-schema`

**Purpose.** Parse a Postgres `pg_dump --schema-only` file (and
optionally a `--data-only --inserts` companion) into a typed JSON
representation.

**Invocation.**

```text
atw-parse-schema --schema <path> [--data <path>]
```

Accepts the schema path as a positional or via stdin (`--schema -`).

**Inputs.**

| Arg | Required | Description |
|---|---|---|
| `--schema <path>` | yes | Path to SQL schema dump, or `-` for stdin. |
| `--data <path>` | no | Path to insert-style data dump; up to 50 rows per table are retained (FR-016). |

**Output.** `ParsedSQLSchema` JSON (see
[../data-model.md#21-parsedsqlschema](../data-model.md)) on stdout.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | Parse error. Stderr contains `ERROR at line <L>, column <C>: <msg>`. |
| 2 | I/O error (file not found, permission denied). |
| 3 | Invalid arguments. |

**LLM calls.** Zero (FR-017).

---

## 2. `parse-openapi`

**Purpose.** Parse and normalize an OpenAPI specification.

**Invocation.**

```text
atw-parse-openapi --source <url-or-path> [--offline]
```

**Inputs.**

| Arg | Required | Description |
|---|---|---|
| `--source <url-or-path>` | yes | URL, file path, or `-` for stdin (raw JSON/YAML). |
| `--offline` | no | Disable network fetch; fail fast if the source is a URL. |

**Output.** `ParsedOpenAPI` JSON (see
[../data-model.md#22-parsedopenapi](../data-model.md)) on stdout.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Success (OpenAPI 3.x). |
| 1 | Parse / validation error. |
| 2 | Source unreachable (offers file-path fallback via the slash command per FR-033). |
| 3 | Swagger 2.0 detected. Stderr includes the suggested conversion hint. |
| 4 | Invalid arguments. |

**LLM calls.** Zero (FR-027).

---

## 3. `write-artifact`

**Purpose.** Write a markdown artifact atomically with a backup of the
prior version (FR-046).

**Invocation.**

```text
atw-write-artifact --target <path> [--backup-suffix .bak]
```

Reads the artifact content from stdin (UTF-8 markdown).

**Inputs.**

| Arg | Required | Description |
|---|---|---|
| `--target <path>` | yes | Destination file inside `.atw/`. |
| `--backup-suffix <s>` | no | Override `.bak` default for the prior-version backup. |

**Behavior.**
1. If `<target>` exists, copy it to `<target><backup-suffix>`.
2. Write stdin to `<target>.tmp.<pid>`.
3. Rename `<target>.tmp.<pid>` → `<target>` (via `write-file-atomic`,
   Windows-safe).
4. On success exit 0; on failure restore the backup and exit 1.

**Output.** No stdout. Progress messages on stderr.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | Write failure (atomic rollback performed). |
| 2 | I/O error unrelated to the atomic-write primitive. |
| 3 | Invalid arguments. |

**LLM calls.** Zero.

---

## 4. `load-artifact`

**Purpose.** Load an existing `.atw/` markdown artifact and return its
structured representation for idempotent re-runs.

**Invocation.**

```text
atw-load-artifact --kind <kind> --source <path>
```

**Inputs.**

| Arg | Required | Description |
|---|---|---|
| `--kind` | yes | One of `project`, `brief`, `schema-map`, `action-manifest`, `build-plan`. |
| `--source <path>` | yes | File path. |

**Output.** `LoadedArtifact<kind>` JSON (see
[../data-model.md#24-loadedartifactk](../data-model.md)).

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Loaded and validated successfully. |
| 1 | File not present. |
| 2 | Malformed (structure does not match the expected artifact kind). |
| 3 | Invalid arguments. |

**LLM calls.** Zero.

---

## 5. `validate-artifacts`

**Purpose.** Cross-check consistency among `.atw/` artifacts before
`/atw.plan` synthesizes (FR-034, FR-038).

**Invocation.**

```text
atw-validate-artifacts --root <path>
```

`<path>` is the `.atw/` directory.

**Output.** `ArtifactConsistencyReport` JSON (see
[../data-model.md#25-artifactconsistencyreport](../data-model.md)) on
stdout. On inconsistency, the report's `ok` field is `false` and
`inconsistencies` is non-empty.

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | All upstream artifacts present and internally consistent. |
| 1 | Missing artifact. Stderr names which command to run first. |
| 2 | Inconsistency detected (e.g., action references an entity excluded from the schema map). |
| 3 | Invalid arguments. |

**LLM calls.** Zero.

---

## 6. `hash-inputs`

**Purpose.** Produce content hashes of upstream inputs for idempotency
tracking (FR-047) and compute Level 1 change detection (FR-049 L1).

**Invocation.**

```text
atw-hash-inputs --root <path> --inputs <path>... [--update-state]
```

**Inputs.**

| Arg | Required | Description |
|---|---|---|
| `--root <path>` | yes | The `.atw/` directory. |
| `--inputs <path>...` | yes | One or more input files to hash (SQL dumps, OpenAPI files, brief source notes). |
| `--update-state` | no | After hashing, write `.atw/state/input-hashes.json` atomically with the new hashes. Absent → dry-run (hashes printed to stdout without writing state). |

**Output.**

```jsonc
{
  "results": [
    {
      "path": "inputs/schema.sql",
      "sha256": "<hex>",
      "previousSha256": "<hex | null>",
      "changed": true | false,
      "kind": "sql-dump" | "openapi" | "brief-input" | "other"
    }
  ]
}
```

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Success. |
| 1 | I/O error on an input file. |
| 2 | State file read failure (e.g., malformed JSON — the caller should decide whether to rebuild). |
| 3 | Invalid arguments. |

**LLM calls.** Zero.

---

## Shared rules

**Stdin / stdout discipline.** Scripts never print progress on stdout.
stdout is reserved for structured JSON results (or empty for
`write-artifact`). Human-readable messages go to stderr.

**Zod validation.** Every script validates its own output before
printing. A mismatch between produced JSON and its zod schema is a
programming error and returns exit 1.

**No shared state.** Scripts do not read or write files outside their
declared `--root` / `--target` / `--inputs` arguments (Principle VI
rules out hidden state).

**No env-var configuration.** Behavior is driven by CLI arguments,
never by env vars — keeps the scripts re-runnable and debuggable.
(The Claude Code side handles `ANTHROPIC_API_KEY`; scripts never read
it.)

**Logging.** None by default. `--verbose` on any script emits
progress to stderr only.

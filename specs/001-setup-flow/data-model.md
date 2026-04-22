# Phase 1 Data Model: Setup Flow (Feature 001)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-21

This feature's data model has two distinct layers:

1. **Artifact layer** — the human-readable markdown files under
   `.atw/` that the Builder sees, edits, and commits. These are the
   canonical state (Principle II). Their structural contract is the
   pre-existing `examples/sample-*.md` set.

2. **Internal JSON layer** — the typed representations the auxiliary
   scripts pass between each other. These exist only in memory and on
   stdout/stdin during command execution; they are never persisted
   alongside the artifacts.

All internal shapes are validated at boundaries with `zod`. Where a
shape is produced by one script and consumed by another, the zod schema
is the shared contract.

---

## 1. Artifact entities (persisted markdown)

### 1.1 Project metadata — `.atw/config/project.md`

**Producer**: `/atw.init` (no LLM call).
**Consumers**: `/atw.brief`, `/atw.schema`, `/atw.api`, `/atw.plan`.
**Structural contract**: `examples/sample-brief.md`'s project header
section (or a standalone `project.md` if we split it — see Phase 2).

**Fields.**
| Field | Type | Notes |
|---|---|---|
| `name` | string | Builder-provided project name; used for container names, file slugs. |
| `languages` | string[] | Primary language(s) the agent will speak. |
| `deploymentType` | `"customer-facing-widget" \| "internal-copilot" \| "custom"` | Shapes later defaults in `/atw.api` and `/atw.plan`. |
| `createdAt` | ISO-8601 date | Set once; not updated on re-runs. |

### 1.2 Business brief — `.atw/config/brief.md`

**Producer**: `/atw.brief` (1 LLM call for synthesis).
**Consumers**: `/atw.schema`, `/atw.api`, `/atw.plan`, Feature 002.
**Structural contract**: `examples/sample-brief.md`.

**Required sections (markdown `## Heading`).**
- `## Business scope` — what the client sells, core operations.
- `## Customers` — who the client serves.
- `## Agent's allowed actions` — what the agent may do.
- `## Agent's forbidden actions` — what the agent must never do.
- `## Tone` — tone the agent adopts (Builder's own phrasing per
  FR-013).
- `## Primary use cases` — 3–5 Builder-described scenarios.
- `## Business vocabulary` — glossary; terms and definitions.
- `## Anti-patterns` — client-industry-specific pitfalls (optional).

Placeholder notes (per FR-013) rather than fabricated text when a
Builder skipped an answer.

### 1.3 Schema map — `.atw/artifacts/schema-map.md`

**Producer**: `/atw.schema` (1–5 LLM calls depending on chunking).
**Consumers**: `/atw.api`, `/atw.plan`, Feature 002.
**Structural contract**: `examples/sample-schema-map.md`.

**Required structure.**
- `## Summary` — table counts by classification, PII-excluded count.
- One `## Entity: <name>` section per indexable business entity, with:
  - `Classification: indexable`
  - `Source tables: ...`
  - `Joined references: ...`
  - `### Columns` — columns + per-column decision (index / reference /
    exclude-pii / exclude-internal).
  - `### Evidence` — brief citation (column names, FKs, sample rows,
    `brief.md` quote).
- `## Reference tables` — tables joined in by indexable entities but
  not themselves indexed.
- `## Infrastructure / ignored` — audit, migration, and framework
  tables.
- `## PII-excluded` — tables and columns flagged PII with evidence.

Every classification carries evidence (FR-020). Samples visible in the
artifact are bounded — the markdown should never contain more than a
few representative rows per table even if up to 50 were considered
during classification (FR-016).

### 1.4 Action manifest — `.atw/artifacts/action-manifest.md`

**Producer**: `/atw.api` (1–3 LLM calls).
**Consumers**: `/atw.plan`, Feature 002, Feature 003.
**Structural contract**: `examples/sample-action-manifest.md`.

**Required structure.**
- `## Summary` — operation counts by classification.
- One `## Tools: <entity>` section per entity group, with one block per
  exposed tool:
  - `### <verb_noun_name>`
  - `Description: ...` (agent-facing)
  - `Parameters: ...` (cleaned schema, code-fenced JSON)
  - `requires_confirmation: true|false`
  - `Source: ...` (path + method + security requirement)
  - `Parameter sources: ...` (widget context / prior tool call / user
    message)
- `## Excluded` — admin-only + infrastructure operations, with reason.
- `## Runtime system prompt block` — text the Feature 003 backend
  injects into the runtime agent.

### 1.5 Build plan — `.atw/artifacts/build-plan.md`

**Producer**: `/atw.plan` (1 LLM call).
**Consumers**: Feature 002.
**Structural contract**: `examples/sample-build-plan.md`.

**Required structure.**
- `## Summary`
- `## Embedding approach`
- `## Category vocabularies` — per-entity-type vocabularies for
  enrichment.
- `## Enrichment prompt templates` — one per indexable entity type.
- `## Estimated entity counts`
- `## Cost estimate`
  - enrichment calls
  - per-call cost
  - total cost
  - retry buffer
- `## Backend configuration defaults`
- `## Widget configuration defaults`
- `## Build sequence`
- `## Failure handling`

### 1.6 Input state — `.atw/state/input-hashes.json`

**Producer / consumer**: `packages/scripts/src/hash-inputs.ts`.
**Structural contract**: this file (internal).

**Shape.**
```jsonc
{
  "version": 1,
  "entries": [
    {
      "path": "inputs/schema.sql",       // relative to .atw/
      "kind": "sql-dump" | "openapi" | "brief-input" | "other",
      "sha256": "<hex>",
      "seenAt": "2026-04-21T13:15:22Z"
    }
  ]
}
```

Validated by a zod schema in `packages/scripts/src/lib/types.ts`.
Written atomically by `hash-inputs.ts` after a successful hash pass;
read by FR-049 Level 1 change detection before any LLM call.

### 1.7 Staged inputs — `.atw/inputs/`

**Contract.** Directory, not a single file. Gitignored by default
(FR-048). Filenames are the Builder's choice. Lifecycle is
Builder-owned; no command auto-purges. No internal structure imposed
beyond `.atw/inputs/**/*` — each staged file is referenced by
`input-hashes.json` using its path relative to `.atw/`.

---

## 2. Internal JSON shapes (in-memory, never persisted next to artifacts)

These are the zod-validated I/O shapes of the auxiliary scripts. Every
boundary between scripts and every boundary between a script and a
slash command crosses one of these.

### 2.1 `ParsedSQLSchema` (output of `parse-schema.ts`)

```ts
{
  version: 1,
  dialect: "postgres",
  schemas: Array<{
    name: string,              // "public", "analytics", ...
    tables: Array<{
      schema: string,
      name: string,
      columns: Array<{
        name: string,
        dataType: string,      // "integer", "varchar(255)", "jsonb", ...
        nullable: boolean,
        default: string | null,
        isPrimaryKey: boolean,
        comment: string | null
      }>,
      primaryKey: string[],    // column names in order
      foreignKeys: Array<{
        columns: string[],
        referenceSchema: string,
        referenceTable: string,
        referenceColumns: string[],
        onDelete: "cascade" | "restrict" | "set null" | "no action" | null,
        onUpdate: "cascade" | "restrict" | "set null" | "no action" | null
      }>,
      uniqueConstraints: Array<{ columns: string[] }>,
      indexes: Array<{ name: string, columns: string[], unique: boolean }>,
      inherits: string[] | null,
      comment: string | null
    }>,
    enums: Array<{ name: string, values: string[] }>,
    extensions: string[]
  }>,
  sampleRows: {
    // Optional; present only when --data-only --inserts supplied.
    // Capped at 50 rows per table (FR-016).
    [tableFqn: string]: Array<Record<string, unknown>>
  },
  parseErrors: Array<{ line: number, column: number, message: string }>
}
```

**Consumer**: `/atw.schema`'s LLM step. The structural-diff helper
compares two `ParsedSQLSchema` values for Level 2 change detection
(FR-049).

### 2.2 `ParsedOpenAPI` (output of `parse-openapi.ts`)

```ts
{
  version: 1,
  sourceVersion: "3.1" | "3.0" | "2.0",
  sourceUrl: string | null,   // set when fetched from URL
  title: string,
  apiDescription: string | null,
  servers: Array<{ url: string, description: string | null }>,
  tags: Array<{ name: string, description: string | null }>,
  operations: Array<{
    id: string,                // operationId or fallback <method>_<path>
    method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options",
    path: string,
    tag: string | null,
    summary: string | null,
    description: string | null,
    security: Array<{ scheme: string, scopes: string[] }>,
    parameters: Array<{
      name: string,
      in: "query" | "path" | "header" | "cookie",
      required: boolean,
      schema: unknown          // resolved JSON Schema subset
    }>,
    requestBody: { contentType: string, schema: unknown } | null,
    responses: Array<{ status: string, contentType: string | null, schema: unknown | null }>
  }>
}
```

**Note on `unknown` schemas.** The OpenAPI parameter / body / response
schemas are kept as unknown-typed JSON Schema objects — the LLM layer
reads them, and the downstream `/atw.api` classifier receives them as
cleaned-up representations. Zod validates only the outer envelope.

### 2.3 `InputHashRecord` (entry type of `input-hashes.json`)

Already shown in §1.6. Zod schema lives in
`packages/scripts/src/lib/types.ts`.

### 2.4 `LoadedArtifact<K>` (output of `load-artifact.ts`)

Discriminated union keyed by artifact kind:

```ts
type LoadedArtifact =
  | { kind: "project";          path: string; content: ProjectArtifact }
  | { kind: "brief";            path: string; content: BriefArtifact }
  | { kind: "schema-map";       path: string; content: SchemaMapArtifact }
  | { kind: "action-manifest";  path: string; content: ActionManifestArtifact }
  | { kind: "build-plan";       path: string; content: BuildPlanArtifact };
```

Each `*Artifact` type is a structured representation derived from the
markdown AST — headings become nested fields, code-fenced JSON blocks
parse to typed JSON. Full per-kind shapes are captured in
`packages/scripts/src/lib/types.ts` during Phase 2; the contract here
is that every `*Artifact` is round-trippable (load → edit → write
reproduces the same markdown modulo whitespace).

### 2.5 `ArtifactConsistencyReport` (output of `validate-artifacts.ts`)

```ts
{
  ok: boolean,
  missing: Array<{ kind: ArtifactKind, expectedPath: string }>,
  inconsistencies: Array<{
    kind: "action-references-excluded-entity"
        | "brief-references-missing-vocabulary"
        | "schema-map-references-missing-brief-section"
        | "plan-references-missing-upstream",
    detail: string,             // human-readable, includes file paths
    leftPath: string,
    rightPath: string
  }>
}
```

**Consumer**: `/atw.plan` (FR-034, FR-038).

### 2.6 `StructuralDiff<T>` (output of `lib/structural-diff.ts`)

Generic shape produced by the Level 2 diff helper:

```ts
type StructuralDiff<T> = {
  added: T[],
  removed: T[],
  modified: Array<{ before: T; after: T; changedFields: string[] }>
};
```

Specializations used by the slash commands:
- `StructuralDiff<Table>` for `/atw.schema` re-runs.
- `StructuralDiff<Operation>` for `/atw.api` re-runs.
- `StructuralDiff<BriefSection>` for `/atw.brief` re-runs.

---

## 3. Relationships (who depends on whom)

```
  Installer ────► .atw/ skeleton  ────► /atw.init  ──► project.md
                                  │                        │
                                  └─► /atw.brief  ─────────┼──► brief.md
                                                           │         │
  .atw/inputs/schema.sql ──► parse-schema.ts ──► /atw.schema ─► schema-map.md
                                                           │         │
  .atw/inputs/openapi.* ──► parse-openapi.ts ──► /atw.api ─┤         │
                                                           │         │
                                                       /atw.plan ────┴──► build-plan.md
                                                           │
                                               validate-artifacts.ts
```

Every arrow is anchored by one of the spec's FRs; the direction of
dependency is the enforced precedence order in FR-034 and FR-037.

---

## 4. Lifecycle invariants

- **Markdown is the source of truth.** `input-hashes.json` is
  derivative — if deleted, the next run of any `/atw.*` command simply
  recomputes it.
- **Atomic writes with backup.** Every write to `.atw/` goes through
  `write-file-atomic` + a `.bak` sibling (FR-046).
- **No mid-command drafts.** No JSON / markdown file is persisted
  between the LLM-proposal step and the Builder-confirms step
  (FR-050).
- **Builder edits beat re-synthesis.** Re-runs read the current
  artifact as the ground truth for decisions the Builder made (FR-040);
  a new LLM synthesis operates on the delta only (FR-049 Level 2).

---

## 5. Not modeled here (deferred to Feature 002 / 003)

- Embedding vectors, `pgvector` rows, or any Postgres state.
- Runtime session tokens or end-user auth state (explicitly forbidden
  anyway by Principle I; noted for completeness).
- Rendered backend / widget code artifacts.
- Enrichment output documents.

These are downstream of the setup flow and are the explicit scope of
Features 002 and 003.

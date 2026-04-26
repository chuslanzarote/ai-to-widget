# Contract: Builder diagnostics

**Feature**: 008-atw-hardening
**Status**: New contract. Documents the diagnostic text every loud-failure code path must emit.

## Motivation

Feature 007's demo surfaced a class of silent failures: a tool rejected by the allow-list produced an inline synthetic error that derailed the next turn; a missing `action-executors.json` silently disabled action capability via `console.warn`; a zero-entity schema-map parse returned `{entities: []}` with no error; a missing `credentialSource` shipped a 401-bound tool without warning. Each of these now produces a structured, actionable diagnostic at the point of failure. This contract enumerates the diagnostic ID, the triggering condition, and the exact diagnostic text.

## Diagnostic catalog

### D-HASHMISMATCH (FR-006)

**Where**: `packages/scripts/src/hash-inputs.ts` on read.
**When**: The on-disk `hash-index.json` does not match the validator's schema.
**Text**:
```
ERROR: hash-index.json failed schema validation.
Expected shape: { schema_version: "1", files: Record<relativePath, sha256Hex> }
Found: <actual shape>

Fix: delete .atw/artifacts/hash-index.json and re-run /atw.build.
```

### D-INPUTSARGS (FR-007)

**Where**: `packages/scripts/src/hash-inputs.ts` CLI parser.
**When**: `--inputs` is supplied with a form the CLI does not recognise.
**Text**:
```
ERROR: --inputs expected one or more file paths (space-separated).

Usage: atw-hash-inputs --inputs a.md b.md c.md
```

### D-ZEROENTITY (FR-009)

**Where**: `packages/scripts/src/lib/markdown.ts` schema-map parser.
**When**: `extractSections(tree, { depth: 2 })` returns an empty list.
**Text (variant A — H3 detected)**:
```
ERROR: Zero entities parsed from schema-map.md.
Detected H3 "### Entity:" headings — the parser expects H2 "## Entity:".

Fix: convert your H3 headings one level up, or regenerate the file with /atw.schema.
See examples/sample-schema-map.md for the expected convention.
```
**Text (variant B — no `Entity:` headings detected)**:
```
ERROR: Zero entities parsed from schema-map.md.
Expected H2 headings of the form "## Entity: <name>". Found none.

Fix: see examples/sample-schema-map.md for the expected convention, or regenerate with /atw.schema.
```

### D-CLASSIFYAUTH (FR-010)

**Where**: `packages/scripts/src/atw-classify.ts` Stage 1 rule 2.
**When**: A shopper-scoped bearer-JWT operation would be rejected but `deploymentType !== "customer-facing-widget"`.
**Text**:
```
WARN: Operation <VERB> <path> uses bearerFormat: "JWT" and is being excluded as non-cookie-security.
If this is a customer-facing widget deployment, set `deploymentType: customer-facing-widget` in
.atw/config/project.md and re-run /atw.classify to accept shopper-scoped bearer-JWT operations.
```

### D-CREDSRC (FR-013) — HALT

**Where**: `packages/scripts/src/validate-artifacts.ts` cross-validation stage.
**When**: One or more catalog entries would ship without `credentialSource` despite declaring bearer security (or being shopper-scoped in a `deploymentType: customer-facing-widget` project).
**Text**:
```
ERROR: The following tool(s) would ship without a credential source:

  • <toolName1>  (<VERB1> <path1>)
  • <toolName2>  (<VERB2> <path2>)
  ...

These operations need to declare bearer security in your OpenAPI document.

Add EITHER:

  (a) Per-operation security — on each affected operation:

      security:
        - bearerAuth: []

  (b) Global security — at the document root:

      security:
        - bearerAuth: []

      components:
        securitySchemes:
          bearerAuth:
            type: http
            scheme: bearer
            bearerFormat: JWT

See .atw/artifacts/host-requirements.md for the full host contract.

Build halted.
```

### D-RUNTIMEONLY (FR-012) — RESOLVED BY FLAG

**Where**: `packages/scripts/src/validate-artifacts.ts` `action-references-excluded-entity` check.
**When**: A tool group references an entity absent from `schema-map.md` AND the group is NOT flagged `(runtime-only)`.
**Text**:
```
ERROR: Tool group "<groupName>" references entity "<entityName>" which is not present in schema-map.md.

Options:
  (a) If this group legitimately targets per-shopper runtime endpoints that are not indexed, flag
      the group as runtime-only:

      ## Tools: <groupName> (runtime-only)

  (b) If this is an indexed entity, add it to schema-map.md.

Build halted.
```

### D-SQLDUMP (FR-004) — HALT with guidance

**Where**: `packages/scripts/src/apply-migrations.ts` + `/atw.build` pre-flight.
**When**: `.atw/inputs/<name>.sql` is missing.
**Text**:
```
ERROR: .atw/inputs/<name>.sql is missing.

Run this command to produce it:

  pg_dump \
    --host=<detected host> \
    --port=<detected port> \
    --username=<detected user> \
    --dbname=<detected db> \
    --schema-only \
    --no-owner --no-privileges \
    > .atw/inputs/<name>.sql

Connection details are derived from your project config. See .atw/inputs/README.md
for the exact invocation already captured during /atw.schema.
```

When `/atw.schema` has captured the command earlier, the diagnostic instead says:

```
ERROR: .atw/inputs/<name>.sql is missing.

Run the command captured in .atw/inputs/README.md to produce it.
```

### D-TOOLNOTALLOWED (FR-022) — WIDGET

**Where**: `packages/widget/src/chat-action-runner.ts`.
**When**: Backend emits a `tool_use` whose tool is not in `config.allowedTools`.
**Rendering**: A visible in-widget error row in the transcript:
```
This conversation tried to use tool "<toolName>" which is not in the widget's
allow-list. Ask the Builder to include this tool in /atw.embed's data-allowed-tools.
```
No synthetic `is_error` turn is pushed into Anthropic's message sequence; the failure does not derail the conversation thread. Widget clears `pending_turn_id` and waits for the next shopper message.

### D-NOEXECUTORS (FR-023) — WIDGET

**Where**: `packages/widget/src/chat-action-runner.ts` on `actionCapable === false`.
**When**: Backend emits a `tool_use` while the widget's `action-executors.json` load failed or returned an empty catalog.
**Rendering**: A visible in-widget error row in the transcript:
```
The widget's action catalog is missing or empty, so tool "<toolName>" cannot run.
Ask the Builder to copy `.atw/artifacts/action-executors.json` into the host's
public assets (see /atw.embed output).
```

### D-FR020AFALLBACK (FR-020a) — WIDGET

**Where**: `packages/widget/src/loop-driver.ts` on receipt of `{response_generation_failed:true, action_succeeded:true}`.
**Rendering**: The pinned confirmation-fallback string in the transcript:
```
Action completed successfully. (Response generation failed — please refresh.)
```
No retry button; no error toast. This is the only branch that renders this string.

## Diagnostic invariants

1. **Every diagnostic names the exact file or attribute to change.** No vague prose.
2. **Every HALT diagnostic is preceded by a clear "ERROR:" prefix in stderr; no ANSI escapes that prevent grep.**
3. **Every widget-visible diagnostic is rendered as a transcript row, not a toast/overlay**, for accessibility.
4. **Every diagnostic is unit-tested against its exact text** (allowing for interpolated identifiers but asserting the structural prose).

## Contract tests

1. **D-CREDSRC halt path.** Synthesise a minimal OpenAPI with a shopper-scoped op lacking security; run the build; assert stderr contains "would ship without a credential source" and the process exits non-zero.
2. **D-ZEROENTITY variant A.** Hand-author a schema-map with only `### Entity:` headings; run the parser; assert the H3-detected diagnostic is emitted.
3. **D-RUNTIMEONLY resolution.** Author a manifest with an excluded-entity reference; assert D-RUNTIMEONLY; add `(runtime-only)` flag; assert the build proceeds.
4. **D-TOOLNOTALLOWED rendering.** Inject a backend `tool_use` not in the allow-list; assert the widget renders the in-transcript diagnostic text and does not submit a synthetic `is_error` turn.
5. **D-FR020AFALLBACK rendering.** Mock the backend response `{response_generation_failed:true, action_succeeded:true}`; assert the widget renders the pinned string and clears `pending_turn_id`.

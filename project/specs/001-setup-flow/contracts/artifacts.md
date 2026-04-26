# Contract: `.atw/` Markdown Artifacts

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

The five Builder-facing markdown artifacts produced by Feature 001
are **the durable contract** shared with Features 002 and 003. Their
structural shape is fixed by the pre-committed reference files under
`/examples/` at the repository root. This file codifies that
relationship.

---

## Canonical references

Every artifact Feature 001 produces must structurally match its
counterpart in `/examples/`. *Structural* means: same top-level
`## Headings` in the same order, same code-fenced JSON block
conventions, same per-entity / per-operation sub-heading pattern.
*Content* (the specific tables, endpoints, tone, vocabulary) is
project-specific and not part of the contract.

| Artifact | Producer command | Reference file |
|---|---|---|
| `.atw/config/project.md` | `/atw.init` | (header structure of `examples/sample-brief.md`) |
| `.atw/config/brief.md` | `/atw.brief` | `examples/sample-brief.md` |
| `.atw/artifacts/schema-map.md` | `/atw.schema` | `examples/sample-schema-map.md` |
| `.atw/artifacts/action-manifest.md` | `/atw.api` | `examples/sample-action-manifest.md` |
| `.atw/artifacts/build-plan.md` | `/atw.plan` | `examples/sample-build-plan.md` |

A sixth reference file, `examples/sample-runtime-interactions.md`, is
Feature 003's concern and not produced by Feature 001.

---

## Why `examples/` is the contract, not a schema

Principle II (Markdown as Source of Truth) rules out a parallel
JSON/YAML schema that would attempt to constrain these files. Markdown
structure is checked by round-tripping: `load-artifact --kind X` must
accept every `examples/sample-X.md`, and `write-artifact` must produce
something the same script can re-load.

The per-kind Zod schemas in `packages/scripts/src/lib/types.ts` are
therefore the **executable** contract — they validate the structured
representation derived from the markdown AST. The `examples/` files
are the **human-readable** contract — any Builder reading them sees
the shape they will later edit. Both layers are kept in sync: if a
schema changes, the example must change; if the example's shape
changes, the schema must change.

---

## Structural breakdown by artifact

For each artifact, the required `## Headings` are those listed in
[`data-model.md`](../data-model.md). A command MUST produce every
required heading, even when a section is empty. Empty sections carry
a short placeholder note (e.g., *"No anti-patterns were identified in
this brief."*) rather than the heading alone.

**project.md** — see [data-model.md §1.1](../data-model.md#11-project-metadata).
**brief.md** — see [data-model.md §1.2](../data-model.md#12-business-brief).
**schema-map.md** — see [data-model.md §1.3](../data-model.md#13-schema-map).
**action-manifest.md** — see [data-model.md §1.4](../data-model.md#14-action-manifest).
**build-plan.md** — see [data-model.md §1.5](../data-model.md#15-build-plan).

---

## Compatibility guarantees

**Feature 001 guarantees.**
- Every artifact produced by a Feature 001 command round-trips
  losslessly through `load-artifact` + `write-artifact`.
- Builder hand-edits that preserve the required heading set are
  respected by subsequent commands (FR-040).
- No command ever deletes a section the Builder wrote, even if the
  command's re-synthesis would not have produced it.

**Downstream obligations (Features 002 / 003).**
- `/atw.build` (Feature 002) reads the artifacts structurally via the
  same `load-artifact` script. Breaking changes to any artifact's
  heading set require a coordinated bump in both features.
- Feature 003 reads `action-manifest.md`'s `## Runtime system prompt
  block` verbatim.

---

## Change management

If a future amendment renames a required heading or adds a required
section:

1. Update the relevant `examples/sample-*.md`.
2. Update the zod schema in `packages/scripts/src/lib/types.ts`.
3. Bump the artifact's `version` field (if one is present — project
   and state artifacts carry it).
4. Record the change in the feature's `spec.md` clarifications
   section and in the next feature's change log.
5. Downstream features MUST be updated before the new contract
   ships.

No silent shape changes. No backward-incompatible shape changes
without a coordinated feature update.

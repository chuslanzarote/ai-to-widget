# Phase 1 Data Model: OpenAPI-Driven Action Catalog

**Feature**: 006-openapi-action-catalog
**Plan**: [plan.md](./plan.md)
**Research**: [research.md](./research.md)

This document is the normative schema reference for every artefact and
in-memory type this feature introduces or extends. Every field carries
a validation rule and a consumer. When the spec's Functional
Requirements reference a field, the field is defined here.

---

## 1. Artefact: `.atw/artifacts/openapi.json`

**Purpose.** The pinned, normalised OpenAPI 3.0.x document committed to
the project as the canonical source of truth for every downstream step
(FR-001, FR-020).

**Producer.** `/atw.api` (new CLI subcommand, backed by
`packages/scripts/src/atw-api.ts`).

**Consumers.** `classify-actions.ts` (heuristic + Opus review),
`parse-action-manifest.ts` (validation — reject manifest entries that
do not trace back here), `render-executors.ts` (build-time cross-origin
detection).

**Format.** JSON, pretty-printed with 2-space indent, stable key
ordering (recursive object-key sort before stringify), trailing
newline. No YAML, no comments, no non-ASCII unless the source document
carries it.

**Schema.** The post-`SwaggerParser.bundle()` shape with `$ref`s
resolved to local `#/components/...` pointers where possible. Must
satisfy:

- Top-level `openapi: string` matches `/^3\.0\.\d+$/`.
- `info.version: string` present and non-empty.
- `paths: { [path: string]: { [method: string]: Operation } }` with at
  least one operation.
- Every `operationId` present in the document is unique across all
  `(path, method)` combinations (duplicates rejected at ingest time —
  FR-002).
- Every `$ref` resolves to a local component or a primitive schema;
  external unresolvable `$ref`s reject the document (FR-002).

**Determinism.** `openapi.json` is byte-identical across machines for
identical inputs. The canonicaliser in `atw-api.ts`:
1. Recursively sorts object keys alphabetically.
2. Normalises array order only where order is semantically insignificant
   (we do not reorder `paths[*].parameters[]` or `responses` — those
   orderings are preserved from input to keep human review intuitive).
3. Emits trailing newline.

**Versioning.** No explicit `version` field on this artefact — the
OpenAPI document carries `info.version`. A schema bump on *this
project's* pinned format would be a breaking change to every downstream
parser; handled at that time by a named migration.

---

## 2. Artefact: `.atw/artifacts/action-manifest.md`

**Purpose.** The reviewable, Builder-editable catalog of shopper-facing
actions and the excluded list (FR-003). The source of truth for the
tool descriptors Opus sees and the executors catalog the widget loads.

**Producer.** `classify-actions.ts` (new), invoked either standalone
via `/atw.classify` or inline from `/atw.build`'s CLASSIFY sub-step.

**Consumers.** `parse-action-manifest.ts` (Zod-validated in-memory
`ActionManifest`), `render-backend.ts` (via RenderContext.tools),
`render-executors.ts` (builds the declarative catalog).

**Format.** Markdown, UTF-8, LF line endings, trailing newline. One
`# Action manifest` top-level heading, followed by:

```markdown
# Action manifest

## Provenance

- OpenAPI snapshot: sha256:<64 hex>
- Classifier model: claude-opus-4-7 (2026-04-23)
- Classified at: 2026-04-23T00:00:00Z

## Summary

<free-form 1-3 paragraph Builder-facing narrative>

## Tools: <group name>

### <tool_name>

Description: <human-readable description>
<optional: description_template: "<template with {name} placeholders>">
<optional: summary_fields: ["field1", "field2"]>

Parameters:

```json
{
  "type": "object",
  "properties": { ... },
  "required": [...]
}
```

requires_confirmation: true | false
is_action: true | false
Source: <HTTP_METHOD> <path>
Parameter sources: <free-form provenance hint>

## Excluded

- <HTTP_METHOD> <path> — <reason>
- ...

## Orphaned (operation removed from OpenAPI)

- <HTTP_METHOD> <path> — previously: <previous-tool-name>
- ...
```

The `## Orphaned` section appears only when a prior manifest entry no
longer traces back to the ingested OpenAPI (R7 delta-merge).

**In-memory type** (`packages/scripts/src/lib/action-manifest-types.ts`,
Zod):

```ts
export const ActionManifestEntrySchema = z.object({
  toolName: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/),
  description: z.string().min(1),
  descriptionTemplate: z.string().optional(),
  summaryFields: z.array(z.string()).optional(),
  parameters: z.object({
    type: z.literal("object"),
    properties: z.record(z.any()).default({}),
    required: z.array(z.string()).default([]),
  }),
  requiresConfirmation: z.boolean(),
  isAction: z.boolean(),
  source: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().regex(/^\/.*/),
    operationId: z.string().min(1),
  }),
  parameterSources: z.string().optional(),
});

export const ExcludedEntrySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().regex(/^\/.*/),
  operationId: z.string(),
  reason: z.string().min(1),
});

export const OrphanedEntrySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().regex(/^\/.*/),
  previousToolName: z.string().min(1),
});

export const ActionManifestSchema = z.object({
  provenance: z.object({
    openapiSha256: z.string().regex(/^sha256:[0-9a-f]{64}$/),
    classifierModel: z.string().min(1),
    classifiedAt: z.string().datetime(),
  }),
  summary: z.string(),
  included: z.array(ActionManifestEntrySchema),
  excluded: z.array(ExcludedEntrySchema),
  orphaned: z.array(OrphanedEntrySchema).default([]),
});

export type ActionManifest = z.infer<typeof ActionManifestSchema>;
```

**Validation rules.**

- Every `included[*].source.(operationId, path, method)` triple MUST
  resolve to an operation present in the referenced
  `.atw/artifacts/openapi.json`. Enforcement: `parse-action-manifest.ts`
  loads both files and cross-validates before returning a
  `ManifestValidationError`; the orchestrator exits non-zero (FR-004).
- `included[*].toolName` MUST be unique within the manifest.
- `included[*].requiresConfirmation` defaults to `true` on first
  generation (FR-011). The Builder MAY flip to `false`; the parser
  accepts either.
- `included[*].isAction` MUST be `true` for any operation whose method
  is `POST`, `PUT`, `PATCH`, or `DELETE` (FR-005 default), and MAY be
  `true` for `GET` if the Builder explicitly marks it. The classifier
  defaults `GET` operations to `isAction: false` (safe-read tools in
  the Feature 003 contract).
- `excluded[*].reason` SHOULD use one of the canonical reason tokens
  documented in `contracts/classifier-contract.md` (admin-prefix,
  non-cookie-security, missing-request-schema, destructive-unowned,
  opus-narrowed, manual-exclusion), but free-form reasons are accepted
  (FR-017).

---

## 3. Artefact: `.atw/artifacts/action-executors.json`

**Purpose.** The declarative execution catalog the widget loads at
init (FR-008, FR-009). Data, not code — the widget's fixed interpreter
is the only code path that consumes it.

**Producer.** `render-executors.ts` (new), invoked from `/atw.build`'s
RENDER step after `action-manifest.md` has been parsed.

**Consumers.** `packages/widget/src/action-executors.ts` (catalog
loader + interpreter), build-time contract tests.

**Format.** JSON, pretty-printed with 2-space indent, stable key
ordering, trailing newline.

**Schema**
(`packages/scripts/src/lib/action-executors-types.ts`, Zod):

```ts
export const SubstitutionSourceSchema = z.string().regex(
  /^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/,
);
// Restrictive: the only accessor expression accepted is
// "arguments.<identifier>". No dots beyond the first, no brackets,
// no quotes. This is the static guarantee FR-009 depends on.

export const ActionExecutorEntrySchema = z.object({
  tool: z.string().min(1),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  pathTemplate: z.string().regex(/^\/[A-Za-z0-9\-_/{}.]*$/),
  substitution: z.object({
    path: z.record(SubstitutionSourceSchema).default({}),
    body: z.record(SubstitutionSourceSchema).default({}),
    query: z.record(SubstitutionSourceSchema).default({}),
  }),
  headers: z.record(z.string()).refine(
    (h) => Object.keys(h).every((k) => !/^(authorization|cookie|set-cookie|x-.*-(token|auth|session))$/i.test(k)),
    { message: "credential-class headers forbidden in catalog" },
  ).default({ "content-type": "application/json" }),
  responseHandling: z.object({
    successStatuses: z.array(z.number().int().gte(100).lte(599)).min(1),
    summaryTemplate: z.string(),
    summaryFields: z.array(z.string()).default([]),
    errorMessageField: z.string().optional(),
  }),
});

export const ActionExecutorsCatalogSchema = z.object({
  version: z.literal(1),
  credentialMode: z.literal("same-origin-cookies"),
  actions: z.array(ActionExecutorEntrySchema),
});

export type ActionExecutorsCatalog = z.infer<
  typeof ActionExecutorsCatalogSchema
>;
```

**Validation rules.**

- `version: 1` — fixed in v1; a later feature may bump with an explicit
  migration.
- `credentialMode: "same-origin-cookies"` — the only legal value in v1
  (spec Assumption: OAuth/bearer out of scope).
- Every `actions[*].tool` MUST match the `toolName` of some included
  manifest entry. Cross-validated at build time against
  `action-manifest.md`.
- Every `substitution.*` value MUST match the `arguments.<identifier>`
  shape — no dotted paths, no brackets, no arbitrary expressions. This
  is the static guarantee backing FR-009 / SC-006.
- `headers` MUST NOT include any credential-class header (enforced by
  the Zod refinement above; the list is exhaustive for v1).
- `pathTemplate` MUST be a relative path (starts with `/`); no
  absolute URLs (R4: the widget constructs the URL from
  `config.apiBaseUrl` + `pathTemplate`).
- `responseHandling.summaryTemplate` accepts only `{identifier}`-style
  placeholders (no nested braces, no expressions). Enforced at runtime
  by the interpreter's single `String.replace` pass.

**Empty catalog.** When the manifest has zero included entries, the
catalog is written as:

```json
{
  "version": 1,
  "credentialMode": "same-origin-cookies",
  "actions": []
}
```

This is a well-formed catalog the widget loads without error (FR-014).

---

## 4. Artefact: `.atw/state/input-hashes.json` (EXTENDED)

**Purpose.** The determinism ledger that tells the orchestrator whether
RENDER can short-circuit as `unchanged` (Principle VIII).

**Producer.** `write-manifest.ts` (extended from Feature 005).

**Consumer.** `orchestrator.ts` RENDER step cache-check.

**Schema extension** — new fields added to the existing shape:

```json
{
  "schema_map": "sha256:...",
  "brief": "sha256:...",
  "shared_lib": "sha256:...",
  "openapi": "sha256:...",               // NEW
  "action_manifest": "sha256:..."        // NEW
}
```

The `classifier_model_snapshot` is NOT included in this ledger — it is
recorded inside `action-manifest.md` itself (R9). Determinism at the
render step is defined against the manifest content, not the model
snapshot that produced it.

---

## 5. In-memory type: `RenderContext` (EXTENDED)

**Purpose.** The context object `renderBackend()` passes to Handlebars
at render time. Extended with a `tools` field so `tools.ts.hbs`'s
existing `{{#if tools}}{{{toolsJson}}}{{else}}[]{{/if}}` conditional
can populate correctly.

**Location.** `packages/scripts/src/render-backend.ts`.

**Schema change:**

```ts
// Existing:
export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
  defaultLocale: string;
  briefSummary: string;
}

// Extended:
export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
  defaultLocale: string;
  briefSummary: string;
  tools: RuntimeToolDescriptor[];          // NEW — required
  toolsJson: string;                       // NEW — pre-serialised JSON (Handlebars helper)
}
```

`tools` is always an array; empty for the graceful-degradation case
(FR-014). `toolsJson` is derived from `tools` inside
`renderBackend()` via a Handlebars helper registered at compile time
(`registerHelper("toolsJson", (t) => JSON.stringify(t, null, 2))`);
storing the derived form in the context lets the template use
`{{{toolsJson}}}` directly without invoking the helper per render.

**Validation rules.**

- `tools` is the output of `parse-action-manifest.ts`, mapped to
  `RuntimeToolDescriptor` (the existing shape already defined in
  `packages/backend/src/tools.ts.hbs` lines 11-21).
- Every `tools[*].name` MUST match the `toolName` of exactly one
  included manifest entry.
- Every `tools[*].http.(method, path)` MUST match the source
  `(method, path)` of the corresponding manifest entry. Enforcement:
  cross-validated inside `parse-action-manifest.ts` before the
  descriptor list is returned.

---

## 6. In-memory type: `RuntimeToolDescriptor` (UNCHANGED)

**Location.** Defined in `packages/backend/src/tools.ts.hbs:11-21`;
the rendered `tools.ts` exports the interface.

```ts
export interface RuntimeToolDescriptor {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string };
  is_action: boolean;
  description_template?: string;
  summary_fields?: string[];
}
```

**Mapping from `ActionManifestEntry`:**

| `RuntimeToolDescriptor` | `ActionManifestEntry` |
|-------------------------|-----------------------|
| `name`                  | `toolName`            |
| `description`           | `description`         |
| `input_schema`          | `parameters`          |
| `http.method`           | `source.method`       |
| `http.path`             | `source.path`         |
| `is_action`             | `isAction`            |
| `description_template`  | `descriptionTemplate` |
| `summary_fields`        | `summaryFields`       |

The `PUT` method is present in `ActionManifestEntrySchema` but NOT in
`RuntimeToolDescriptor.http.method` (the existing Feature 003 runtime
descriptor was shaped for `GET/POST/PATCH/DELETE`). If the classifier
produces a `PUT` action, either:
(a) the manifest entry is automatically rewritten as `POST` with the
body identical (not all hosts distinguish), OR
(b) Feature 006 extends the `RuntimeToolDescriptor` to accept `PUT`.
Chosen: **(b)**, because option (a) is semantically lossy. The
`tools.ts.hbs` template gains `| "PUT"` in the union.

---

## 7. In-memory type: `ActionIntent` (UNCHANGED)

**Location.** `packages/scripts/src/lib/types.ts` (shared type, vendored
into the backend and consumed by the widget).

The shape is authored in Feature 003 and this feature does not modify
it. The widget's `executeAction()` receives an `ActionIntent` and looks
up the matching entry in `ActionExecutorsCatalog.actions[]` by
`intent.tool`, then builds the HTTP request from the catalog entry
(NOT from `intent.http`, which carries a pre-rendered URL).

The `intent.http` field remains for backwards compatibility but is
ignored by the new executor path. The widget's old behaviour of using
`intent.http.path` directly is replaced by the catalog-driven path
build. This is explicitly a soft migration — existing Feature 005
manifests (hand-authored) continue to render valid `intent.http` in
backend output, and the widget gracefully handles either shape.

---

## 8. Configuration extension: `WidgetConfig` (EXTENDED)

**Location.** `packages/widget/src/config.ts`.

```ts
// Existing:
export interface WidgetConfig {
  apiBaseUrl: string;
  authMode: "cookie" | "bearer" | "custom";
  allowedTools: string[];
  // ...
}

// Extended:
export interface WidgetConfig {
  apiBaseUrl: string;
  authMode: "cookie" | "bearer" | "custom";
  allowedTools: string[];
  actionExecutorsUrl: string;              // NEW — URL of action-executors.json
  // ...
}
```

**Default.** When omitted, the widget resolves
`actionExecutorsUrl` from `<script>` tag data attributes (the existing
`data-atw-*` convention) with a final fallback of
`${widgetBundleBaseUrl}/action-executors.json`.

**Validation.** Fetched URL must be same-origin with the widget bundle
(prevents a third party from serving a malicious catalog); if
cross-origin, the widget logs a warning and falls back to chat-only.

---

## 9. Entity relationships

```
.atw/artifacts/openapi.json
        │
        │ consumed by
        ▼
classify-actions.ts ──────────►  action-manifest.md
                                      │
                                      │ parsed by
                                      ▼
                               parse-action-manifest.ts
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
                RuntimeToolDescriptor[]   ActionExecutorsCatalog
                         │                         │
                         │ rendered into           │ written as
                         ▼                         ▼
                   tools.ts                action-executors.json
                         │                         │
                         │ loaded by               │ fetched by
                         ▼                         ▼
              backend /v1/chat         widget action-executors.ts
              (Opus tool descriptors)   (catalog interpreter)
                         │                         │
                         │ emits                   │ receives
                         ▼                         ▼
                    ActionIntent  ───────────►  executeAction()
                                                   │
                                                   │ fetch(intent.tool
                                                   │   resolved in catalog,
                                                   │   same-origin cookies)
                                                   ▼
                                                host API
```

Every arrow is a deterministic transformation with tests exercising
the invariants named in this document.

---

## 10. State transitions

### Ingestion (`/atw.api`)

```
<no openapi.json>              <no openapi.json>       <openapi.json>
       │                              │                      │
       │ /atw.api --source <path>     │ /atw.api with        │ /atw.api
       │ (first run)                  │ broken input         │ (re-run, same input)
       ▼                              ▼                      ▼
  Validate → write            Validate fails →         Validate → hash
  openapi.json, update        diagnostic to stderr,    matches prior →
  input-hashes.json           exit non-zero,           action: unchanged,
                              no write                  exit 0
```

### Classification (`/atw.classify` or inline CLASSIFY sub-step)

```
<openapi.json present>
  + <no action-manifest.md>
       │
       │ first classify
       ▼
  Heuristic pass → candidate list
       │
       │ Opus review (narrow only)
       ▼
  Validate anchored-generation → reject if fabricated
       │
       ▼
  Write action-manifest.md

<openapi.json present>
  + <action-manifest.md present>
       │
       │ delta-merge classify (R7)
       ▼
  For each prior manifest entry:
    if operationId still in openapi → preserve
    else → move to Orphaned
  For each new operation in openapi (not in manifest):
    run heuristic+Opus, add to included or excluded
  Write merged action-manifest.md
```

### Render (inline in `/atw.build`)

```
<openapi.json hash matches prior?>
+ <action-manifest.md hash matches prior?>
+ <shared-lib hash matches prior?>
+ <tools.ts exists with prior sha?>
+ <action-executors.json exists with prior sha?>
       │
       │ all yes
       ▼
  action: unchanged, skip write

       │ any no
       ▼
  Parse manifest → RuntimeToolDescriptor[]
  Render backend (tools.ts populated)
  Render executors (action-executors.json)
  Update input-hashes.json
```

---

## 11. Validation summary

| Invariant | Source | Enforced at |
|-----------|--------|-------------|
| OpenAPI version in 3.0.x | FR-002, R1 | `atw-api.ts` (ingest) |
| No duplicate operationIds | FR-002 | `atw-api.ts` (ingest) |
| Every manifest entry traces to a real operation | FR-004, SC-002 | `parse-action-manifest.ts` + `render-executors.ts` cross-check |
| Every catalog entry has a matching manifest entry | FR-008, §3 | `render-executors.ts` cross-check |
| No credential-class header in catalog | FR-010, §3 | `ActionExecutorEntrySchema` Zod refinement |
| Catalog substitution is `arguments.<id>` only | FR-009, §3 | `SubstitutionSourceSchema` Zod regex |
| Catalog path template is relative | FR-016, §3 | `ActionExecutorEntrySchema` regex |
| 15 s `AbortController` on every widget fetch | FR-021, §8 | `action-executors.ts` runtime |
| No automatic retry in widget | FR-015a | `action-executors.ts` runtime (no retry code path exists) |
| Host-response rendered HTML-escaped in card | FR-009a, §8 | `action-card.tsx` + Preact default |
| No `eval`/`new Function`/dynamic `import` in widget | FR-009, SC-006 | Static grep in `action-card.interpreter-safety.contract.test.ts` |
| Byte-identical re-run | FR-012, SC-004 | `render-executors.determinism.integration.test.ts` |
| Empty catalog well-formed | FR-014, SC-005 | `ActionExecutorsCatalogSchema` accepts `actions: []` |
| Cross-origin warned at build time | FR-016 | `render-executors.ts` + unit test |

Every invariant has a home in the contract files
(`contracts/*.md`). Proceed to contracts/.

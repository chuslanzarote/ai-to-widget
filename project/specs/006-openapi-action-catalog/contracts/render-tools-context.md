# Contract: Render context extension — `tools` field

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §5, §6](../data-model.md)

This contract defines the minimal extension to `RenderContext` that
bridges the gap left by Feature 003: how action-manifest data reaches
the `tools.ts.hbs` template so the rendered `tools.ts` is non-empty
when the manifest has included actions (FR-006, FR-007, US3).

Contract test:
`packages/scripts/test/render-tools-ts.contract.test.ts`.

---

## 1. `RenderContext` shape

Location: `packages/scripts/src/render-backend.ts`.

Current (Feature 005):

```ts
export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
  defaultLocale: string;
  briefSummary: string;
}
```

Extended (this feature):

```ts
export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
  defaultLocale: string;
  briefSummary: string;
  tools: RuntimeToolDescriptor[];
  toolsJson: string;
}
```

Both `tools` and `toolsJson` are required fields — callers MUST pass
both. The orchestrator derives them from `parse-action-manifest.ts`
output (see §3 below). Tests set both explicitly.

## 2. `RuntimeToolDescriptor` shape

Defined in `packages/backend/src/tools.ts.hbs:11-21`; exported by the
rendered `tools.ts`:

```ts
export interface RuntimeToolDescriptor {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  http: { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string };
  is_action: boolean;
  description_template?: string;
  summary_fields?: string[];
}
```

**Change from Feature 003:** the method union gains `"PUT"` (see
`data-model.md §6` rationale). The template is updated via a single-
word edit to the `tools.ts.hbs` interface definition.

## 3. Derivation: `ActionManifestEntry` → `RuntimeToolDescriptor`

Performed by `parse-action-manifest.ts`, returning an array the
orchestrator passes into `renderBackend()`:

```ts
export function actionEntryToDescriptor(
  entry: ActionManifestEntry,
): RuntimeToolDescriptor {
  return {
    name: entry.toolName,
    description: entry.description,
    input_schema: entry.parameters,
    http: { method: entry.source.method, path: entry.source.path },
    is_action: entry.isAction,
    description_template: entry.descriptionTemplate,
    summary_fields: entry.summaryFields,
  };
}
```

Invariants:

- `descriptor.name` is always present and non-empty.
- `descriptor.input_schema.type === "object"` (enforced by
  `ActionManifestEntrySchema`).
- `descriptor.http.method` uppercase.
- `descriptor.http.path` starts with `/`.
- Optional fields (`description_template`, `summary_fields`) are
  omitted (not `null`, not `undefined`) when absent in the manifest
  entry, so the JSON serialisation stays clean.

## 4. `toolsJson` pre-serialisation

`toolsJson` is the result of:

```ts
JSON.stringify(tools, null, 2)
```

with the following stability guarantees (enforced by a post-serialise
check inside `renderBackend`):

- Object keys per descriptor appear in declaration order of the
  `RuntimeToolDescriptor` interface: `name`, `description`,
  `input_schema`, `http`, `is_action`, `description_template`,
  `summary_fields`. This is achieved by constructing each descriptor
  via a fresh object literal in `actionEntryToDescriptor` (above),
  which preserves the key order Node's `JSON.stringify` respects.
- `input_schema` sub-keys are sorted alphabetically by a canonicalise
  pass (separate utility — input schemas from OpenAPI can have any
  key order).
- Array entries in `summary_fields` preserve manifest order.
- No trailing whitespace on any line inside the JSON.

These guarantees feed FR-012 / SC-004 (byte-identical re-runs).

## 5. Handlebars binding

The existing template at `packages/backend/src/tools.ts.hbs:23-27`:

```handlebars
{{#if tools}}
export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = {{{toolsJson}}};
{{else}}
export const RUNTIME_TOOLS: RuntimeToolDescriptor[] = [];
{{/if}}
```

Rendering rules:

- `{{#if tools}}` is truthy when `tools.length > 0`. Empty array →
  `{{else}}` branch renders the literal `[]`. Feature 014 graceful
  degradation is handled entirely at the template level.
- `{{{toolsJson}}}` uses triple braces: Handlebars does NOT
  HTML-escape the output (we are rendering TypeScript source, not
  HTML). The content is already canonical JSON from §4.
- No other tokens in the template reference `tools` or `toolsJson`.

## 6. Orchestrator wiring

`packages/scripts/src/orchestrator.ts` RENDER step (currently at
lines 568-607) is extended:

```ts
// New: parse action-manifest.md before render
const manifestPath = join(flags.projectRoot, ".atw/artifacts/action-manifest.md");
let tools: RuntimeToolDescriptor[] = [];
if (await exists(manifestPath)) {
  const openapiPath = join(flags.projectRoot, ".atw/artifacts/openapi.json");
  if (!(await exists(openapiPath))) {
    // Manifest exists but OpenAPI missing — recoverable? No: manifest
    // validation requires openapi.json. Exit 1.
    throw new ManifestValidationError(
      "action-manifest.md present but openapi.json missing",
    );
  }
  const manifest = await parseActionManifest({ manifestPath, openapiPath });
  tools = manifest.included.map(actionEntryToDescriptor);
} else {
  // Graceful degradation (FR-014).
  progress.warn("No action-manifest.md — widget will be chat-only.");
}

// Thread into renderBackend
const rendered = await renderBackend({
  templatesDir: defaultTemplatesDir(),
  outputDir: join(flags.projectRoot, "backend", "src"),
  context: {
    projectName: readProjectName(flags.projectRoot),
    embeddingModel: DEFAULT_EMBEDDING_MODEL,
    anthropicModel: DEFAULT_OPUS_MODEL,
    generatedAt: new Date().toISOString(),
    defaultLocale: readDefaultLocale(flags.projectRoot),
    briefSummary: readBriefSummary(flags.projectRoot),
    tools,
    toolsJson: JSON.stringify(tools, null, 2),
  },
  backup: Boolean(flags.backup),
});
```

## 7. Render behaviour

- Manifest with N included entries → `tools.ts` contains
  `RUNTIME_TOOLS: RuntimeToolDescriptor[]` with N entries, each
  matching the manifest order (alphabetical within groups,
  groups alphabetical — matches manifest serialisation order).
- Empty manifest / missing manifest → `tools.ts` contains
  `RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`. Still well-formed.
  (FR-014)
- The `toolsForAnthropic()` export in `tools.ts` always returns
  exactly `RUNTIME_TOOLS.map(...)` of size N — no filtering, no
  hidden subsets. (FR-007)
- The `ACTION_TOOLS` and `SAFE_READ_TOOLS` arrays split on
  `is_action`; every manifest entry's `is_action` value is
  preserved verbatim through the split. (FR-007)

## 8. Determinism

- `generatedAt` is included in `RenderContext` for display only; it
  is NOT rendered into `tools.ts` (the template does not reference
  it). Feature 002/005 determinism pattern: the timestamp lives in
  the build manifest, not in rendered source.
- All other fields in `RenderContext.tools` are content-hash inputs
  (via `action-manifest.md` sha256).

## 9. Test outline

`packages/scripts/test/render-tools-ts.contract.test.ts` MUST cover:

- `tools.length === 0` → rendered `tools.ts` contains
  `RUNTIME_TOOLS: RuntimeToolDescriptor[] = []`; `SAFE_READ_TOOLS`
  and `ACTION_TOOLS` are both `[]`.
- `tools.length > 0` → rendered `tools.ts` contains a JSON literal
  with N entries; each entry's `name`, `description`, `input_schema`,
  `http`, `is_action` match the source descriptor.
- A mix of `is_action: true` and `is_action: false` → `ACTION_TOOLS`
  contains exactly the `is_action: true` names; `SAFE_READ_TOOLS`
  contains exactly the `is_action: false` names.
- `description_template` and `summary_fields`, when present on the
  source, appear in the rendered JSON.
- When absent, they are NOT present in the rendered JSON (no
  `"description_template": undefined`, no `"description_template":
  null`).
- Re-render on identical input → sha256 matches prior; action
  `unchanged`.
- `toolsForAnthropic()` returns exactly `RUNTIME_TOOLS.length` entries
  with `name`, `description`, `input_schema` fields. (FR-007)

`packages/scripts/test/render-tools-ts.determinism.integration.test.ts`:

- Same manifest + shared-lib snapshot rendered twice → byte-identical
  `tools.ts`. Cross-platform sha256 match.

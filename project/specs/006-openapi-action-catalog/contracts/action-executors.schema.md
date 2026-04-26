# Contract: `action-executors.json` schema

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §3](../data-model.md)
**Research**: [../research.md §R4, R5](../research.md)

This contract is the authoritative reference for the declarative
execution catalog the widget loads at initialisation. It is the
enforcement point for FR-008, FR-009, FR-009a, FR-010, FR-016,
and SC-006 (no dynamic code execution).

Contract test:
`packages/scripts/test/render-executors.contract.test.ts`.

---

## 1. File location

- Path: `<project>/.atw/artifacts/action-executors.json`
- Encoding: UTF-8 without BOM.
- Format: JSON, pretty-printed with 2-space indent, stable key
  ordering, trailing newline.
- Served at runtime: `${widgetBundleBaseUrl}/action-executors.json`
  via the same static hosting as the widget bundle (R5).

## 2. Top-level shape

```json
{
  "version": 1,
  "credentialMode": "same-origin-cookies",
  "actions": [ /* ActionExecutorEntry[] */ ]
}
```

- `version`: fixed to `1` in v1. A later feature may bump via explicit
  migration. Any other value → widget logs a warning and falls back
  to chat-only.
- `credentialMode`: fixed to `"same-origin-cookies"` in v1. Spec
  Assumptions mark OAuth and bearer out of scope; the widget's
  executor maps this literal to `credentials: 'include'` via the
  existing `buildHostApiRequest()` cookie mode in
  `packages/widget/src/auth.ts`. (FR-010)
- `actions`: may be empty (FR-014 graceful degradation).

## 3. `ActionExecutorEntry` shape

```json
{
  "tool": "add_to_cart",
  "method": "POST",
  "pathTemplate": "/store/carts/{cart_id}/line-items",
  "substitution": {
    "path": {
      "cart_id": "arguments.cart_id"
    },
    "body": {
      "variant_id": "arguments.variant_id",
      "quantity": "arguments.quantity"
    },
    "query": {}
  },
  "headers": {
    "content-type": "application/json"
  },
  "responseHandling": {
    "successStatuses": [200, 201],
    "summaryTemplate": "Added {product_title} ×{quantity} to cart.",
    "summaryFields": ["product_title", "quantity"],
    "errorMessageField": "message"
  }
}
```

### 3.1 `tool`

- Matches `^[a-z][a-z0-9_]*$`.
- Identical to the `toolName` of one `ActionManifestEntry` in the
  same build.
- Unique within `actions[]`.

### 3.2 `method`

- One of `"GET"`, `"POST"`, `"PUT"`, `"PATCH"`, `"DELETE"`.

### 3.3 `pathTemplate`

- MUST be a relative path starting with `/`.
- MAY contain `{identifier}` placeholders.
- Rejected by schema: absolute URLs (starts with `http`), protocol-
  relative (`//`), empty string, paths containing `..`.

### 3.4 `substitution`

Three sub-buckets: `path`, `body`, `query`.

Each bucket is a `Record<string, string>` where:

- Keys are the local identifier receiving the substituted value:
  - For `path`: matches a `{identifier}` placeholder in
    `pathTemplate`. Every placeholder MUST have a corresponding
    `substitution.path` entry (schema-validated).
  - For `body`: becomes the field name in the JSON request body.
  - For `query`: becomes the query-string parameter name.
- Values match `SubstitutionSourceSchema`: exactly the regex
  `/^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/`. No dotted paths. No
  brackets. No expressions. This is the STATIC guarantee backing
  FR-009 / SC-006.

The interpreter resolves a value by:

```ts
// Pseudocode inside action-executors.ts
function resolveSubstitution(src: string, intent: ActionIntent): unknown {
  // src matches /^arguments\.[a-zA-Z_][a-zA-Z0-9_]*$/
  const key = src.slice("arguments.".length);
  return intent.arguments[key];
}
```

No `eval`, no `Function`, no `JSONPath`, no lookup library. One
string-slice and one object-index access, nothing else. Unknown keys
(requested by the catalog but missing from `intent.arguments`) cause
the executor to refuse the request with a structured validation error
(FR-015).

### 3.5 `headers`

- Object mapping header name → literal string value.
- MUST NOT contain any credential-class header. The Zod refinement
  exhaustively rejects:
  - `Authorization` (any casing).
  - `Cookie` / `Set-Cookie` (any casing).
  - `X-*-Token`, `X-*-Auth`, `X-*-Session` (any casing, regex
    `/^X-.*-(Token|Auth|Session)$/i`).
- Default: `{"content-type": "application/json"}` for methods with
  request bodies; `{}` for `GET`.
- These headers are added verbatim to the `fetch` call; no variable
  substitution in header values.

### 3.6 `responseHandling`

```json
{
  "successStatuses": [200, 201],
  "summaryTemplate": "Added {product_title} ×{quantity} to cart.",
  "summaryFields": ["product_title", "quantity"],
  "errorMessageField": "message"
}
```

- `successStatuses`: non-empty array of HTTP status codes (100-599).
  The interpreter treats any response whose status is in this list as
  success; anything else as failure. (FR-011)
- `summaryTemplate`: a string containing zero or more `{identifier}`
  placeholders. The interpreter substitutes these with values pulled
  from either (a) the parsed response body (top-level fields matching
  the placeholder name) or (b) the `ActionIntent.arguments` (fallback
  when the response doesn't carry the field). Rendered via a single
  `String.replace` over the regex `/\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g`.
  No nested braces, no conditionals, no helpers.
- `summaryFields`: redundant with `summaryTemplate` placeholders;
  exists as a hint to the widget for `summary` field naming.
  Confirmation card uses it to display field labels in
  `summary[k]/summary[v]` pairs.
- `errorMessageField`: optional. Names the top-level field in the
  error response body whose value becomes the user-visible error
  message. Absence: the widget falls back to a canonical
  `"Something went wrong executing that. Please try again."` string.

### 3.7 Rendered confirmation-card fields (FR-009a)

Every value pulled from the response body and substituted into the
card MUST be HTML-escaped at render time. The widget relies on Preact's
default JSX text-child behaviour (children are text nodes, escaped
automatically). The widget MUST NOT use `dangerouslySetInnerHTML`,
MUST NOT parse Markdown, MUST NOT autolink URLs in host-response
strings. Static check: grep in `action-card.tsx` for
`dangerouslySetInnerHTML` / `DOMParser` / `innerHTML =` — zero
occurrences.

## 4. Determinism

- Key ordering: alphabetical at every level.
- Indent: 2 spaces.
- No trailing whitespace on any line.
- Final newline present.
- Number formatting: integers as integers, no trailing `.0`.
- Strings use `\n`, `\t`, `\"`, `\\` for escapes; no unnecessary
  Unicode escape sequences (prefer literal characters).

Byte-identical re-runs on identical manifest + shared-lib snapshot.
Enforced by `render-executors.determinism.integration.test.ts`.

## 5. Validation (Zod schema)

See `data-model.md §3` for the `ActionExecutorsCatalogSchema` and
`ActionExecutorEntrySchema` definitions. The schema is shared between:

1. The renderer (`render-executors.ts`), which runs it as a
   post-write assertion — rejects the write and exits 1 if the shape
   drifts.
2. The widget runtime (`action-executors.ts`), which runs it on the
   fetched catalog — on failure, logs a warning and falls back to
   chat-only.

## 6. Rendering contract (build-time)

`render-executors.ts`:

```ts
export async function renderExecutors(
  manifest: ActionManifest,
  opts: {
    outputPath: string;               // .atw/artifacts/action-executors.json
    hostOrigin: string;               // from brief.md; for cross-origin detection
    widgetOrigin: string;             // from config; for cross-origin detection
    backup?: boolean;
  },
): Promise<RenderExecutorsResult>;

export interface RenderExecutorsResult {
  path: string;
  sha256: string;
  bytes: number;
  action: "created" | "unchanged" | "rewritten";
  warnings: string[];                 // cross-origin warnings for orchestrator to surface
}
```

Steps:

1. Build a `ActionExecutorsCatalog` in memory from
   `manifest.included[]`.
2. For each entry whose `pathTemplate` resolved against `hostOrigin`
   produces a URL whose origin differs from `widgetOrigin`, push a
   cross-origin warning into `warnings[]` naming the tool and the
   offending origins. (FR-016)
3. Zod-validate the catalog; throw on any shape violation (indicates
   a bug in the renderer or a malformed manifest).
4. Canonicalise: recursively sort object keys; serialise with
   2-space indent; append trailing newline.
5. Compute sha256 of output bytes.
6. Compare to prior file (if any); write action per Feature 005's
   `created`/`unchanged`/`rewritten` taxonomy.

## 7. Graceful degradation (FR-014)

When `manifest.included.length === 0`:

```json
{
  "version": 1,
  "credentialMode": "same-origin-cookies",
  "actions": []
}
```

This is written verbatim. The widget loads it, validates, finds an
empty `actions[]`, and boots in chat-only mode.

## 8. Test outline

`packages/scripts/test/render-executors.contract.test.ts` MUST cover:

- Manifest with one action → catalog has one entry; all fields match
  manifest (tool name, method, path, substitution, etc.).
- Manifest with multiple actions, grouped → catalog's `actions[]`
  ordered alphabetically by `tool`.
- Manifest with zero included → catalog has `actions: []` and
  `credentialMode` + `version` still set.
- Manifest with `DELETE` method → catalog entry preserves method.
- Manifest with entry missing a required substitution variable →
  renderer throws `InvalidSubstitutionError`.
- Manifest with an entry whose path is cross-origin relative to
  widget origin → warning emitted, catalog still written.
- Header containing `Authorization` → Zod refinement rejects; test
  expects thrown error.
- Substitution value containing `arguments.foo.bar` (dotted) → Zod
  regex rejects.
- Determinism: re-render on identical manifest → sha256 matches
  prior, action `unchanged`.

`packages/scripts/test/render-executors.determinism.integration.test.ts`:

- Run `renderExecutors()` twice with identical inputs → second run
  returns `action: "unchanged"`, file mtime unchanged, no disk write.
- Run on Linux and Windows with same inputs → sha256 matches.

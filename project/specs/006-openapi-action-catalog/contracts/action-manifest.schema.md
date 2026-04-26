# Contract: `action-manifest.md` schema

**Feature**: 006 (OpenAPI-driven action catalog)
**Plan**: [../plan.md](../plan.md)
**Data model**: [../data-model.md §2](../data-model.md)

This contract is the authoritative reference for the structure,
ordering, and validation of `action-manifest.md`. The Builder reads
and edits this file by hand; the classifier writes it; the render
step consumes it. Every section below is testable via
`packages/scripts/test/parse-action-manifest.unit.test.ts`.

---

## 1. File location

- Path: `<project>/.atw/artifacts/action-manifest.md`
- Encoding: UTF-8 without BOM.
- Line endings: LF (`\n`). Trailing newline at EOF.
- No hidden characters outside standard ASCII unless a human-authored
  description includes them.

## 2. Section order

The file MUST contain the following top-level sections in this order:

1. `# Action manifest` — top-level heading.
2. `## Provenance` — machine-generated bullets.
3. `## Summary` — 1-3 paragraphs, narrative, human-authored or
   stub-generated.
4. `## Tools: <group>` — one or more subsections, one per logical
   grouping (e.g., `Tools: cart`, `Tools: product`). Each contains
   `### <tool_name>` blocks.
5. `## Excluded` — a flat bulleted list.
6. `## Orphaned (operation removed from OpenAPI)` — optional; absent
   when empty.
7. `## Runtime system prompt block` — optional; carried over from
   Feature 001's `brief.md` if present, otherwise omitted.

No other top-level sections are allowed. The parser rejects unknown
`##` headings with a `ManifestFormatError`.

## 3. Provenance section

Exactly three bullets, in this order:

```markdown
## Provenance

- OpenAPI snapshot: sha256:<64 hex chars>
- Classifier model: <model-id> (<YYYY-MM-DD effective date>)
- Classified at: <ISO-8601 UTC timestamp>
```

Any deviation from this format is a `ProvenanceFormatError`. The
Builder MAY edit the free-text effective date if they wish to record
a narrower release tag (e.g., `claude-opus-4-7 (2026-04-23 release)`).
Whitespace between label and value is a single space; no tabs.

## 4. Tools sections (included actions)

Each tool lives under a `## Tools: <group>` heading and appears as:

```markdown
### <tool_name>

Description: <free-form one-line description>
description_template: "<optional template with {name} placeholders>"
summary_fields: ["<field1>", "<field2>"]

Parameters:

```json
<JSON object with type, properties, required>
```

requires_confirmation: true | false
is_action: true | false
Source: <METHOD> <path>
Parameter sources: <free-form>
```

Field rules:

- `<tool_name>` MUST match `^[a-z][a-z0-9_]*$` and be unique within the
  entire manifest.
- `Description:` MUST be a single line, non-empty, no embedded
  newlines.
- `description_template:` is optional. When present, its value is
  double-quote-wrapped and `{name}` placeholders are allowed. The
  confirmation card renders this with the `tool_use.arguments`
  substituted. Parsed by the existing Feature 003
  `lib/action-intent.ts` template renderer.
- `summary_fields:` is optional. When present, it is a JSON array of
  strings on one line.
- `Parameters:` block: a single fenced JSON object. MUST have
  `"type": "object"`. `properties` is required; `required` defaults
  to `[]`.
- `requires_confirmation:` MUST be `true` or `false`. Default is
  `true` for `is_action: true` entries (enforced by the Zod schema).
- `is_action:` MUST be `true` or `false`.
- `Source:` MUST be `<METHOD> <path>` with a space between, method
  uppercase, path starting with `/`.
- `Parameter sources:` is optional and free-form.

**Ordering within a group.** Tools within a group are sorted
alphabetically by `<tool_name>`. Groups are sorted alphabetically. The
classifier enforces this ordering on write; the parser tolerates but
warns on reordered input (so a Builder manual edit doesn't fail the
parse).

## 5. Excluded section

```markdown
## Excluded

- <METHOD> <path> — <reason>
- <METHOD> <path> — <reason>
- ...
```

Field rules:

- One bullet per excluded operation.
- `<METHOD>` uppercase; `<path>` starts with `/`.
- Separator is ` — ` (space, em-dash, space).
- `<reason>` is free-form but SHOULD use one of the canonical tokens:
  - `admin-prefix`
  - `non-cookie-security`
  - `missing-request-schema`
  - `destructive-unowned`
  - `opus-narrowed`
  - `manual-exclusion`
  - `out-of-scope: <reason>` (free-form continuation permitted)

The parser attempts to extract a canonical token at the start of the
reason for analytics; unrecognised reasons are recorded verbatim.

**Ordering.** Sorted alphabetically by `<path>`, then by `<method>`.

## 6. Orphaned section (conditional)

Appears only when the delta-merge detected prior manifest entries
whose OpenAPI operations no longer exist. Format:

```markdown
## Orphaned (operation removed from OpenAPI)

- <METHOD> <path> — previously: <previous_tool_name>
- ...
```

The Builder resolves orphaned entries by either deleting them (the
operation was really removed) or by restoring the operation in the
OpenAPI (in which case the next run merges it back). The parser
treats the orphaned section as informational only; no `RuntimeToolDescriptor`
is derived from it.

## 7. Runtime system prompt block (conditional)

Free-form paragraph carried over from `brief.md`. Rendered into the
backend's `prompts.ts` via a separate pipeline (Feature 001/002
responsibility), not consumed by this feature. The parser skips this
section without validation.

## 8. Complete example

```markdown
# Action manifest

## Provenance

- OpenAPI snapshot: sha256:a1b2c3d4e5f6…(64 chars)
- Classifier model: claude-opus-4-7 (2026-04-23)
- Classified at: 2026-04-23T10:15:00Z

## Summary

Five read-only discovery tools over products, categories, collections,
and regions, plus one cart action (`add_to_cart`) exposed behind a user
confirmation card. Brief restricts the agent to browse/recommend/
suggest/compare/add-to-cart; order, payment, customer, returns,
shipping, and gift-card paths are excluded.

## Tools: cart

### add_to_cart

Description: Add a specific product variant to the shopper's cart.
description_template: "Add {quantity} × {product_title} to cart"
summary_fields: ["product_title", "quantity", "price_preview"]

Parameters:

```json
{
  "type": "object",
  "required": ["cart_id", "variant_id", "quantity"],
  "properties": {
    "cart_id": { "type": "string" },
    "variant_id": { "type": "string" },
    "quantity": { "type": "integer", "minimum": 1, "maximum": 10 },
    "product_title": { "type": "string" },
    "price_preview": { "type": "string" }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{cart_id}/line-items
Parameter sources: prior tool call + session context

## Tools: product

### get_product

Description: Fetch a single product by id (full detail including
variants, prices, description).

Parameters:

```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
```

requires_confirmation: false
is_action: false
Source: GET /store/products/{id}
Parameter sources: prior tool call

### list_products

Description: List coffee products with optional filters.

Parameters:

```json
{
  "type": "object",
  "properties": {
    "limit": { "type": "integer", "default": 12 },
    "q": { "type": "string" }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/products
Parameter sources: user message

## Excluded

- DELETE /store/carts/{cart_id}/line-items/{line_id} — manual-exclusion (brief allows only add-to-cart)
- POST /admin/users — admin-prefix
- POST /store/carts/{id}/complete — manual-exclusion (brief forbids completing an order)
- POST /store/payment-collections — non-cookie-security
```

## 9. Parser behaviour

`parse-action-manifest.ts`:

1. Reads the file.
2. Splits by top-level `##` headings.
3. Validates section order and presence of required sections.
4. For each `## Tools:` section, walks `### <tool_name>` blocks and
   produces an `ActionManifestEntry` per block.
5. Parses the `## Excluded` bulleted list into `ExcludedEntry[]`.
6. Parses the `## Orphaned` section (if present) into
   `OrphanedEntry[]`.
7. Loads `.atw/artifacts/openapi.json` and cross-validates every
   `included[*].source` triple exists there (FR-004). Any mismatch →
   `ManifestValidationError` with the offending triple named.
8. Returns the Zod-validated `ActionManifest`.

## 10. Error taxonomy

| Error class | Trigger | Orchestrator response |
|-------------|---------|-----------------------|
| `ManifestFormatError` | Missing required section, unknown top-level heading, malformed fenced JSON. | Exit 1, diagnostic names the offending section/line. |
| `ProvenanceFormatError` | Provenance bullet missing or malformed. | Exit 1. |
| `ManifestValidationError` | `included[*].source` does not trace back to OpenAPI (FR-004). | Exit 1, diagnostic names the fabricated entry. |
| `ToolNameCollisionError` | Two `### <tool_name>` blocks with the same name. | Exit 1. |

All errors originate from `parse-action-manifest.ts` and carry a
`.code` property the orchestrator maps to exit 1 with a
`pipeline_failures` entry in the build manifest.

## 11. Test outline

`packages/scripts/test/parse-action-manifest.unit.test.ts` MUST cover:

- Minimal valid manifest with one tool and one excluded → parses.
- Empty included (only excluded) → parses, `included: []`.
- Missing `## Provenance` → `ProvenanceFormatError`.
- Missing required `requires_confirmation` line → `ManifestFormatError`.
- Malformed JSON in `Parameters:` fence → `ManifestFormatError`.
- `source` triple not in OpenAPI → `ManifestValidationError`.
- Duplicate `### <tool_name>` → `ToolNameCollisionError`.
- Builder-flipped `requires_confirmation: false` → preserved through
  round-trip parse→serialise.
- Non-canonical token in `<reason>` → accepted, verbatim preserved.
- Unknown `##` heading → `ManifestFormatError`.
- Round-trip parse + re-serialise is byte-identical (determinism).

# Contract: enrichment prompt & validator

**Feature**: Build Pipeline (Feature 002)
**Date**: 2026-04-22

This contract fixes the Opus prompt shape, the response JSON schema,
and the validator rules that bind every `atw_documents` row to
Principle V (Anchored Generation). The validator is the structural
enforcement of Principle V; the prompt is its motivated suggestion.
The validator is authoritative.

---

## 1. Prompt template

File: `packages/backend/src/enrich-prompt.ts.hbs`
Version: `enrich-v1` (string literal also written to the prompt
template's top comment and included in `source_hash`).

### 1.1 System block (verbatim)

```text
You are an enrichment assistant for AI to Widget. You receive structured
JSON describing one business entity from a client's catalog. Your job is
to produce a natural-language description ("document") that a retrieval
system can embed, together with a list of atomic facts and a set of
semantic category labels.

You MUST obey these rules without exception:

1. Every claim in "facts" MUST cite a specific field from the input JSON
   in its "source" property. The source string MUST exactly match a key
   present in the flattened input.
2. You MUST NOT state any fact that is not directly supported by an
   input field. You MUST NOT generalize, guess, or fill in plausible
   details.
3. If the input does not contain enough information to write a useful
   document, you MUST return {"insufficient_data": true, "reason": "..."}.
   Do not fabricate a description to appear helpful.
4. Categories MUST use only labels from the vocabulary I provide for
   this entity type. If no listed label fits, omit the category
   entirely rather than inventing a new one.
5. Return ONLY valid JSON matching the schema at the bottom of this
   prompt. No prose outside the JSON.

Principle V of the AI to Widget constitution applies: no invented
facts, no plausible-sounding fabrications. Your output will be
validated against rule 1 structurally; violations are rejected.
```

### 1.2 User block template

Handlebars interpolation over:

```text
Entity type: {{entity_type}}
Project context: {{brief_summary}}

Allowed category vocabulary for {{entity_type}}:
{{#each category_vocabulary}}
  - {{category}}: {{values}}
{{/each}}

Input JSON:
```
```json
{{{flattened_input_json}}}
```
```text
Produce the enrichment JSON now.
```

### 1.3 Response schema (embedded at end of prompt)

```json
{
  "type": "object",
  "oneOf": [
    {
      "properties": {
        "kind": { "const": "enriched" },
        "document": { "type": "string", "minLength": 40 },
        "facts": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "claim":  { "type": "string", "minLength": 1 },
              "source": { "type": "string", "minLength": 1 }
            },
            "required": ["claim", "source"]
          }
        },
        "categories": {
          "type": "object",
          "additionalProperties": { "type": "array", "items": { "type": "string" } }
        }
      },
      "required": ["kind", "document", "facts", "categories"]
    },
    {
      "properties": {
        "insufficient_data": { "const": true },
        "reason": { "type": "string" }
      },
      "required": ["insufficient_data", "reason"]
    }
  ]
}
```

---

## 2. Validator rules (authoritative)

The validator (`packages/scripts/src/lib/enrichment-validator.ts`)
applies these rules, in order. The first failure causes rejection.

### 2.1 JSON shape

The response MUST be parseable JSON that matches `EnrichmentResponse`
([data-model.md §3.2](../data-model.md)). Any parse failure or shape
mismatch is rejection reason `invalid_shape`.

### 2.2 Document length

For `kind: "enriched"`, `document` MUST be at least 40 characters
after trimming whitespace. Shorter documents are rejection reason
`document_too_short` (treated as a refusal that failed to set the
`insufficient_data` flag correctly).

### 2.3 Facts non-empty and structurally valid

For `kind: "enriched"`, every entry in `facts` MUST have both a
non-empty `claim` and a non-empty `source`. Failure is rejection
reason `fact_missing_fields`.

### 2.4 Source anchoring (Principle V core)

For every `fact.source`, the source string MUST appear as a key in
the *flattened* assembled input JSON. Flattening uses dotted-path
notation for nested objects and `[n]` for array indices; the set of
flattened keys is computed once per entity.

Examples:

- Input `{ "primary_record": { "title": "Eau de Parfum" } }`
  → flattened key `primary_record.title` is valid source.
- Input `{ "related": [{ "relation": "variants", "rows": [{ "sku": "A-1" }]}] }`
  → flattened keys include `related[0].rows[0].sku`.

A `source` that does not appear in the flattened set is rejection
reason `source_not_in_input`.

### 2.5 Category vocabulary

For every `(category_key, label_array)` pair in `categories`, every
label MUST appear in the vocabulary for `(entity_type, category_key)`
declared in `build-plan.md`'s `enrichment.category_vocabularies`
table. Unknown labels are rejection reason `unknown_category_label`.

### 2.6 Insufficient-data branch

For `kind: "insufficient_data"`, `reason` MUST be non-empty. The
response is accepted (validation does not reject it); the orchestrator
flags the entity in `build-manifest.json.failures` with reason
`insufficient_data` and skips indexing.

---

## 3. Retry policy

When the validator rejects a response:

1. On the **first** rejection, the orchestrator constructs a
   "sharpening" follow-up prompt citing the specific rule that failed
   and the offending string(s), then re-invokes Opus with the
   original system+user prompt plus the follow-up.
2. If the re-invocation **also** fails validation, the orchestrator
   MUST NOT retry again. The entity is flagged as
   `validation_failed_twice` in `build-manifest.json.failures`,
   skipped (not indexed), and the build continues.

The sharpening prompt template is `enrich-prompt-sharpen.ts.hbs`,
versioned as `enrich-sharpen-v1`.

---

## 4. Source-hash rule

`source_hash = SHA-256(
  canonical_json(assembled_input_without_metadata)
  || "\0"
  || prompt_template_version          // e.g. "enrich-v1"
  || "\0"
  || model_id                         // "claude-opus-4-7"
)`

- `canonical_json` sorts keys alphabetically at every level and emits
  no whitespace.
- `metadata.assembled_at` and `metadata.assembler_version` are
  excluded from the hash input so assembling twice at different times
  doesn't force re-enrichment.

---

## 5. Failure-mode matrix (HTTP level)

| HTTP | Behavior                                                                                              |
|------|-------------------------------------------------------------------------------------------------------|
| 200  | Hand response to validator. Continue per §3.                                                           |
| 400  | Flag entity as `opus_400`, skip, continue build. Record response excerpt in manifest.                  |
| 401 / 403 | Halt entire build with FR-085 diagnostic. Do not continue.                                       |
| 408 / 409 | Treat as transient: retry once with jittered delay.                                              |
| 429  | Exponential backoff (base 1 s, max 32 s, ±25 % jitter). If 3 consecutive 429s at concurrency 10, auto-reduce to 3 and continue. If 3 further 429s at concurrency 3, halt build (FR-070). |
| 5xx  | Retry once with jittered delay. Second failure: flag entity as `opus_5xx`, skip, continue build.        |

---

## 6. Token and cost accounting

Every Opus response carries usage tokens. The orchestrator:

1. Accumulates `input_tokens` and `output_tokens` into
   `build-manifest.opus`.
2. Computes running `cost_usd` using the published Opus 4.7 pricing
   (input $15 / 1M tokens, output $75 / 1M tokens as of 2026-04; a
   pricing constant lives in `packages/scripts/src/lib/pricing.ts`).
3. Stores per-row token counts in `atw_documents.opus_tokens` so a
   post-hoc audit can attribute cost to specific entities.

---

## 7. Principle compliance

- **V (red line).** §2.4 structurally enforces anchoring. §4 binds
  persistence to the exact input + prompt that produced it. §3 gives
  one retry with a sharpening prompt — not infinite retries that
  would amount to bargaining with the model.
- **IV.** The `insufficient_data` branch (§2.6) is how the model
  says "I don't know"; the orchestrator honors it by skipping rather
  than inventing a fallback, and the Builder sees it in the manifest.
- **IX.** Retries are bounded (§3) and costs are accounted (§6).
  Opus's cost is never unbounded by design.

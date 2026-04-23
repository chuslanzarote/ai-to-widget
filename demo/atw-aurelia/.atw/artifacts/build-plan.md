# Build Plan

## Project identity

- **Name.** aurelia
- **Deployment.** customer-facing-widget
- **Languages.** English

## Build inputs (consumed by `/atw.build`)

- `.atw/config/project.md`
- `.atw/config/brief.md`
- `.atw/artifacts/schema-map.md`
- `.atw/artifacts/action-manifest.md`

## Embedding model

- **Model:** `Xenova/bge-small-en-v1.5`
- **Dimension:** 384
- **Rationale:** English-only (per `project.md` `languages: [en]`),
  small (~90 MB), CPU-friendly, ONNX-compatible for local inference in
  the build container. The 384-dim choice is tied to this model.

## Category vocabularies (per entity)

Derived from `brief.md` § Business vocabulary and § Primary use cases.
Each vocabulary is projected as enrichment metadata on the enriched
document.

- **product:**
  - `roast_level` — vocab derived from `product_tag` / description
    (light, medium, medium-dark, dark) — brief term "roast level".
  - `origin_profile` — `single-origin` | `blend` — brief terms
    "single-origin", "blend".
  - `flavor_axis_acidity` — `low` | `medium` | `high` — brief term
    "acidity"; anchors brief use case "compares their acidity and body".
  - `flavor_axis_body` — `light` | `medium` | `full` — brief term
    "body"; same use case.
  - `brew_method_fit` — `espresso` | `filter` | `milk-based` — brief
    use cases "single-origin espresso", "blend for milk-based drinks".
  - `decaf_flag` — boolean — brief use case "decaf for a café menu".
  - `gift_flag` — boolean — brief use case "gift bundle".
  - `bag_format` — `retail-bag` | `kg-bag` — brief term "kg bag vs.
    retail bag".

- **product_category:** no custom vocabulary; `name` + `handle`
  indexed directly.

- **product_collection:** no custom vocabulary; `title` +
  `description` + `handle` indexed directly.

- **region:** no custom vocabulary; `name` + `currency_code` indexed
  directly (`currency_code` gates GBP display for UK).

## Enrichment prompt templates (per entity)

Per-entity pipeline: assemble → enrich → validate provenance → embed → upsert.

### product

> Given this coffee product (title, description, variants, category
> handles, collection handle, origin_country, material), emit (1) a 2–3
> sentence shopping-agent-oriented summary aimed at professional
> baristas, and (2) the category vocabulary values listed above. Anchor
> every value in the product's own text. If a value cannot be inferred
> from the source, emit `null` — do not guess. Tone: expert/technical,
> warm.

Source columns: `product.title`, `product.description`,
`product.origin_country`, `product.material`, `product.collection_id`,
`product_variant.title`, `product_variant.sku`,
`product_category.handle` (joined via `product_category_product`),
`product_tag` (joined via `product_tags`).

### product_category

> Summarize this category in 1 sentence for a professional barista.

Source columns: `product_category.name`, `product_category.handle`.

### product_collection

> Summarize this collection in 1 sentence. Indicate whether it appears
> to be a gift/curated bundle.

Source columns: `product_collection.title`,
`product_collection.description`.

### region

> One-line descriptor: '`{name}` — `{currency_code}` pricing'.

Source columns: `region.name`, `region.currency_code`.

## Backend + widget configuration defaults

- **Backend:** Node 20, `client_ref` Postgres + pgvector, ATW runtime
  service on port 9001.
- **Widget:** shadow-DOM React bundle, ships `dist/widget.js` and
  `dist/widget.css`.
- **Session:** `cart_id` held in `localStorage` under
  `aurelia:cart_id`; `add_to_cart` confirmation card surfaces
  `product_title`, `quantity`, `price_preview` (GBP).
- **System prompt:** as written in `action-manifest.md`
  § Runtime system prompt block.

## Build sequence

1. Validate inputs (all four upstream artifacts present, non-empty).
2. Start Postgres container with pgvector extension.
3. Apply `client_ref` migrations.
4. Import reference tables per `schema-map.md`: `product`,
   `product_variant`, `product_category`, `product_collection`,
   `region`, `product_category_product`, `product_tags`. Skip every
   table in the `schema-map.md` PII-excluded list.
5. Load embedding model (`Xenova/bge-small-en-v1.5`).
6. Enrich entities concurrently (concurrency cap 10, auto-reduce to 3
   on sustained 429s).
7. Compute 384-dim embeddings locally and upsert each document into
   `atw_documents` with entity type + source id + enriched body +
   metadata.
8. Render backend templates → `backend/src/*.ts` (tool handlers,
   system prompt, retrieval wiring).
9. Render widget bundle → `dist/widget.{js,css}`.
10. Build backend Docker image (`atw_backend:latest`).
11. Run post-build PII compliance scan — confirm no row from any
    `schema-map.md` PII-excluded table leaked into `atw_documents`.
12. Write `.atw/state/build-manifest.json` (hashes of inputs +
    artifact IDs + model versions — Principle VIII reproducibility).
13. Report summary to the Builder.

## Estimated cost

```
Enrichment calls:     ~50         (estimated from Medusa seed defaults)
                                    ~30 products
                                    ~10 categories
                                    ~5  collections
                                    ~3  regions
                                    ~1  aggregate brand summary
Per-call cost (USD):  0.035       (average; product cards longer than region blobs)
Subtotal (USD):       1.75
Retry buffer (USD):   0.35        (+20 % per FR-035)
Estimated total:      2.10
```

Entity counts are **estimated**; actual counts come from the Medusa
seed at build time. Override via re-run of `/atw.plan` if catalog size
is known to differ materially.

## Builder confirmation

Before `/atw.build` begins, the Builder sees this plan summarised and
must confirm with `y`. Any other response halts (FR-041, Principle IV).

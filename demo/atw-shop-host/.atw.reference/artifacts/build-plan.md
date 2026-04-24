# Build Plan

> Pre-generated for the Aurelia Medusa demo so reviewers reach the
> runtime without running the five Feature 001 commands. Regenerate by
> running `make fresh` followed by the full slash-command flow.

## Project identity

- **Name.** aurelia-coffee
- **Deployment.** customer-facing-widget
- **Languages.** Spanish (default), English (fallback)

## Build inputs (consumed by `/atw.build`)

- `.atw/config/project.md`
- `.atw/config/brief.md`
- `.atw/artifacts/schema-map.md`
- `.atw/artifacts/action-manifest.md`

## Embedding model

- Model: `Xenova/bge-small-multilingual-v1.5`
- Dimension: 384
- Rationale: multilingual (Spanish + English), small, CPU-friendly, ONNX.

## Enrichment plan

Per-entity pipeline: assemble → enrich (Opus) → validate provenance → embed → upsert.

### Estimated cost

- Enrichment calls: 342
  - 300 products
  - 25 categories
  - 12 collections
  - 4 regions
  - 1 aggregate (Aurelia brand summary)
- Per-call cost (USD): 0.035 (average; product cards are longer than region blobs)
- Subtotal: 11.97
- Retry buffer (20 %): 2.39
- Estimated total: **14.36**

## Build sequence

1. Validate inputs (all required artifacts present).
2. Start Postgres container with pgvector.
3. Apply migrations.
4. Import reference tables (products, categories, collections, regions — customer/order tables excluded per schema-map PII-excluded list).
5. Load embedding model.
6. Enrich entities concurrently (concurrency cap 10, auto-reduce to 3 on sustained 429s).
7. Compute 384-dim embeddings locally and upsert each document.
8. Render backend templates (`backend/src/*.ts`).
9. Render widget bundle (`dist/widget.{js,css}`).
10. Build backend Docker image (`atw_backend:latest`).
11. Run post-build PII compliance scan.
12. Write `.atw/state/build-manifest.json`.
13. Report summary to the Builder.

## Builder confirmation

Before `/atw.build` begins, the Builder sees this plan summarised and
must confirm with `y`. Any other response halts (FR-041, Principle IV).

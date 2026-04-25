# Build Plan

## Summary

Single indexable entity (`products`) with ~20 rows in the staged SQL
dump. The widget tool catalog will surface 8 actions across `products`
(indexed) plus three runtime-only groups (`cart`, `customers`,
`orders`). Embedding + enrichment runs once over the products table;
the cart/customer/orders groups call the host API at runtime and are
not enriched here.

## Embedding approach

- Model: `text-embedding-3-small` (1536 dimensions). Default for
  Feature 002; cheap and well-supported by pgvector.
- Vector storage: `pgvector` HNSW index on `atw_documents.embedding`.
- One document per product row. Source text concatenates `name`,
  `description`, and category vocabulary tokens derived below.

## Category vocabularies

- **products**:
  - Brewing method tokens — derived from `description` text. Examples
    seen in sample data: *espresso*, *pour-over*, *French press*,
    *cold brew*, *moka*, *AeroPress*. Source column:
    `products.description`.
  - Origin tokens — derived from `description` and `name`. Examples
    seen: *Ethiopian*, *Colombian*, *Guatemalan*, *Kenyan*, plus the
    domain term *single origin*. Source column: `products.description`.
  - Roast / tasting-note tokens — derived from `description`. Examples
    seen: *dark*, *medium*, *bright*, *floral*, *chocolate*. Source
    column: `products.description`.
  - Hardware vs. coffee distinction — derived from `name`. Hardware
    examples: *V60 set*, *grinder*, *moka pot*, *kettle*, *scale*,
    *frothing pitcher*. Source column: `products.name`.

## Enrichment prompt templates

### products

System: *"Given a coffee-shop product row, emit a short search-friendly
summary plus the categorical tokens above. Anchor every token to a
substring of `name` or `description`. Emit `null` for any category
that has no anchor."*

Inputs (per row): `name`, `description`, `price_cents`, `in_stock`.

Output JSON: `{ summary: string, brewing_methods: string[], origins:
string[], tasting_notes: string[], product_kind: "coffee" | "hardware"
| "snack" }`.

Anchored to `schema-map.md` §Entity: products §Columns.

## Estimated entity counts

- `products`: 20 (counted from the staged dump
  `.atw/inputs/atw-coffee-shop-products.cleaned.sql`).

## Cost estimate

```
Enrichment calls:     20
Per-call cost (USD):  0.0300
Subtotal (USD):       0.60
Retry buffer (USD):   0.12  (+20%)
Estimated total:      0.72
```

Computed by `lib/cost-estimator.ts` with the default
`perEntityMultiplier: 1`, `perCallCostUsd: 0.03`, and
`retryBufferRatio: 0.2`.

## Backend configuration defaults

- Postgres image: `pgvector/pgvector:pg16`.
- Postgres host port: `5433` (default for `--postgres-port`).
- `ALLOWED_ORIGINS`: `http://localhost:8080` (from
  `project.md#storefrontOrigins`).
- Welcome message: *"Hi, I'm the Barista Master, how can I help you
  today?"* (from `project.md#welcomeMessage`).
- Auth-token localStorage key: `shop_auth_token` (from
  `project.md#authTokenKey`); emitted as `data-auth-token-key` on the
  embed.
- Login redirect URL: `http://localhost:8080/login` (from
  `project.md#loginUrl`).
- Runtime model: `claude-opus-4-7`.

## Widget configuration defaults

- Bundle output: `dist/widget.js` + `dist/widget.css`.
- Executor recipes: `.atw/artifacts/action-executors.json` (generated
  from `action-manifest.md` at build time).
- Initial assistant turn populated from
  `project.md#welcomeMessage`.
- 401 handling: redirect shopper to `project.md#loginUrl` when set,
  otherwise show the inline "please log in" hint.

## Build sequence

1. Spin up pgvector container on port 5433 and wait for readiness.
2. Apply migrations from `packages/scripts/dist/apply-migrations.js`.
3. Import `client_ref` rows from
   `.atw/inputs/atw-coffee-shop-products.cleaned.sql` into the staging
   schema.
4. For each product row whose `source_hash` is new or `--force` is
   passed: call enrichment template, embed the resulting summary, and
   upsert into `atw_documents`.
5. Render backend TypeScript sources under `backend/src/` from the
   action manifest + project metadata.
6. Render the widget bundle to `dist/widget.{js,css}`.
7. Generate `.atw/artifacts/action-executors.json` from the
   `Tools:` sections (including the three runtime-only groups).
8. Build the multi-stage Docker image tagged `atw_backend:latest`.
9. Write `.atw/state/build-manifest.json` with the audit trail.

## Failure handling

- **Postgres unhealthy** → halt before enrichment; manifest records
  `result: "aborted"`, `phase: "postgres"`. Re-run resumes from this
  step.
- **Enrichment Opus call fails** → retry with exponential backoff up
  to the retry buffer; on persistent failure, the row is skipped and
  flagged in the manifest.
- **Render / bundle / image step fails** → halt; manifest records the
  failing phase. Re-run resumes from the failing phase. Already-
  enriched rows are recognized by `source_hash` and skipped.
- **Ctrl+C during enrichment** → graceful shutdown per
  `/atw.build` spec; in-flight calls complete; manifest written with
  `result: "aborted"`.

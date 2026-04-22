import path from "node:path";
import { promises as fs } from "node:fs";

export const PROJECT_MD = `---
name: aurelia-agent
languages:
  - Spanish
  - English
deploymentType: customer-facing-widget
createdAt: "2026-04-22T00:00:00Z"
---

# Project

- **Name**: aurelia-agent
- **Languages**: Spanish, English
- **Deployment type**: customer-facing-widget
- **Created at**: 2026-04-22T00:00:00Z
`;

export const BRIEF_MD = `# Business Brief

## Business scope

Aurelia is a boutique specialty coffee shop. The agent helps shoppers discover
products, compare variants, and understand brewing methods.

## Customers

Home-brew enthusiasts, gift buyers, and cafe professionals.

## Agent's allowed actions

- Help users discover products, variants, and collections.
- Explain brewing methods and tasting notes.
- Surface regional availability.

## Agent's forbidden actions

- Never process refunds or cancellations without human approval.
- Never expose customer personal information.

## Tone

Friendly, knowledgeable, never pushy.

## Primary use cases

- Product discovery by flavor profile.
- Brewing method recommendations.
- Gift suggestions by price range.

## Business vocabulary

- **product** — A coffee bean or piece of brewing equipment offered for sale.
- **variant** — A specific SKU of a product (size, grind, packaging).
- **collection** — A curated set of products grouped by theme.
- **region** — Geographic origin of a coffee bean.
`;

export const SCHEMA_MAP_MD = `# Schema map

## Summary

Four indexable entities plus reference and infrastructure tables.

## Entity: product

Classification: indexable
Source tables: public.product
Joined references: public.product_variant, public.product_category

### Columns

- title: index
- description: index
- handle: reference
- created_at: exclude-internal

### Evidence

Mentioned in brief's business scope and vocabulary; primary catalog table.

## Entity: variant

Classification: indexable
Source tables: public.product_variant
Joined references: public.product

### Columns

- title: index
- sku: reference

### Evidence

Brief vocabulary entry "variant".

## Entity: collection

Classification: indexable
Source tables: public.product_collection
Joined references: (none)

### Columns

- title: index
- handle: reference

### Evidence

Brief vocabulary entry "collection".

## Entity: region

Classification: indexable
Source tables: public.region
Joined references: (none)

### Columns

- name: index
- countries: index

### Evidence

Brief vocabulary entry "region".

## Reference tables

- public.product_category
- public.product_tag

## Infrastructure / ignored

- public.migration
- public.audit_log

## PII-excluded

- public.customer: columns [email, phone, first_name, last_name] — direct PII
- public.customer_address: columns [address_1, city, postal_code] — location PII
`;

export const ACTION_MANIFEST_MD = `# Action manifest

## Summary

Four indexable entities expose read-only discovery tools; admin endpoints excluded.

## Tools: product

### list_products

Description: List products with optional filters.

Parameters:

\`\`\`json
{ "type": "object", "properties": { "limit": { "type": "integer" } } }
\`\`\`

requires_confirmation: false
Source: GET /store/products
Parameter sources: user message

### get_product

Description: Fetch a single product by id.

Parameters:

\`\`\`json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
\`\`\`

requires_confirmation: false
Source: GET /store/products/{id}
Parameter sources: prior tool call

## Tools: collection

### list_collections

Description: List collections.

Parameters:

\`\`\`json
{ "type": "object" }
\`\`\`

requires_confirmation: false
Source: GET /store/collections
Parameter sources: user message

## Tools: region

### list_regions

Description: List regions.

Parameters:

\`\`\`json
{ "type": "object" }
\`\`\`

requires_confirmation: false
Source: GET /store/regions
Parameter sources: user message

## Tools: variant

### list_variants

Description: List variants for a product.

Parameters:

\`\`\`json
{ "type": "object", "properties": { "product_id": { "type": "string" } } }
\`\`\`

requires_confirmation: false
Source: GET /store/products/{id}/variants
Parameter sources: prior tool call

## Excluded

- POST /admin/products: admin-only
- DELETE /admin/products/{id}: admin-only + destructive
- POST /admin/orders/{id}/refund: admin-only + destructive

## Runtime system prompt block

You are the Aurelia shopping assistant. Help users find products, variants, and
collections. Never process refunds or expose customer PII.
`;

export const ARTIFACTS: Record<string, string> = {
  "config/project.md": PROJECT_MD,
  "config/brief.md": BRIEF_MD,
  "artifacts/schema-map.md": SCHEMA_MAP_MD,
  "artifacts/action-manifest.md": ACTION_MANIFEST_MD,
};

export async function writeAureliaArtifacts(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "config"), { recursive: true });
  await fs.mkdir(path.join(root, "artifacts"), { recursive: true });
  for (const [rel, body] of Object.entries(ARTIFACTS)) {
    await fs.writeFile(path.join(root, rel), body, "utf8");
  }
}

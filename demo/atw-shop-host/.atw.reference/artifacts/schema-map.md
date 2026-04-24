# Schema map

## Summary

Five indexable entity types from the Medusa v2 schema: `product`,
`product_variant`, `product_category`, `product_collection`, `region`.
Customer-related tables are excluded as direct PII (Principle I).

## Entity: product

Classification: indexable
Source tables: public.product
Joined references: public.product_variant, public.product_category_product, public.product_collection_product

### Columns

- title: index
- description: index
- handle: reference
- origin_country: index
- material: index
- status: exclude-internal
- created_at: exclude-internal
- updated_at: exclude-internal

### Evidence

Primary catalog surface. Every discovery query hits this table.

## Entity: variant

Classification: indexable
Source tables: public.product_variant
Joined references: public.product

### Columns

- title: index
- sku: reference
- inventory_quantity: reference

### Evidence

Shoppers ask "do you have this in 250g?" — variant indexing enables that.

## Entity: category

Classification: indexable
Source tables: public.product_category
Joined references: (none)

### Columns

- name: index
- handle: reference

### Evidence

Browse-by-category queries ("which manual brewers do you stock?").

## Entity: collection

Classification: indexable
Source tables: public.product_collection
Joined references: (none)

### Columns

- title: index
- description: index
- handle: reference

### Evidence

Curated collections are marketing surfaces ("what's in the gift-ready lineup?").

## Entity: region

Classification: indexable
Source tables: public.region
Joined references: (none)

### Columns

- name: index
- currency_code: reference
- tax_rate: reference

### Evidence

Shoppers ask "do you ship to my country?" and the agent needs the
region list to answer.

## Reference tables

- public.product_category_product (product ↔ category many-to-many)
- public.product_collection_product (product ↔ collection many-to-many)

## Infrastructure / ignored

- public.migration
- public.staged_job
- public.session

## PII-excluded

- public.customer: columns [email, phone, first_name, last_name] — direct PII, excluded from `client_ref` import entirely
- public.customer_address: columns [address_1, city, postal_code, phone] — location PII, excluded
- public.payment: columns [card_last_four, card_brand] — financial PII, excluded
- public.order: tier-2, **excluded from client_ref** because the demo surfaces "my orders" via the host API (widget-executed) rather than via retrieval
- public.order_line_item: tier-2, excluded (same rationale)

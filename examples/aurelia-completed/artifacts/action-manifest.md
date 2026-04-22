# Action manifest

## Summary

Four indexable entities expose read-only discovery tools; admin endpoints excluded.

## Tools: product

### list_products

Description: List products with optional filters.

Parameters:

```json
{ "type": "object", "properties": { "limit": { "type": "integer" } } }
```

requires_confirmation: false
Source: GET /store/products
Parameter sources: user message

### get_product

Description: Fetch a single product by id.

Parameters:

```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
```

requires_confirmation: false
Source: GET /store/products/{id}
Parameter sources: prior tool call

## Tools: collection

### list_collections

Description: List collections.

Parameters:

```json
{ "type": "object" }
```

requires_confirmation: false
Source: GET /store/collections
Parameter sources: user message

## Tools: region

### list_regions

Description: List regions.

Parameters:

```json
{ "type": "object" }
```

requires_confirmation: false
Source: GET /store/regions
Parameter sources: user message

## Tools: variant

### list_variants

Description: List variants for a product.

Parameters:

```json
{ "type": "object", "properties": { "product_id": { "type": "string" } } }
```

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

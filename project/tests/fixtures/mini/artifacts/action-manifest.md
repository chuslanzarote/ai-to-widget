# Action manifest

## Summary

Two read-only discovery tools over the single indexable entity.

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

## Excluded

(none)

## Runtime system prompt block

You are the mini tea-shop assistant. Help users discover products by name,
description, and style.

# Action manifest

## Provenance

- OpenAPI snapshot: sha256:1111111111111111111111111111111111111111111111111111111111111111
- Classifier model: claude-opus-4-7 (2026-04-23)
- Classified at: 2026-04-23T10:05:00Z

## Summary

Delta-merge preservation fixture. The `check_inventory` GET tool would
default to `requires_confirmation: true` (`is_action: true` default per
R7), but the Builder explicitly flipped it to `false` because the read
is idempotent and the shopper already saw the quantity in the
confirmation card upstream. That flip MUST survive a re-classify.

## Tools: inventory

### check_inventory

Description: Peek at live stock for a variant before the shopper adds it.
description_template: "Check stock for {variant_id}"
summary_fields: ["variant_id", "quantity_on_hand"]

Parameters:

```json
{
  "type": "object",
  "required": ["variant_id"],
  "properties": {
    "variant_id": { "type": "string" },
    "quantity_on_hand": { "type": "integer" }
  }
}
```

requires_confirmation: false
is_action: true
Source: GET /store/inventory/{variant_id}
Parameter sources: prior tool call

## Tools: order

### add_to_cart

Description: Add a specific product variant to the shopper's cart.
description_template: "Add {quantity} × {product_title} to cart"
summary_fields: ["product_title", "quantity"]

Parameters:

```json
{
  "type": "object",
  "required": ["cart_id", "variant_id", "quantity"],
  "properties": {
    "cart_id": { "type": "string" },
    "variant_id": { "type": "string" },
    "quantity": { "type": "integer", "minimum": 1, "maximum": 10 },
    "product_title": { "type": "string" }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{cart_id}/line-items
Parameter sources: prior tool call + session context

## Excluded

- DELETE /admin/orders/{id} — admin-prefix
- POST /store/search — non-cookie-security

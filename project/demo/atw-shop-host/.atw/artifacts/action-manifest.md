# Action manifest

## Provenance

- OpenAPI snapshot: sha256:e3454f47d39457732b3bb6d01bb4255d98393b35e08532dffddf388867f6932a
- Classifier model: claude-opus-4-7
- Classified at: 2026-04-24T06:02:00.394Z

## Summary

Classifier kept 2 action(s) of 10 operations. Builder re-added 6 shopper-owned ops
that Stage 1 rule 2 over-rejected (bearer-JWT security is the intended auth model
for Feature 007 — widget executes tools with the shopper's token). `placeOrder`
stays excluded per the brief's forbidden-actions list; `loginShopper` stays
excluded as an out-of-agent boundary.

## Tools: products

### get_product

Description: Get one product by its UUID.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "format": "uuid",
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /products/{id} (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

### list_products

Description: List all products, optionally filtered by q substring.

Parameters:

```json
{
  "type": "object",
  "required": [],
  "properties": {
    "q": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /products (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: cart

### get_cart

Description: Get the shopper's active cart (lazy-created).

Parameters:

```json
{
  "type": "object",
  "required": [],
  "properties": {}
}
```

requires_confirmation: false
is_action: false
Source: GET /cart (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

### add_cart_item

Description: Add a product to the cart (merge-by-product).

Parameters:

```json
{
  "type": "object",
  "required": [
    "product_id",
    "quantity"
  ],
  "properties": {
    "product_id": {
      "format": "uuid",
      "type": "string"
    },
    "quantity": {
      "minimum": 1,
      "type": "integer"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /cart/items (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

### update_cart_item

Description: Set the quantity of a cart line item. Quantity 0 removes the line.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id",
    "quantity"
  ],
  "properties": {
    "id": {
      "format": "uuid",
      "type": "string"
    },
    "quantity": {
      "minimum": 0,
      "type": "integer"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: PATCH /cart/items/{id} (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

### remove_cart_item

Description: Remove a line item from the cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "format": "uuid",
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: DELETE /cart/items/{id} (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: orders

### list_my_orders

Description: List the shopper's past orders, newest first.

Parameters:

```json
{
  "type": "object",
  "required": [],
  "properties": {}
}
```

requires_confirmation: false
is_action: false
Source: GET /orders (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: customers

### get_my_profile

Description: Return the authenticated shopper's profile.

Parameters:

```json
{
  "type": "object",
  "required": [],
  "properties": {}
}
```

requires_confirmation: false
is_action: false
Source: GET /customers/me (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

## Excluded

- POST /auth/login — opus-narrowed (out-of-agent boundary: authentication)
- POST /orders — brief-forbidden (agent must not place orders on behalf of the user)

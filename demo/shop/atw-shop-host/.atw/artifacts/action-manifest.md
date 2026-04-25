# Action manifest

## Provenance

- OpenAPI snapshot: sha256:e3454f47d39457732b3bb6d01bb4255d98393b35e08532dffddf388867f6932a
- Classifier model: claude-opus-4-7
- Classified at: 2026-04-25T06:06:33.366Z

## Summary

Classifier kept 8 action(s) of 10 operations.

## Tools: cart (runtime-only)

### add_cart_item

Description: Add a product to the cart (merge-by-product).

Parameters:

```json
{
  "type": "object",
  "required": [],
  "properties": {}
}
```

requires_confirmation: true
is_action: true
Source: POST /cart/items (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

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

### update_cart_item

Description: Set the quantity of a cart line item. Quantity 0 removes the line.

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
Source: PATCH /cart/items/{id} (bearerAuth)
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: customers (runtime-only)

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

## Tools: orders (runtime-only)

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
Source: GET /products/{id}
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
Source: GET /products
Parameter sources: tool arguments (OpenAPI-derived)

## Excluded

- POST /auth/login — opus-narrowed
- POST /orders — opus-narrowed

## Orphaned (operation removed from OpenAPI)

- GET /cart — previously: get_cart
- POST /cart/items — previously: add_cart_item
- DELETE /cart/items/{id} — previously: remove_cart_item
- PATCH /cart/items/{id} — previously: update_cart_item
- GET /customers/me — previously: get_my_profile
- GET /products — previously: list_products
- GET /products/{id} — previously: get_product

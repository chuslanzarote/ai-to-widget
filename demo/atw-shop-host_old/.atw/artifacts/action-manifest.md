# Action manifest

## Provenance

- OpenAPI snapshot: sha256:b2835c14071fc5a42acfbc593c421b3e2c79a4356d62833b3e0d7d7b30d0a3fa
- Classifier model: claude-opus-4-7
- Classified at: 2026-04-23T14:02:30.366Z

## Summary

Classifier kept 23 action(s) of 47 operations.

## Tools: carts

### add_line_item

Description: Add a line item to the cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "variant_id",
    "quantity",
    "id"
  ],
  "properties": {
    "quantity": {
      "minimum": 1,
      "type": "integer"
    },
    "variant_id": {
      "type": "string"
    },
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{id}/line-items
Parameter sources: tool arguments (OpenAPI-derived)

### delete_line_item

Description: Remove a line item from the cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id",
    "line_id"
  ],
  "properties": {
    "id": {
      "type": "string"
    },
    "line_id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: DELETE /store/carts/{id}/line-items/{line_id}
Parameter sources: tool arguments (OpenAPI-derived)

### get_cart

Description: Retrieve a cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/carts/{id}
Parameter sources: tool arguments (OpenAPI-derived)

### remove_discount_from_cart

Description: Remove a discount code from the cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id",
    "code"
  ],
  "properties": {
    "id": {
      "type": "string"
    },
    "code": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: DELETE /store/carts/{id}/discounts/{code}
Parameter sources: tool arguments (OpenAPI-derived)

### update_line_item

Description: Update a line item on the cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "quantity",
    "id",
    "line_id"
  ],
  "properties": {
    "quantity": {
      "minimum": 0,
      "type": "integer"
    },
    "id": {
      "type": "string"
    },
    "line_id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{id}/line-items/{line_id}
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: collections

### get_collection

Description: Retrieve a collection.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/collections/{id}
Parameter sources: tool arguments (OpenAPI-derived)

### get_collections

Description: List collections.

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
Source: GET /store/collections
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: customers

### add_my_address

Description: Add an address to the authenticated customer.

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
Source: POST /store/customers/me/addresses
Parameter sources: tool arguments (OpenAPI-derived)

### delete_my_address

Description: Delete one of the authenticated customer's addresses.

Parameters:

```json
{
  "type": "object",
  "required": [
    "address_id"
  ],
  "properties": {
    "address_id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: DELETE /store/customers/me/addresses/{address_id}
Parameter sources: tool arguments (OpenAPI-derived)

### get_me

Description: Retrieve the authenticated customer.

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
Source: GET /store/customers/me
Parameter sources: tool arguments (OpenAPI-derived)

### list_my_addresses

Description: List the authenticated customer's addresses.

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
Source: GET /store/customers/me/addresses
Parameter sources: tool arguments (OpenAPI-derived)

### list_my_orders

Description: List the authenticated customer's orders.

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
Source: GET /store/customers/me/orders
Parameter sources: tool arguments (OpenAPI-derived)

### update_my_address

Description: Update one of the authenticated customer's addresses.

Parameters:

```json
{
  "type": "object",
  "required": [
    "address_id"
  ],
  "properties": {
    "address_id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: PUT /store/customers/me/addresses/{address_id}
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: orders

### get_order

Description: Retrieve an order.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/orders/{id}
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: product-tags

### get_product_tags

Description: List product tags.

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
Source: GET /store/product-tags
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: product-types

### get_product_types

Description: List product types.

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
Source: GET /store/product-types
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: products

### get_product

Description: Retrieve a product.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/products/{id}
Parameter sources: tool arguments (OpenAPI-derived)

### get_products

Description: List products.

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
Source: GET /store/products
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: products-by-handle

### get_product_by_handle

Description: Retrieve a product by handle.

Parameters:

```json
{
  "type": "object",
  "required": [
    "handle"
  ],
  "properties": {
    "handle": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/products-by-handle/{handle}
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: regions

### get_region

Description: Retrieve a region.

Parameters:

```json
{
  "type": "object",
  "required": [
    "id"
  ],
  "properties": {
    "id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/regions/{id}
Parameter sources: tool arguments (OpenAPI-derived)

### get_regions

Description: List regions.

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
Source: GET /store/regions
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: reviews

### create_review

Description: Leave a product review.

Parameters:

```json
{
  "type": "object",
  "required": [
    "product_id",
    "rating"
  ],
  "properties": {
    "body": {
      "maxLength": 2000,
      "type": "string"
    },
    "product_id": {
      "type": "string"
    },
    "rating": {
      "maximum": 5,
      "minimum": 1,
      "type": "integer"
    }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/reviews
Parameter sources: tool arguments (OpenAPI-derived)

## Tools: shipping-options

### get_shipping_options_for_cart

Description: List shipping options for a cart.

Parameters:

```json
{
  "type": "object",
  "required": [
    "cart_id"
  ],
  "properties": {
    "cart_id": {
      "type": "string"
    }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/shipping-options/{cart_id}
Parameter sources: tool arguments (OpenAPI-derived)

## Excluded

- DELETE /admin/orders/{id} — admin-prefix
- POST /admin/products — admin-prefix
- GET /admin/users — admin-prefix
- POST /admin/users — admin-prefix
- DELETE /store/auth — destructive-unowned
- POST /store/auth — opus-narrowed
- POST /store/carts — opus-narrowed
- POST /store/carts/{id} — opus-narrowed
- POST /store/carts/{id}/complete — missing-request-schema
- POST /store/carts/{id}/customer — missing-request-schema
- POST /store/carts/{id}/discounts/{code} — missing-request-schema
- POST /store/carts/{id}/payment-session — opus-narrowed
- POST /store/carts/{id}/payment-sessions — missing-request-schema
- DELETE /store/carts/{id}/payment-sessions/{provider_id} — opus-narrowed
- POST /store/carts/{id}/shipping-methods — opus-narrowed
- POST /store/carts/{id}/taxes — missing-request-schema
- POST /store/customers — opus-narrowed
- POST /store/customers/me — opus-narrowed
- POST /store/customers/password-reset — opus-narrowed
- POST /store/customers/password-token — opus-narrowed
- GET /store/gift-cards/{code} — opus-narrowed
- POST /store/orders/customer/confirm — opus-narrowed
- POST /store/returns — opus-narrowed
- POST /store/search — non-cookie-security

## Orphaned (operation removed from OpenAPI)

- GET /store/carts/{id} — previously: get_cart
- DELETE /store/carts/{id}/discounts/{code} — previously: remove_discount_from_cart
- POST /store/carts/{id}/line-items — previously: add_line_item
- DELETE /store/carts/{id}/line-items/{line_id} — previously: delete_line_item
- POST /store/carts/{id}/line-items/{line_id} — previously: update_line_item
- GET /store/collections — previously: get_collections
- GET /store/collections/{id} — previously: get_collection
- GET /store/customers/me — previously: get_me
- GET /store/customers/me/addresses — previously: list_my_addresses
- POST /store/customers/me/addresses — previously: add_my_address
- DELETE /store/customers/me/addresses/{address_id} — previously: delete_my_address
- PUT /store/customers/me/addresses/{address_id} — previously: update_my_address
- GET /store/customers/me/orders — previously: list_my_orders
- GET /store/orders/{id} — previously: get_order
- GET /store/product-tags — previously: get_product_tags
- GET /store/product-types — previously: get_product_types
- GET /store/products — previously: get_products
- GET /store/products-by-handle/{handle} — previously: get_product_by_handle
- GET /store/products/{id} — previously: get_product
- GET /store/regions — previously: get_regions
- GET /store/regions/{id} — previously: get_region
- POST /store/reviews — previously: create_review
- GET /store/shipping-options/{cart_id} — previously: get_shipping_options_for_cart

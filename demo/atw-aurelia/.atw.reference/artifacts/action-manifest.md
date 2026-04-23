# Action manifest

## Summary

Read-only discovery tools over products, categories, collections, and
regions. Cart actions (`add_to_cart`, `remove_from_cart`) are exposed
behind user confirmation cards. "My orders" is an action-tool that
runs with the shopper's credentials (US-003.5), never with server-side
credentials.

## Tools: product

### list_products

Description: List products with optional filters (category handle,
collection handle, text search).

Parameters:

```json
{
  "type": "object",
  "properties": {
    "limit": { "type": "integer", "default": 12 },
    "category_handle": { "type": "string" },
    "collection_handle": { "type": "string" },
    "q": { "type": "string" }
  }
}
```

requires_confirmation: false
is_action: false
Source: GET /store/products
Parameter sources: user message

### get_product

Description: Fetch a single product by id.

Parameters:

```json
{ "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
```

requires_confirmation: false
is_action: false
Source: GET /store/products/{id}
Parameter sources: prior tool call

## Tools: categories / collections

### list_categories

Description: List product categories (hierarchical).
is_action: false
Source: GET /store/product-categories

### list_collections

Description: List product collections.
is_action: false
Source: GET /store/collections

### list_regions

Description: List active regions and their currency / tax rate.
is_action: false
Source: GET /store/regions

## Tools: cart (actions — require user confirmation)

### add_to_cart

Description: Add a specific product variant to the shopper's cart.
description_template: "Add {quantity} × {product_title} to cart"
summary_fields: ["product_title", "quantity", "price_preview"]

Parameters:

```json
{
  "type": "object",
  "required": ["cart_id", "variant_id", "quantity"],
  "properties": {
    "cart_id": { "type": "string" },
    "variant_id": { "type": "string" },
    "quantity": { "type": "integer", "minimum": 1, "maximum": 10 },
    "product_title": { "type": "string" },
    "price_preview": { "type": "string" }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{cart_id}/line-items
Parameter sources: prior tool call + session context

### remove_from_cart

Description: Remove a line item from the shopper's cart.
description_template: "Remove {product_title} from cart"

Parameters:

```json
{
  "type": "object",
  "required": ["cart_id", "line_item_id"],
  "properties": {
    "cart_id": { "type": "string" },
    "line_item_id": { "type": "string" },
    "product_title": { "type": "string" }
  }
}
```

requires_confirmation: true
is_action: true
Source: DELETE /store/carts/{cart_id}/line-items/{line_item_id}
Parameter sources: prior tool call

### update_cart_line_item

Description: Change the quantity of a cart line item.
description_template: "Change {product_title} quantity to {quantity}"

Parameters:

```json
{
  "type": "object",
  "required": ["cart_id", "line_item_id", "quantity"],
  "properties": {
    "cart_id": { "type": "string" },
    "line_item_id": { "type": "string" },
    "quantity": { "type": "integer", "minimum": 0, "maximum": 20 },
    "product_title": { "type": "string" }
  }
}
```

requires_confirmation: true
is_action: true
Source: POST /store/carts/{cart_id}/line-items/{line_item_id}
Parameter sources: prior tool call

## Tools: personalised (shopper-auth actions)

These tools require the shopper's own session. They are classified as
`action` tools so the runtime backend does **not** execute them
server-side. The widget runs them with the shopper's credentials and
posts the result back via an `ActionFollowUp` signal so the agent can
narrate the outcome.

### list_my_orders

Description: Fetch the logged-in shopper's order history.
description_template: "Look up your order history"

Parameters:

```json
{
  "type": "object",
  "properties": {
    "limit": { "type": "integer", "default": 10, "minimum": 1, "maximum": 50 }
  }
}
```

requires_confirmation: true
is_action: true
Source: GET /store/customers/me/orders
Parameter sources: user message

### get_my_cart

Description: Fetch the current contents of the shopper's cart.
description_template: "Look up your current cart"

Parameters:

```json
{ "type": "object", "properties": {} }
```

requires_confirmation: true
is_action: true
Source: GET /store/carts/{cart_id}
Parameter sources: session context

## Excluded

- POST /admin/* — admin-only, excluded
- DELETE /admin/* — admin + destructive, excluded
- POST /store/customers — account creation not driven by the agent
- DELETE /store/customers/me — destructive account deletion
- POST /store/returns — customer-service scope, not the agent's job

## Runtime system prompt block

You are the Aurelia brew guide. Help shoppers discover coffees and
brewing gear in our catalog, compare options, and add items to their
cart with their confirmation. Reply in the shopper's language (Spanish
by default, English if they write in English). Never invent products,
prices, or tasting notes. If the retrieval context does not cover the
question, say so politely and suggest what you *can* help with.

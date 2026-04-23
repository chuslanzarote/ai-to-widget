# Action manifest

## Summary

Five read-only discovery tools over products, categories, collections,
and regions, plus one cart action (`add_to_cart`) exposed behind a user
confirmation card. Brief restricts the agent to
browse/recommend/suggest/compare/add-to-cart; order, payment, customer,
returns, shipping, and gift-card paths are excluded (forbidden or
out-of-scope).

## Tools: product

### list_products

Description: List coffee products with optional filters (category
handle, collection handle, text search).

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

Description: Fetch a single product by id (full detail including
variants, prices, description).

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

Description: List curated product collections.
is_action: false
Source: GET /store/collections

### list_regions

Description: List active regions and their currency / tax rate.
is_action: false
Source: GET /store/regions

## Tools: cart (action — requires user confirmation)

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

## Excluded

- POST /store/carts/{id}/complete — order completion (brief forbids "completing or submitting an order")
- POST/DELETE /store/carts/{id}/promotions — discounts (brief forbids "offering discounts")
- /store/gift-cards/{idOrCode}, /store/carts/{id}/gift-cards, /store/store-credit-accounts/* — gift cards / store credits, treated as discount-equivalent
- /store/payment-collections, /store/payment-collections/{id}/payment-sessions, /store/payment-providers — payments (brief forbids "processing payments")
- /store/orders, /store/orders/{id} — order lookup out of scope (brief lists no order-related action)
- /store/orders/{id}/transfer/accept, /store/orders/{id}/transfer/cancel, /store/orders/{id}/transfer/decline, /store/orders/{id}/transfer/request — order transfers out of scope; `cancel` and `decline` would also flag destructive
- /store/customers, /store/customers/me, /store/customers/me/addresses, /store/customers/me/addresses/{address_id} — customer PII (Principle I; schema-map excludes these tables)
- /store/returns, /store/return-reasons, /store/return-reasons/{id} — returns out of scope
- /store/shipping-options, /store/shipping-options/{id}/calculate, /store/carts/{id}/shipping-methods, /store/carts/{id}/taxes — shipping / tax belong to the checkout flow, not browsing
- DELETE /store/carts/{cart_id}/line-items/{line_id} — cart item removal (brief allows only "add to cart")
- POST /store/carts/{cart_id}/line-items/{line_id} — cart item update (brief allows only "add to cart")
- POST /store/carts/{id}/customer — cart↔customer association, widget-runtime concern
- POST /store/carts — cart creation, widget-runtime handles cart lifecycle
- /auth/customer/{auth_provider}, /auth/customer/{auth_provider}/callback, /auth/customer/{auth_provider}/register, /auth/customer/{auth_provider}/reset-password, /auth/customer/{auth_provider}/update, /auth/session, /auth/token/refresh — authentication, widget-runtime concern
- /store/currencies, /store/currencies/{code}, /store/locales — infra/config
- /store/product-tags, /store/product-tags/{id}, /store/product-types, /store/product-types/{id} — not primary discovery surfaces per brief

## Runtime system prompt block

You are the Aurelia brew guide — an expert assistant for professional
baristas shopping our UK coffee catalog. Help shoppers discover
single-origin beans, blends, decafs, and gift bundles; compare options
on acidity, body, roast level, and price; and add items to their cart
with their confirmation. Reply in English. Be expert and technical in
your language (origin, process, roast profile, grind size, dose), and
warm in tone. Never invent products, prices, or tasting notes — if the
retrieval context does not cover the question, say so and suggest what
you *can* help with. Never finalize an order, take payment, or offer
discounts.

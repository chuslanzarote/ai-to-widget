# Schema map

## Summary

Five indexable entity types from the Medusa v2 schema: `product`,
`product_variant`, `product_category`, `product_collection`, `region`.
Customer, payment, and order tables are excluded — the brief restricts
the agent to browse/compare/recommend/add-to-cart, so PII tables and
order flows are out of scope (Principle I).

## Entity: product

Classification: indexable
Source tables: public.product
Joined references: public.product_variant, public.product_category_product, public.product_tags

### Columns

- title: index
- description: index
- handle: reference
- origin_country: index
- material: index
- collection_id: reference
- status: exclude-internal
- created_at: exclude-internal
- updated_at: exclude-internal

### Evidence

Primary catalog surface. Brief's lead use case — "single-origin
espresso roast under £40/kg" — is a product-discovery query.
`origin_country` and `material` are directly relevant to coffee
(single-origin provenance, bean/roast attributes).

## Entity: product_variant

Classification: indexable
Source tables: public.product_variant
Joined references: public.product

### Columns

- title: index
- sku: reference
- material: index
- weight: reference

### Evidence

Brief vocabulary includes "kg bag vs. retail bag" and the lead use
case compares prices under £40/kg — variant-level SKUs carry the
size/weight/pricing needed to resolve that query.

## Entity: product_category

Classification: indexable
Source tables: public.product_category
Joined references: (none)

### Columns

- name: index
- handle: reference

### Evidence

Brief use cases "decaf for a café menu" and "blend for milk-based
drinks" are category-shaped queries.

## Entity: product_collection

Classification: indexable
Source tables: public.product_collection
Joined references: (none; joined via product.collection_id FK)

### Columns

- title: index
- description: index
- handle: reference

### Evidence

Brief use case "gift bundle" maps to a curated collection.

## Entity: region

Classification: indexable
Source tables: public.region
Joined references: (none)

### Columns

- name: index
- currency_code: reference

### Evidence

Brief scopes customers to the UK; region controls currency (GBP) and
price visibility for the catalog.

## Reference tables

- public.product_category_product (product ↔ category many-to-many)
- public.product_tags (product ↔ product_tag many-to-many)

Note: `product_collection` is joined via `product.collection_id` FK
directly, not through a join table.

## Infrastructure / ignored

- Migrations: public.mikro_orm_migrations, public.script_migrations, public.link_module_migrations
- Notifications / workflows: public.notification, public.notification_provider, public.workflow_execution, public.view_configuration
- Store / currency config: public.store, public.store_currency, public.store_locale, public.currency
- Tax: public.tax_provider, public.tax_rate, public.tax_rate_rule, public.tax_region
- Shipping / fulfillment config: public.shipping_option, public.shipping_option_price_set, public.shipping_option_rule, public.shipping_option_type, public.shipping_profile, public.product_shipping_profile
- Stock / inventory: public.stock_location, public.stock_location_address, public.inventory_item, public.inventory_level, public.reservation_item
- Sales channels: public.sales_channel, public.sales_channel_stock_location, public.product_sales_channel, public.publishable_api_key_sales_channel
- Service / geo zones: public.service_zone, public.geo_zone, public.region_country, public.region_payment_provider
- Promotions / pricing: public.promotion, public.promotion_application_method, public.promotion_campaign, public.promotion_campaign_budget, public.promotion_campaign_budget_usage, public.promotion_promotion_rule, public.promotion_rule, public.promotion_rule_value, public.application_method_buy_rules, public.application_method_target_rules, public.price, public.price_list, public.price_list_rule, public.price_preference, public.price_rule, public.price_set
- Product options / tags: public.product_option, public.product_option_value, public.product_tag, public.product_type, public.product_variant_inventory_item, public.product_variant_option, public.product_variant_price_set, public.product_variant_product_image, public.image
- Refunds / reasons: public.refund_reason, public.return_reason
- Misc: public.credit_line

## PII-excluded

- public.customer: columns [email, phone, first_name, last_name] — direct PII, excluded from `client_ref` import entirely
- public.customer_address: columns [address_1, city, postal_code, phone] — location PII, excluded
- public.customer_group, public.customer_group_customer: grouping tied to customer — excluded
- public.customer_account_holder, public.account_holder: customer↔account linkage — excluded
- public.payment, public.payment_collection, public.payment_collection_payment_providers, public.payment_session, public.payment_provider: financial PII / payment state — excluded
- public.capture, public.refund: payment event data — excluded
- public."order", public.order_address, public.order_cart, public.order_change, public.order_change_action, public.order_claim, public.order_claim_item, public.order_claim_item_image, public.order_credit_line, public.order_exchange, public.order_exchange_item, public.order_fulfillment, public.order_item, public.order_line_item, public.order_line_item_adjustment, public.order_line_item_tax_line, public.order_payment_collection, public.order_promotion, public.order_shipping, public.order_shipping_method, public.order_shipping_method_adjustment, public.order_shipping_method_tax_line, public.order_summary, public.order_transaction: out of scope — brief forbids agent from completing orders, so order data is not a retrieval surface
- public.return, public.return_fulfillment, public.return_item: post-purchase flow, out of scope
- public.fulfillment, public.fulfillment_address, public.fulfillment_item, public.fulfillment_label, public.fulfillment_provider, public.fulfillment_set, public.location_fulfillment_provider, public.location_fulfillment_set: fulfillment operations, out of scope
- public.cart, public.cart_address, public.cart_line_item, public.cart_line_item_adjustment, public.cart_line_item_tax_line, public.cart_payment_collection, public.cart_promotion, public.cart_shipping_method, public.cart_shipping_method_adjustment, public.cart_shipping_method_tax_line: cart is session state mutated via API (add-to-cart action), not retrieved via RAG — excluded from indexing
- public."user", public.user_preference, public.user_rbac_role, public.auth_identity, public.provider_identity, public.invite, public.invite_rbac_role, public.api_key: operator/auth data, not customer-facing — excluded

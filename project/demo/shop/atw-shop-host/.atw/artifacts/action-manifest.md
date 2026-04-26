---
schema_version: '1.0'
generated_at: '2026-04-25T16:15:34.725Z'
model_snapshot: claude-opus-4-7
input_hashes:
  openapi_sha256: 32db9f0eccad0ca54107e1f007b80763bbfe110127e793a4fc25a6e3e7b3b735
  project_md_sha256: 018169d66b9586dab0aeac8acbd4526c9e64c47820fde506bfe542b770d67998
operation_count_total: 10
operation_count_in_scope: 7
source_openapi_path: .atw/inputs/openapi.json
operations:
  - tool_name: list_products
    description: >-
      List catalog products, optionally filtered by a substring query (e.g.
      origin, varietal, process, roast, brew method, or sensory descriptor). Use
      this to search the coffee catalog and to power recommendations and
      comparisons.
    summary_template: 'Searching catalog for "{q}"'
    requires_confirmation: false
    http:
      method: GET
      path_template: /products
    input_schema:
      type: object
      properties:
        q:
          type: string
          description: Optional substring filter applied to product fields.
      required: []
    citation:
      operation_id: listProducts
      schema_ref: '#/components/schemas/def-5'
    rationale_excerpt: 'Brief allows: search and understand catalog products; recommend; compare.'
  - tool_name: get_product
    description: >-
      Get full details for a single product by UUID. Use this to look up any
      information about a specific coffee (origin, description, price, stock)
      and to ground comparisons or recommendations.
    summary_template: 'Looking up product {id}'
    requires_confirmation: false
    http:
      method: GET
      path_template: '/products/{id}'
    input_schema:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Product UUID.
      required:
        - id
    citation:
      operation_id: getProduct
      schema_ref: '#/components/schemas/def-4'
    rationale_excerpt: 'Brief allows: look up any information about a product.'
  - tool_name: get_cart
    description: >-
      Get the authenticated shopper's active cart, including line items and
      total. Use to inspect what's currently in the cart before adding,
      updating, or summarizing.
    summary_template: Loading your cart
    requires_confirmation: false
    http:
      method: GET
      path_template: /cart
    input_schema:
      type: object
      properties: {}
      required: []
    citation:
      operation_id: getCart
      schema_ref: '#/components/schemas/def-8'
    rationale_excerpt: >-
      Supports the allowed action of adding products to cart by inspecting
      state.
  - tool_name: add_cart_item
    description: >-
      Add a product to the shopper's cart by product UUID and quantity.
      Quantities of the same product are merged into a single line.
    summary_template: 'Adding {quantity} × product {product_id} to cart'
    requires_confirmation: true
    http:
      method: POST
      path_template: /cart/items
    input_schema:
      type: object
      properties:
        product_id:
          type: string
          format: uuid
          description: UUID of the product to add.
        quantity:
          type: integer
          minimum: 1
          description: Number of units to add.
      required:
        - product_id
        - quantity
    citation:
      operation_id: addCartItem
      schema_ref: '#/components/schemas/def-9'
    rationale_excerpt: 'Brief allows: add products to the cart, confirmed via ActionCard.'
  - tool_name: update_cart_item
    description: >-
      Set the quantity of an existing cart line item. Setting quantity to 0
      removes the line.
    summary_template: 'Updating cart line {id} to quantity {quantity}'
    requires_confirmation: true
    http:
      method: PATCH
      path_template: '/cart/items/{id}'
    input_schema:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Cart line item UUID.
        quantity:
          type: integer
          minimum: 0
          description: New quantity for the line. 0 removes the line.
      required:
        - id
        - quantity
    citation:
      operation_id: updateCartItem
      schema_ref: '#/components/schemas/def-10'
    rationale_excerpt: Cart management is in scope; supports adjusting an add-to-cart action.
  - tool_name: remove_cart_item
    description: Remove a line item from the shopper's cart by line UUID.
    summary_template: 'Removing cart line {id}'
    requires_confirmation: true
    http:
      method: DELETE
      path_template: '/cart/items/{id}'
    input_schema:
      type: object
      properties:
        id:
          type: string
          format: uuid
          description: Cart line item UUID to remove.
      required:
        - id
    citation:
      operation_id: removeCartItem
      schema_ref: '#/components/schemas/def-11'
    rationale_excerpt: Cart management is in scope; complements add-to-cart.
  - tool_name: list_my_orders
    description: >-
      List the authenticated shopper's past orders, newest first, with line
      items. Read-only — use to answer questions about prior purchases and to
      ground recommendations on order history.
    summary_template: Loading your past orders
    requires_confirmation: false
    http:
      method: GET
      path_template: /orders
    input_schema:
      type: object
      properties: {}
      required: []
    citation:
      operation_id: listMyOrders
      schema_ref: '#/components/schemas/def-15'
    rationale_excerpt: 'Brief allows: look up data from the shopper''s own past orders (read-only).'
---


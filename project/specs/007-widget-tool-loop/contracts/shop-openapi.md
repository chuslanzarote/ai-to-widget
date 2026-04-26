# Contract: `demo/shop` OpenAPI surface

**Feature**: 007-widget-tool-loop
**Status**: Required shape for the shop's auto-generated OpenAPI document.
**Consumer**: `/atw.setup` + `/atw.build` pipeline (Feature 006 manifest builder).

## Where it lives

The shop's Fastify instance serves the document at `GET /openapi.json` on the shop backend's port. The SPA is not a consumer; the consumer is `/atw.setup` (invoked by the Builder Owner) which reads and snapshots the document into `.atw/openapi.yaml` for the manifest builder.

## Required document-level properties

- **`openapi`**: `"3.1.0"` or `"3.0.x"` (Fastify's emitter produces `3.0.x` with the default config).
- **`info.title`**: `"ATW Reference Shop"`.
- **`info.version`**: semver string, bumped deliberately when the surface changes. v1 ships `"1.0.0"`.
- **`servers`**: one entry — `{"url": "http://localhost:<port>"}`. The Builder Owner's `/atw.setup` run may override.
- **`components.securitySchemes.bearerAuth`**: `{"type": "http", "scheme": "bearer", "bearerFormat": "JWT"}`. Every authenticated operation MUST reference this scheme under `security: [{"bearerAuth": []}]`.
- **`tags`**: `[{"name": "auth"}, {"name": "products"}, {"name": "cart"}, {"name": "orders"}, {"name": "customers"}]` — tags group operations in the generated action manifest.

## Required operations

Every operation below MUST be declared with `operationId`, a summary, a request schema (where applicable), a 2xx response schema, and a 4xx error response schema. The `operationId` values are the canonical tool names Opus sees; they MUST remain stable across builds (Principle VIII — Reproducibility).

### auth

- **`POST /auth/login`** — `operationId: loginShopper`
  - Unauthenticated (no `security` reference).
  - Request: `{email: string, password: string}`.
  - 200: `{token: string, user: {id, email, display_name}}`.
  - 401: `{error: string}` on bad credentials.

### products

- **`GET /products`** — `operationId: listProducts`
  - Unauthenticated.
  - Query params: `q?: string` (optional case-insensitive substring filter matching `name` or `description`, FR-003).
  - 200: `{products: Product[]}`.
  - Populates both the SPA's listing (empty `q`) and search (populated `q`). Appears as one tool in the action catalog (Clarification Q5).

- **`GET /products/{id}`** — `operationId: getProduct`
  - Unauthenticated.
  - Path: `id: uuid`.
  - 200: `Product`.
  - 404: `{error: string}`.

### cart

All cart routes require `bearerAuth`.

- **`GET /cart`** — `operationId: getCart`
  - 200: `{id: uuid, items: CartItem[], total_cents: integer}`.
  - Lazily creates the cart on first call.

- **`POST /cart/items`** — `operationId: addCartItem`
  - Request: `{product_id: uuid, quantity: integer (>=1)}`.
  - 201: the updated `Cart` shape as in `GET /cart`.
  - 404: `{error: string}` if product not found.

- **`PATCH /cart/items/{id}`** — `operationId: updateCartItem`
  - Path: `id: uuid` (the `cart_items.id`).
  - Request: `{quantity: integer (>=0)}` — `0` deletes the item.
  - 200: updated `Cart`.
  - 404: `{error: string}` if line item not in caller's cart.

- **`DELETE /cart/items/{id}`** — `operationId: removeCartItem`
  - Path: `id: uuid`.
  - 200: updated `Cart`.
  - 404: `{error: string}` if line item not in caller's cart.

### orders

Both routes require `bearerAuth`.

- **`POST /orders`** — `operationId: placeOrder`
  - Request: `{}` (no body in v1 — order is placed from the caller's current cart).
  - 201: the created `Order` shape (including `OrderItem[]`).
  - 409: `{error: string}` if cart is empty.

- **`GET /orders`** — `operationId: listMyOrders`
  - 200: `{orders: Order[]}` — the caller's past orders in `created_at DESC` order.

### customers

- **`GET /customers/me`** — `operationId: getMyProfile`
  - Requires `bearerAuth`.
  - 200: `{id, email, display_name}`.

## Schemas

All entity schemas exposed to `/atw.build` MUST reference the shape declared in [data-model.md](../data-model.md):

- `Product`: `{id, handle, name, description, price_cents, image_url, in_stock, created_at}`.
- `CartItem`: `{id, product_id, product_name, quantity, unit_price_cents}` (the backend joins and denormalises `product_name` + `unit_price_cents` from `products` for cart reads, so the consumer does not need a second round-trip).
- `Cart`: `{id, items: CartItem[], total_cents}`.
- `Order`: `{id, user_id, total_cents, status, created_at, items: OrderItem[]}`.
- `OrderItem`: `{id, product_id, product_name, quantity, unit_price_cents}`.

## Confirmation-required classification

The `/atw.setup` flow (Feature 006) classifies each operation as `confirmation_required: true | false`. For this shop the expected classification is:

| Operation            | `confirmation_required` |
|----------------------|-------------------------|
| `loginShopper`       | N/A (widget doesn't invoke) |
| `listProducts`       | `false`                 |
| `getProduct`         | `false`                 |
| `getCart`            | `false`                 |
| `addCartItem`        | `true`                  |
| `updateCartItem`     | `true`                  |
| `removeCartItem`     | `true`                  |
| `placeOrder`         | `true`                  |
| `listMyOrders`       | `false`                 |
| `getMyProfile`       | `false`                 |

`loginShopper` is excluded from the widget's action catalog — authentication is SPA-only (spec Assumptions).

## Stability guarantee

The shop's OpenAPI document is the upstream contract for `/atw.build`. The `operationId` set above is frozen for v1; adding operations is an additive change (non-breaking). Changing any existing `operationId`, removing a declared operation, or changing a declared security requirement constitutes a breaking change that invalidates the cached manifest and forces `/atw.build` to re-emit everything.

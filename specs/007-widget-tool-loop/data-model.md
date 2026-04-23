# Phase 1 Data Model: `demo/shop` reference ecommerce

**Feature**: 007-widget-tool-loop
**Date**: 2026-04-23

## Scope

This document specifies the persistent data model for `demo/shop` only. The Feature 007 runtime changes in `packages/backend` do not introduce any new persistent data — conversation state lives in the widget between posts (FR-018), and no new `atw_postgres` tables are added.

The model is deliberately minimal. Seven tables (or equivalents) cover login, catalogue, cart, and orders. No variants, no inventory ledger, no pricing tiers, no addresses, no payments — those are out of scope for v1 (spec Clarification Q1 and the spec's out-of-scope list).

## Entities

### `User`

Represents a seeded shopper who can log in.

| Field           | Type        | Constraints                       | Notes                                     |
|-----------------|-------------|-----------------------------------|-------------------------------------------|
| `id`            | `uuid`      | PK                                | Deterministic UUID v5 from seed key (reproducibility). |
| `email`         | `text`      | UNIQUE, NOT NULL                  | Login identifier. Lowercased on insert.   |
| `password_hash` | `text`      | NOT NULL                          | bcrypt hash; salt round 10.               |
| `display_name`  | `text`      | NOT NULL                          | Rendered in the SPA header.               |
| `created_at`    | `timestamptz` | NOT NULL, default `now()`       | Seed pins a deterministic timestamp.      |

**Seed**: 2–3 rows (exact count is a planner tuning knob). Credentials documented in `demo/shop/README.md`.

**No registration.** No public endpoint creates rows (FR-003, Clarification Q2). The `users` table is seed-only.

### `Product`

Represents one SKU in the catalogue. Flat model — no variants (Clarification Q1).

| Field          | Type       | Constraints             | Notes                                       |
|----------------|------------|-------------------------|---------------------------------------------|
| `id`           | `uuid`     | PK                      | Deterministic UUID v5 from seed key.        |
| `handle`       | `text`     | UNIQUE, NOT NULL        | URL-safe slug, e.g. `midnight-roast-1kg-whole`. |
| `name`         | `text`     | NOT NULL                | Human-readable product name.                |
| `description`  | `text`     | NOT NULL                | Free-text; consumed by search `q` filter (case-insensitive substring, FR-003). |
| `price_cents`  | `integer`  | NOT NULL, CHECK ≥ 0     | Price in euro cents. No separate currency column (EUR only for v1). |
| `image_url`    | `text`     | NOT NULL                | Relative path within the SPA's public dir (seeded images checked in). |
| `in_stock`     | `boolean`  | NOT NULL, default true  | Boolean for v1 (no quantity tracking).      |
| `created_at`   | `timestamptz` | NOT NULL, default `now()` | Seed pins deterministic timestamp.       |

**Seed**: ~20 rows, coffee-shop catalogue handwritten. Includes enough variety for search/filter scenarios ("Midnight Roast 1 kg whole bean", "Midnight Roast 1 kg ground", "Ethiopian Yirgacheffe 500 g", …). Images seeded as static assets under `demo/shop/frontend/public/products/`.

### `Cart`

A shopper's active cart. One active cart per user.

| Field       | Type          | Constraints                                | Notes                                        |
|-------------|---------------|--------------------------------------------|----------------------------------------------|
| `id`        | `uuid`        | PK                                         | Generated on first cart access.              |
| `user_id`   | `uuid`        | FK → `users.id`, NOT NULL, UNIQUE         | One active cart per user (simplification for v1). |
| `created_at`| `timestamptz` | NOT NULL, default `now()`                  |                                              |
| `updated_at`| `timestamptz` | NOT NULL, default `now()`, auto-touch      | Driven by server on every item mutation.     |

**Lifecycle**:
- Created lazily on first cart-read or first item-add (server-side upsert keyed on `user_id`).
- Cleared on order placement (a new empty cart replaces it; `cart_items` rows deleted in the same transaction).
- No archiving: history is captured by `orders` + `order_items`.

### `CartItem`

A line item inside a shopper's cart.

| Field        | Type      | Constraints                            | Notes                                    |
|--------------|-----------|----------------------------------------|------------------------------------------|
| `id`         | `uuid`    | PK                                     |                                          |
| `cart_id`    | `uuid`    | FK → `carts.id` ON DELETE CASCADE, NOT NULL | |
| `product_id` | `uuid`    | FK → `products.id`, NOT NULL           |                                          |
| `quantity`   | `integer` | NOT NULL, CHECK > 0                    |                                          |
|              |           | UNIQUE (`cart_id`, `product_id`)       | One row per product per cart; add merges. |

**Mutation semantics** (route contracts in `contracts/shop-openapi.md`):
- `POST /cart/items` with `{product_id, quantity}`: upsert-and-merge. If the (cart, product) row exists, increment `quantity`; else insert.
- `PATCH /cart/items/:id` with `{quantity}`: set absolute quantity. `quantity=0` deletes the row.
- `DELETE /cart/items/:id`: delete the row.

### `Order`

A placed order. Immutable after creation.

| Field         | Type          | Constraints                               | Notes                                       |
|---------------|---------------|-------------------------------------------|---------------------------------------------|
| `id`          | `uuid`        | PK                                        |                                             |
| `user_id`     | `uuid`        | FK → `users.id`, NOT NULL                 |                                             |
| `total_cents` | `integer`     | NOT NULL, CHECK ≥ 0                       | Snapshotted from cart at placement time.    |
| `status`      | `text`        | NOT NULL, CHECK IN ('placed', 'shipped', 'delivered') | v1 only ever emits 'placed'. The other states exist in the schema so the status field is semantically meaningful in the API without requiring extension. |
| `created_at`  | `timestamptz` | NOT NULL, default `now()`                 |                                             |

### `OrderItem`

Snapshot of a cart item at order-placement time. Immutable.

| Field          | Type      | Constraints                         | Notes                                                     |
|----------------|-----------|-------------------------------------|-----------------------------------------------------------|
| `id`           | `uuid`    | PK                                  |                                                           |
| `order_id`     | `uuid`    | FK → `orders.id` ON DELETE CASCADE, NOT NULL | |
| `product_id`   | `uuid`    | FK → `products.id`, NOT NULL        | Kept for cross-reference; fields below are the snapshot.  |
| `product_name` | `text`    | NOT NULL                            | Snapshotted from `products.name` at placement.            |
| `unit_price_cents` | `integer` | NOT NULL, CHECK ≥ 0              | Snapshotted from `products.price_cents` at placement.     |
| `quantity`     | `integer` | NOT NULL, CHECK > 0                 | Snapshotted from `cart_items.quantity`.                   |

**Why snapshot fields.** Per FR-014 and Principle V, when Opus composes "your order #123 contained 2× Midnight Roast 1kg at €24 each", that statement must remain true even if the catalogue's product name or price later changes. Snapshotting the fields at placement time makes past-orders queries self-contained and anchored.

## Relationships

```text
User 1 ─── 0..1 Cart 1 ─── * CartItem * ─── 1 Product
  │
  └── 1 ─── * Order 1 ─── * OrderItem * ─── 1 Product
```

- Each user has at most one active cart.
- Each cart has zero or more line items; each line item references exactly one product.
- Each user has zero or more orders; each order has one or more order items (enforced at placement time: an empty cart cannot place an order).
- Order items reference the product by FK *and* carry a snapshot of the product's name and price at placement time.

## Validation rules

- `email` is normalized to lowercase at the DB boundary.
- `quantity` on both `cart_items` and `order_items` is a positive integer.
- Placing an order requires a non-empty cart and succeeds atomically: rows are moved from `cart_items` into `order_items` (with snapshot fields populated), an `orders` row is inserted with the summed `total_cents`, and the `cart_items` rows for the user's cart are deleted — all in one transaction.
- The `status` CHECK constraint prevents arbitrary status strings while still surfacing the field meaningfully in the API.

## State transitions

**`Cart`** has no state field. Lifecycle is simply "exists" → "cleared" (cart_items deleted after order placement).

**`Order`** transitions v1 supports:

```text
  (insert) ──> placed
```

`shipped` and `delivered` are declared in the CHECK constraint to leave room for a demo-day narrative extension, but no route exists in v1 to trigger them; seeded orders are always `placed`.

## Indexes

- `users (email)` — unique, for login lookup.
- `products (handle)` — unique, for slug-based URLs in the SPA.
- `products (name)` + `products (description)` — GIN trigram or plain `ILIKE` scan (a flat-catalogue of ~20 rows does not need either, but a straightforward GIN trigram index is cheap to declare and matches FR-003's case-insensitive substring requirement at any future scale).
- `cart_items (cart_id)` — non-unique, for cart fetches.
- `orders (user_id, created_at DESC)` — compound, for past-orders listing.

## Out of scope for v1

- **Product variants.** Flat catalogue per Clarification Q1.
- **Inventory tracking.** `in_stock` boolean only.
- **Pricing variants / discounts / coupons.**
- **Addresses & payments.** The order-placement route accepts no address or payment fields; v1 order placement is "move the cart to an order row".
- **Order status progression.** The schema supports it; the API and UI do not.
- **Reviews, wishlist, recommendations.**
- **Registration.** Seed-only (Clarification Q2).

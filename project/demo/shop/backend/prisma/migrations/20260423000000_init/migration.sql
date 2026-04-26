-- ATW Reference Shop — initial migration
-- Generated from prisma/schema.prisma on 2026-04-23 (feature 007).
--
-- Note: this migration is checked in rather than auto-generated via
-- `prisma migrate dev` so that container first-boot applies it
-- deterministically via `prisma migrate deploy`.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "in_stock" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "products_price_cents_check" CHECK ("price_cents" >= 0)
);

CREATE UNIQUE INDEX "products_handle_key" ON "products"("handle");
CREATE INDEX "products_name_idx" ON "products"("name");
CREATE INDEX "products_description_idx" ON "products"("description");

CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "carts_user_id_key" ON "carts"("user_id");

ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cart_items_quantity_check" CHECK ("quantity" > 0)
);

CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");

ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey"
    FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE;
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;

CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'placed',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "orders_total_cents_check" CHECK ("total_cents" >= 0),
    CONSTRAINT "orders_status_check" CHECK ("status" IN ('placed', 'shipped', 'delivered'))
);

CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at" DESC);

ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;

CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name" TEXT NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "order_items_unit_price_cents_check" CHECK ("unit_price_cents" >= 0),
    CONSTRAINT "order_items_quantity_check" CHECK ("quantity" > 0)
);

ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT;

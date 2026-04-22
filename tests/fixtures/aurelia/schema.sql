--
-- Aurelia — schema-only dump (pg_dump --schema-only, trimmed for fixture use).
-- ~60 tables covering catalog, cart/order, customer, payment, shipping,
-- configuration, and bookkeeping. PII-heavy tables intentionally present
-- so /atw.schema PII exclusion (SC-004) can be exercised.
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Configuration / reference ------------------------------------------------

CREATE TABLE region (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  currency     text NOT NULL,
  tax_rate     numeric(5,4) NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE country (
  iso2         char(2) PRIMARY KEY,
  name         text NOT NULL,
  region_id    uuid REFERENCES region(id)
);

CREATE TABLE currency (
  code         char(3) PRIMARY KEY,
  symbol       text NOT NULL,
  name         text NOT NULL
);

CREATE TABLE store (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  default_region_id uuid REFERENCES region(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sales_channel (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  is_disabled  boolean NOT NULL DEFAULT false
);

CREATE TABLE tax_rate (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id    uuid NOT NULL REFERENCES region(id),
  rate         numeric(5,4) NOT NULL,
  name         text NOT NULL
);

-- Catalog -----------------------------------------------------------------

CREATE TABLE product_collection (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle       text UNIQUE NOT NULL,
  title        text NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_category (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle       text UNIQUE NOT NULL,
  name         text NOT NULL,
  parent_id    uuid REFERENCES product_category(id)
);

CREATE TABLE product (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle          text UNIQUE NOT NULL,
  title           text NOT NULL,
  subtitle        text,
  description     text,
  status          text NOT NULL DEFAULT 'draft',
  collection_id   uuid REFERENCES product_collection(id),
  is_giftcard     boolean NOT NULL DEFAULT false,
  thumbnail       text,
  weight          integer,
  length          integer,
  width           integer,
  height          integer,
  material        text,
  origin_country  char(2) REFERENCES country(iso2),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_category_product (
  product_id   uuid NOT NULL REFERENCES product(id),
  category_id  uuid NOT NULL REFERENCES product_category(id),
  PRIMARY KEY (product_id, category_id)
);

CREATE TABLE product_tag (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  value        text UNIQUE NOT NULL
);

CREATE TABLE product_tag_product (
  product_id   uuid NOT NULL REFERENCES product(id),
  tag_id       uuid NOT NULL REFERENCES product_tag(id),
  PRIMARY KEY (product_id, tag_id)
);

CREATE TABLE product_image (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   uuid NOT NULL REFERENCES product(id),
  url          text NOT NULL,
  alt_text     text,
  position     integer
);

CREATE TABLE product_option (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id   uuid NOT NULL REFERENCES product(id),
  title        text NOT NULL
);

CREATE TABLE product_option_value (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  option_id    uuid NOT NULL REFERENCES product_option(id),
  value        text NOT NULL
);

CREATE TABLE product_variant (
  id              uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id      uuid NOT NULL REFERENCES product(id),
  sku             text UNIQUE NOT NULL,
  title           text NOT NULL,
  barcode         text,
  inventory_quantity integer NOT NULL DEFAULT 0,
  prices_json     jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE product_variant_option_value (
  variant_id   uuid NOT NULL REFERENCES product_variant(id),
  option_value_id uuid NOT NULL REFERENCES product_option_value(id),
  PRIMARY KEY (variant_id, option_value_id)
);

CREATE TABLE inventory_level (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  variant_id   uuid NOT NULL REFERENCES product_variant(id),
  location_id  uuid NOT NULL,
  quantity     integer NOT NULL DEFAULT 0
);

CREATE TABLE stock_location (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  address_1    text,
  city         text,
  country_code char(2)
);

CREATE TABLE money_amount (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  currency_code char(3) NOT NULL REFERENCES currency(code),
  amount       integer NOT NULL,
  variant_id   uuid REFERENCES product_variant(id)
);

-- Cart / Order ------------------------------------------------------------

CREATE TABLE cart (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email        text,
  customer_id  uuid,
  region_id    uuid REFERENCES region(id),
  sales_channel_id uuid REFERENCES sales_channel(id),
  completed_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cart_line_item (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  cart_id      uuid NOT NULL REFERENCES cart(id),
  variant_id   uuid NOT NULL REFERENCES product_variant(id),
  quantity     integer NOT NULL,
  unit_price   integer NOT NULL
);

CREATE TABLE "order" (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  display_id     text UNIQUE NOT NULL,
  email          text,
  customer_id    uuid,
  cart_id        uuid REFERENCES cart(id),
  region_id      uuid REFERENCES region(id),
  currency_code  char(3) REFERENCES currency(code),
  total          integer NOT NULL,
  status         text NOT NULL DEFAULT 'pending',
  created_at     timestamptz NOT NULL DEFAULT now(),
  canceled_at    timestamptz
);

CREATE TABLE order_line_item (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     uuid NOT NULL REFERENCES "order"(id),
  variant_id   uuid NOT NULL REFERENCES product_variant(id),
  title        text NOT NULL,
  quantity     integer NOT NULL,
  unit_price   integer NOT NULL
);

CREATE TABLE fulfillment (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     uuid NOT NULL REFERENCES "order"(id),
  tracking_number text,
  shipped_at   timestamptz,
  delivered_at timestamptz
);

CREATE TABLE shipping_method (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  region_id    uuid REFERENCES region(id),
  price        integer NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT true
);

CREATE TABLE shipping_option (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text NOT NULL,
  region_id    uuid REFERENCES region(id),
  provider     text NOT NULL
);

CREATE TABLE return (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id     uuid NOT NULL REFERENCES "order"(id),
  reason       text,
  refund_amount integer,
  status       text NOT NULL DEFAULT 'requested'
);

CREATE TABLE discount (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         text UNIQUE NOT NULL,
  value        numeric(7,2) NOT NULL,
  type         text NOT NULL DEFAULT 'percent',
  is_disabled  boolean NOT NULL DEFAULT false
);

CREATE TABLE cart_discount (
  cart_id      uuid NOT NULL REFERENCES cart(id),
  discount_id  uuid NOT NULL REFERENCES discount(id),
  PRIMARY KEY (cart_id, discount_id)
);

-- Customer (PII) ----------------------------------------------------------

CREATE TABLE customer (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          text UNIQUE NOT NULL,
  first_name     text,
  last_name      text,
  phone          text,
  has_account    boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customer_group (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name         text UNIQUE NOT NULL
);

CREATE TABLE customer_group_customer (
  customer_id  uuid NOT NULL REFERENCES customer(id),
  group_id     uuid NOT NULL REFERENCES customer_group(id),
  PRIMARY KEY (customer_id, group_id)
);

CREATE TABLE customer_address (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id    uuid NOT NULL REFERENCES customer(id),
  first_name     text,
  last_name      text,
  company        text,
  address_1      text,
  address_2      text,
  city           text,
  province       text,
  postal_code    text,
  country_code   char(2) REFERENCES country(iso2),
  phone          text,
  is_default_shipping boolean NOT NULL DEFAULT false,
  is_default_billing  boolean NOT NULL DEFAULT false
);

-- Payment (PII) -----------------------------------------------------------

CREATE TABLE payment (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id       uuid REFERENCES "order"(id),
  cart_id        uuid REFERENCES cart(id),
  provider_id    text NOT NULL,
  amount         integer NOT NULL,
  currency_code  char(3) REFERENCES currency(code),
  card_last_four char(4),
  card_brand     text,
  captured_at    timestamptz,
  canceled_at    timestamptz
);

CREATE TABLE payment_provider (
  id           text PRIMARY KEY,
  name         text NOT NULL,
  is_enabled   boolean NOT NULL DEFAULT true
);

CREATE TABLE refund (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id   uuid NOT NULL REFERENCES payment(id),
  amount       integer NOT NULL,
  reason       text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Notifications / logs (infrastructure) -----------------------------------

CREATE TABLE notification (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name   text NOT NULL,
  recipient    text NOT NULL,
  payload      jsonb,
  sent_at      timestamptz
);

CREATE TABLE webhook_log (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  provider     text NOT NULL,
  payload      jsonb,
  received_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE migrations (
  id           integer PRIMARY KEY,
  name         text NOT NULL,
  run_on       timestamptz NOT NULL
);

CREATE TABLE staged_job (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_name   text NOT NULL,
  data         jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE gift_card (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code         text UNIQUE NOT NULL,
  value        integer NOT NULL,
  is_disabled  boolean NOT NULL DEFAULT false,
  ends_at      timestamptz,
  region_id    uuid REFERENCES region(id)
);

CREATE TABLE gift_card_transaction (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  gift_card_id uuid NOT NULL REFERENCES gift_card(id),
  order_id     uuid REFERENCES "order"(id),
  amount       integer NOT NULL
);

-- Admin user (should be classified as operational, PII) -------------------

CREATE TABLE admin_user (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          text UNIQUE NOT NULL,
  password_hash  text NOT NULL,
  first_name     text,
  last_name      text,
  role           text NOT NULL DEFAULT 'member',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE admin_session (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id uuid NOT NULL REFERENCES admin_user(id),
  token        text NOT NULL,
  expires_at   timestamptz NOT NULL
);

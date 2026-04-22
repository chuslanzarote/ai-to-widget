--
-- Aurelia — partial data-only dump for /atw.schema 50-row sample
-- validation (FR-016). Contains benign product / collection rows plus
-- PII-bearing customer / payment rows so the heuristic can be exercised.
--

INSERT INTO product_collection (id, handle, title, description) VALUES
  ('11111111-1111-1111-1111-111111111111', 'tableware', 'Tableware', 'Everyday dishes and serveware.'),
  ('11111111-1111-1111-1111-111111111112', 'drinkware', 'Drinkware', 'Mugs, tumblers, and cups.'),
  ('11111111-1111-1111-1111-111111111113', 'limited',   'Limited editions', 'Numbered runs, once gone they are gone.');

INSERT INTO product (id, handle, title, description, status, collection_id, material) VALUES
  ('22222222-2222-2222-2222-222222222221', 'stone-white-mug',      'Stone White Mug',      'Hand-thrown mug with matte white glaze.',  'published', '11111111-1111-1111-1111-111111111112', 'stoneware'),
  ('22222222-2222-2222-2222-222222222222', 'slipcast-oval-plate',  'Slip-cast Oval Plate', 'Slip-cast plate with celadon glaze.',      'published', '11111111-1111-1111-1111-111111111111', 'stoneware'),
  ('22222222-2222-2222-2222-222222222223', 'limited-wave-vase',    'Limited Wave Vase',    'Numbered run; each signed on the base.',  'published', '11111111-1111-1111-1111-111111111113', 'porcelain');

INSERT INTO product_variant (id, product_id, sku, title, inventory_quantity) VALUES
  ('33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221', 'STN-MUG-WHT', 'Stone White Mug',   42),
  ('33333333-3333-3333-3333-333333333332', '22222222-2222-2222-2222-222222222222', 'SC-OVP-CEL',  'Celadon Oval Plate', 18),
  ('33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222223', 'LTD-WV-BLU', 'Wave Vase — Blue',   4);

INSERT INTO region (id, name, currency, tax_rate) VALUES
  ('44444444-4444-4444-4444-444444444441', 'North America', 'USD', 0.0625),
  ('44444444-4444-4444-4444-444444444442', 'EU',            'EUR', 0.2100);

-- PII-bearing rows — present on purpose to exercise FR-021/FR-022.
INSERT INTO customer (id, email, first_name, last_name, phone) VALUES
  ('55555555-5555-5555-5555-555555555551', 'ava.jensen@example.com',   'Ava',   'Jensen',   '+1-555-202-4412'),
  ('55555555-5555-5555-5555-555555555552', 'marco.bianchi@example.it', 'Marco', 'Bianchi',  '+39-02-555-8821');

INSERT INTO customer_address (id, customer_id, first_name, last_name, address_1, city, province, postal_code, country_code, phone) VALUES
  ('66666666-6666-6666-6666-666666666661', '55555555-5555-5555-5555-555555555551', 'Ava',   'Jensen',  '221B Baker St',    'New York', 'NY', '10014', 'US', '+1-555-202-4412'),
  ('66666666-6666-6666-6666-666666666662', '55555555-5555-5555-5555-555555555552', 'Marco', 'Bianchi', 'Via Dante 10',     'Milano',   'MI', '20123', 'IT', '+39-02-555-8821');

INSERT INTO payment (id, order_id, provider_id, amount, currency_code, card_last_four, card_brand) VALUES
  ('77777777-7777-7777-7777-777777777771', NULL, 'stripe', 4200, 'USD', '4242', 'visa'),
  ('77777777-7777-7777-7777-777777777772', NULL, 'stripe', 8900, 'EUR', '1881', 'mastercard');

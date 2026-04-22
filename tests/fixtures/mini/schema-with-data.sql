--
-- Mini fixture (T109) — single indexable entity type (`product`) with 20
-- rows. Sized for SC-019: /atw.build should complete in under 5 min on
-- reference hardware.
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE product (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  handle      text UNIQUE NOT NULL,
  title       text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'published',
  created_at  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO product (id, handle, title, description) VALUES
  ('10000000-0000-0000-0000-000000000001', 'tea-cup-small',       'Tea Cup (small)',        'Compact porcelain tea cup with a rolled rim.'),
  ('10000000-0000-0000-0000-000000000002', 'tea-cup-large',       'Tea Cup (large)',        'Generous porcelain tea cup for long-brew herbal infusions.'),
  ('10000000-0000-0000-0000-000000000003', 'saucer-plain',        'Plain Saucer',           'Matte-white saucer sized to fit the tea-cup series.'),
  ('10000000-0000-0000-0000-000000000004', 'teapot-stone',        'Stone Teapot',           'Hand-thrown stoneware teapot with a 750 ml capacity.'),
  ('10000000-0000-0000-0000-000000000005', 'teapot-iron',         'Cast-iron Teapot',       'Traditional cast-iron teapot with enameled interior.'),
  ('10000000-0000-0000-0000-000000000006', 'kettle-copper',       'Copper Kettle',          'Polished copper kettle with a whistling spout.'),
  ('10000000-0000-0000-0000-000000000007', 'strainer-mesh',       'Mesh Tea Strainer',      'Stainless-steel mesh strainer sized for standard mugs.'),
  ('10000000-0000-0000-0000-000000000008', 'scoop-bamboo',        'Bamboo Tea Scoop',       'Hand-carved bamboo scoop for loose-leaf tea.'),
  ('10000000-0000-0000-0000-000000000009', 'whisk-chasen',        'Matcha Whisk (chasen)',   'Hand-cut bamboo matcha whisk with 80 prongs.'),
  ('10000000-0000-0000-0000-000000000010', 'bowl-matcha',         'Matcha Bowl',            'Wide-mouthed matcha bowl with a speckled tenmoku glaze.'),
  ('10000000-0000-0000-0000-000000000011', 'canister-tin',        'Tin Tea Canister',       'Airtight tin canister, holds up to 100 g of loose tea.'),
  ('10000000-0000-0000-0000-000000000012', 'timer-sand',          'Sand Tea Timer',         'Three-minute sand timer for precise steep control.'),
  ('10000000-0000-0000-0000-000000000013', 'tray-oak',            'Oak Serving Tray',       'Solid oak serving tray with recessed handles.'),
  ('10000000-0000-0000-0000-000000000014', 'coaster-cork',        'Cork Coaster (set)',     'Set of four natural cork coasters, 10 cm diameter.'),
  ('10000000-0000-0000-0000-000000000015', 'napkin-linen',        'Linen Tea Napkin',       'Soft washed-linen napkin in natural off-white.'),
  ('10000000-0000-0000-0000-000000000016', 'sampler-black',       'Black Tea Sampler',      'Sampler pack featuring three single-origin black teas.'),
  ('10000000-0000-0000-0000-000000000017', 'sampler-green',       'Green Tea Sampler',      'Sampler pack featuring three Japanese green teas.'),
  ('10000000-0000-0000-0000-000000000018', 'sampler-herbal',      'Herbal Sampler',         'Sampler pack featuring five caffeine-free herbal blends.'),
  ('10000000-0000-0000-0000-000000000019', 'giftbox-starter',     'Starter Gift Box',       'Gift box with a teapot, two cups, and a tea sampler.'),
  ('10000000-0000-0000-0000-000000000020', 'giftbox-connoisseur', 'Connoisseur Gift Box',   'Gift box for the serious drinker — kettle, teapot, and rare leaves.');

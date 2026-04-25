# Schema Map

## Summary

- Indexable entities: 1 (`products`).
- Reference tables: 0.
- Infrastructure / ignored: 0.
- PII-excluded tables: 0.
- PII-excluded columns: 0.

The dump contains a single business entity. The brief's reference to
"look up past orders" has no matching table in this schema and must be
satisfied by an OpenAPI operation surfaced through `/atw.api` rather
than by an indexed entity.

## Entity: products

- **Classification**: indexable
- **Source tables**: `public.products`
- **Joined references**: none

### Columns

- `id`: index — uuid identifier
- `handle`: index — text slug
- `name`: index — text catalog field
- `description`: index — text catalog field
- `price_cents`: index — integer price, used for comparison
- `image_url`: reference — text, visual asset path
- `in_stock`: index — boolean availability filter
- `created_at`: exclude-internal — timestamp record metadata

### Evidence

- **Column-name signals**: `handle`, `name`, `description`, `price_cents`,
  `image_url`, `in_stock` are textbook catalog columns; no PII lexicon
  hits (`email`, `phone`, `ssn`, `address`, …).
- **Foreign-key graph**: zero foreign keys; the table is self-contained.
- **Brief quote**: *"It will browser products, compare them, and add to
  cart"* (from `brief.md` §Agent's allowed actions, captured verbatim
  during `/atw.brief`).
- **Sample rows** (3 of 20 inserted in the dump):
  - `midnight-roast-1kg-whole` — *Midnight Roast 1 kg whole bean* — 3400 cents
  - `ethiopian-yirgacheffe-500g` — *Ethiopian Yirgacheffe 500 g* — 2200 cents (single origin)
  - `v60-pour-over-set` — *V60 Pour-Over Set* — 4500 cents

### Domain vocabulary anchored here

- **Single origin** — appears in the `description` column of multiple
  rows (e.g., Ethiopian Yirgacheffe, Colombia Huila, Kenya AA). Defined
  in `brief.md` §Business vocabulary as "coffee from one farm or
  region".

## Reference tables

No reference tables in this schema.

## Infrastructure / ignored

No infrastructure or audit tables in this schema.

## PII-excluded

No tables or columns were flagged as PII. The dump contains no
customer, address, or payment data.

# Aurelia demo seed

This directory contains the deterministic seed data for the Aurelia Medusa demo.
Every file here is committed to the repo — there is **no** CDN fetch at seed
time (Principle VIII — Reproducibility).

## Files

| File | Count | Notes |
|------|-------|-------|
| `products.json` | 300 | Specialty coffee products + brewing gear. Generated via `generate-products.mjs` with a fixed RNG seed, so the file is deterministic. |
| `categories.json` | 25 | Hierarchical categories (single-origin, blends, manual brewers, …). |
| `collections.json` | 12 | Curated collections (best-sellers, gift-ready, limited releases, …). |
| `regions.json` | 4 | EU / US / UK / CA pricing regions. |
| `customers.json` | 3 | **Synthetic** demo customers with public passwords so reviewers can log in. |
| `orders.json` | 6 | Sample orders keyed to the demo customers; powers the "what did I order last time?" flow. |
| `seed.mjs` | — | Idempotent Medusa seeder. Truncates then reinserts all rows inside a single transaction. |
| `generate-products.mjs` | — | Product-catalog generator. Run once to refresh `products.json`. |

## Regenerating products.json

```bash
cd demo/medusa/seed
node generate-products.mjs > products.json
```

The script uses a fixed seed (`rngSeed = 42` inside the module), so two runs on
the same machine produce byte-identical output.

## Demo customer credentials

All three `cus_demo_*` rows have a `_demo_password` field with a synthetic
password. Because this is a hackathon demo, the passwords are intentionally
public and rotate only when the demo catalog rotates. Reviewers can log in at
`/account` with any of these to exercise US-003.5 (authentication passthrough).

| Email | Password |
|-------|----------|
| `alice.demo@aurelia-coffee.local` | `aurelia-demo-1` |
| `bob.demo@aurelia-coffee.local` | `aurelia-demo-2` |
| `carmen.demo@aurelia-coffee.local` | `aurelia-demo-3` |

Do **not** reuse these credentials in any non-demo Medusa deployment.

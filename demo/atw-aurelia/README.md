# demo/atw-aurelia

Pre-generated artefacts so `make demo` can reach a working widget in
under 3 minutes without the reviewer running Features 001 or 002.

## What's here

- `.atw/config/project.md` — identity of the Aurelia demo project
- `.atw/config/brief.md` — business brief (voice, vocabulary, non-goals)
- `.atw/artifacts/schema-map.md` — indexable vs PII-excluded table map
- `.atw/artifacts/action-manifest.md` — tool list, split into safe-read + action
- `.atw/artifacts/build-plan.md` — pre-computed estimate + sequence
- `atw.sql` — **NOT COMMITTED YET** — the `atw_documents` dump produced
  by running `/atw.build` against the seeded Medusa. See
  [regenerating the dump](#regenerating-the-atwsql-dump) below.

## Regenerating the `atw.sql` dump

This dump is the deterministic initial state of `atw_postgres` on first
boot. It is produced by running the full Feature 002 build pipeline
against the seeded Aurelia catalog:

```bash
# 1) Ensure demo/medusa/seed/products.json is up to date:
node demo/medusa/seed/generate-products.mjs > demo/medusa/seed/products.json

# 2) Bring only the Medusa services up so seeding can run:
make fresh

# 3) From this `demo/atw-aurelia/` directory, run the five setup-flow
#    commands in Claude Code — or skip them (they are already committed
#    under .atw/).

# 4) Run the build pipeline:
cd demo/atw-aurelia && claude
> /atw.build    # ~15 min, ~$14 in Opus calls

# 5) Export atw_documents:
pg_dump --no-owner --no-privileges \
  --data-only --table=atw_documents --table=atw_migrations \
  -U atw -h 127.0.0.1 -p 5433 atw > demo/atw-aurelia/atw.sql

# 6) Commit atw.sql. Review the diff: changes should be additive
#    unless the seed catalog rotated.
```

The dump is expected to be ~2–3 MB once populated. Committing it keeps
the reviewer path offline under Principle VIII (no Anthropic calls
required to see the demo work).

## When to regenerate

Regenerate the dump whenever any of these change:

- The product/category/collection/region seed JSON.
- `brief.md` or `action-manifest.md` (these change the Opus system
  prompt, hence every enriched document).
- The embedding model version pinned in Feature 002.
- The enrichment prompt template version (`enrich-v1` → `enrich-v2`,
  …).

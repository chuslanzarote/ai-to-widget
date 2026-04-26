# tools/dev — ATW maintainer scratchpad

> **Integrators stop here.** If you are following the embed guide
> (`/atw.embed`), nothing in this directory applies to you. The compose
> files and helpers here are for ATW developers only.

## What lives here

- `docker-compose.yml` — local stack used by ATW maintainers when
  iterating on the runtime backend against the legacy `demo/medusa`
  storefront. Spins up `atw_postgres` (pgvector) and `atw_backend`
  alongside Medusa's Postgres, Redis, backend, and storefront.

## Why it is not in the repo root

Earlier revisions of ATW shipped this file at the repo root, which made
integrators think it was the compose they should run. Per FR-033 the
repo root now stays integrator-clean: the embed guide writes the only
compose touch points (under the integrator's host project, gated by the
`atw:begin`/`atw:end` markers).

## Quick use

```bash
docker compose -f tools/dev/docker-compose.yml up -d
```

The `atw.sql` mount that previously seeded `atw_postgres` was removed —
ATW's reference data is now produced through the regular `/atw.build`
pipeline, not a static dump.

## Pointers

- Integrator embed guide: `commands/atw.embed.md`
- ATW build orchestrator: `packages/scripts/src/orchestrator.ts`

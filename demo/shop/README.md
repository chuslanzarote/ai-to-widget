# ATW Reference Shop

A minimal, purpose-built reference ecommerce testbed for the ATW toolchain.
Fastify backend + Prisma + Postgres, Vite + React + TanStack Query SPA.

## Quickstart

```bash
cd demo/shop
docker compose up -d
```

Then open:

- Storefront: http://localhost:8080
- Backend OpenAPI: http://localhost:3200/openapi.json
- Swagger UI: http://localhost:3200/docs

The backend runs Prisma migrations and the deterministic seed on first boot
(~20 coffee products, 3 seeded users).

## Seeded credentials

| Email             | Password   | Display name   |
|-------------------|------------|----------------|
| `alice@example.com` | `alicepass` | Alice Rivera    |
| `bob@example.com`   | `bobpass`   | Bob Kimathi     |
| `carla@example.com` | `carlapass` | Carla Nguyen    |

These are fixed by the seed script (`backend/prisma/seed.ts`) and documented
here per FR-005 (Clarification Q2). Do not change them without updating the
seed.

## Ports

- `3200` — shop backend (HTTP, OpenAPI)
- `5434` — shop Postgres (host port; internal remains 5432)
- `8080` — shop SPA (nginx serving the Vite `dist/`)

Ports are intentionally not 5432/3000/8000 to avoid colliding with
`atw_postgres` and the ATW backend.

## Zero ATW involvement

This stack runs standalone — no ATW components required to exercise the
login → browse → cart → order flow. US1 acceptance is demonstrable with
only this compose file up.

## CORS (Feature 008 / FR-021)

The backend registers `@fastify/cors` before any route. The allowed
origins come from `ALLOWED_ORIGINS` (comma-separated), defaulting to
`http://localhost:5173` (Vite dev server). `Authorization` and
`Content-Type` are on the allow-list; credentials mode is off. Override
at boot:

```bash
ALLOWED_ORIGINS="http://localhost:5173,https://shop.example.com" docker compose up
```


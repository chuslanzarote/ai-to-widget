# Contract: `docker-compose.yml` service graph

**Feature**: Runtime (003)
**Plan**: [../plan.md](../plan.md)

The top-level `docker-compose.yml` is the binding integration manifest
for the runtime. Every detail here is a reproducibility promise under
Principle VIII — a reviewer running `docker compose up` MUST see a
working demo.

---

## 1. Services

Six services total. Every image pinned with a digest.

### 1.1 `medusa_postgres`

Postgres for the Medusa app.

- Image: `postgres:16-alpine@sha256:<digest>`
- Ports: `5432:5432` (host:container)
- Env:
  - `POSTGRES_DB=medusa`
  - `POSTGRES_USER=medusa`
  - `POSTGRES_PASSWORD=medusa_local` *(demo-only; synthetic)*
- Volumes: named volume `medusa_pg_data:/var/lib/postgresql/data`
- Healthcheck: `pg_isready -U medusa -d medusa` every 5 s.

### 1.2 `medusa_redis`

Redis for the Medusa app.

- Image: `redis:7-alpine@sha256:<digest>`
- No exposed port (internal-only).
- Healthcheck: `redis-cli ping` every 5 s.

### 1.3 `medusa_backend`

Medusa v2 backend.

- Build: `./demo/medusa/backend`
- Ports: `9000:9000`
- Env:
  - `DATABASE_URL=postgres://medusa:medusa_local@medusa_postgres:5432/medusa`
  - `REDIS_URL=redis://medusa_redis:6379`
  - `JWT_SECRET=<dev-only value>`
  - `COOKIE_SECRET=<dev-only value>`
  - `STORE_CORS=http://localhost:8000,http://storefront:8000`
  - `ADMIN_CORS=http://localhost:7001`
  - `MEDUSA_ADMIN_ONBOARDING_TYPE=`
- Depends on: `medusa_postgres` (healthy), `medusa_redis` (healthy)
- Entrypoint runs migrations and the seed script on first boot
  (idempotent; truncates + reinserts seed if already populated).
- Healthcheck: `curl -f http://localhost:9000/health` every 10 s.

### 1.4 `medusa_storefront`

Next.js storefront with the Aurelia theming and the embedded widget.

- Build: `./demo/medusa/storefront`
- Ports: `8000:8000`
- Env:
  - `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000`
  - `NEXT_PUBLIC_ATW_BACKEND_URL=http://localhost:3100`
  - `NEXT_PUBLIC_DEFAULT_REGION=eu`
- Depends on: `medusa_backend` (healthy)
- Mounts the compiled `dist/widget.js` and `dist/widget.css` into its
  `public/` directory via a named volume that `atw_backend` writes at
  startup (or via a build-time copy — see §3).

### 1.5 `atw_postgres`

Pgvector-enabled Postgres for ATW runtime.

- Image: `pgvector/pgvector:pg16@sha256:<digest>`
- Ports: `5433:5432`
- Env:
  - `POSTGRES_DB=atw`
  - `POSTGRES_USER=atw`
  - `POSTGRES_PASSWORD=atw`
- Volumes: named volume `atw_pg_data:/var/lib/postgresql/data`
- On first boot, an init script imports the pre-built database dump
  from `demo/atw-aurelia/atw.sql` so reviewers skip Feature 002
  execution. On `make fresh`, the volume is removed so the init
  script re-runs.
- Healthcheck: `pg_isready -U atw -d atw` every 5 s.

### 1.6 `atw_backend`

The runtime backend — the image produced by Feature 002's
`/atw.build` against the Aurelia project.

- Image: `atw_backend:latest`
- Ports: `3100:3100`
- Env:
  - `DATABASE_URL=postgres://atw:atw@atw_postgres:5432/atw`
  - `ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}` *(from .env; the reviewer
    must set this)*
  - `ALLOWED_ORIGINS=http://localhost:8000`
  - `HOST_API_BASE_URL=http://medusa_backend:9000`
  - `LOG_LEVEL=info`
  - `NODE_ENV=production`
- Depends on: `atw_postgres` (healthy)
- Healthcheck: `node -e "fetch('http://localhost:3100/health').then(r
  => process.exit(r.ok ? 0 : 1))"` every 10 s.

---

## 2. Network graph

All services join the default compose network `ai-to-widget_default`.

Traffic is strictly:

- Browser → `medusa_storefront` (port 8000, cookie-authenticated).
- Browser → `atw_backend` (port 3100, no credentials).
- Browser → `medusa_backend` (port 9000, cookie-authenticated for
  widget actions).
- `atw_backend` → `atw_postgres` (DSN).
- `atw_backend` → `medusa_backend` (server-side, via
  `HOST_API_BASE_URL` for safe-read tools; uses `HOST_API_KEY` if
  set).
- `atw_backend` → `api.anthropic.com` (outbound HTTPS; only service
  with outbound internet in the demo).

---

## 3. Widget bundle delivery

Two options, chosen per quickstart ergonomics:

- **Option A (default)**: The `medusa_storefront` build stage copies
  `dist/widget.js` + `dist/widget.css` from the host repo at image
  build time. Simple; requires a rebuild if the widget changes.
- **Option B**: A named volume `atw_widget_dist` is mounted read-only
  into `medusa_storefront:/app/public/` and populated at startup by
  `atw_backend` with the compiled files baked into its image.

The quickstart uses Option A for reviewer simplicity.

---

## 4. Reviewer path (`make demo`)

```sh
make demo
# expands to:
#   cp .env.example .env      # if .env is absent
#   docker compose pull       # honour pinned digests
#   docker compose up -d
#   open http://localhost:8000
```

On a cold run, expected total startup < 3 minutes (SC-005). On a warm
run (volumes intact), < 30 seconds.

---

## 5. Fresh path (`make fresh`)

```sh
make fresh
# expands to:
#   docker compose down -v
#   rm -rf demo/atw-aurelia/.atw/state/*
#   docker compose up medusa_backend medusa_postgres medusa_redis -d
#   # reviewer is now ready to run /atw.init, /atw.brief, /atw.schema, /atw.api, /atw.plan, /atw.build, /atw.embed
```

This is the path the demo video films for the compressed setup flow.

---

## 6. Env file contract

`.env.example` committed to the repo; `.env` added to `.gitignore`.

```env
# Copy to .env and fill in the single required secret.
ANTHROPIC_API_KEY=your-key-here

# All others have sensible defaults; override as needed.
# LOG_LEVEL=info
# ALLOWED_ORIGINS=http://localhost:8000
```

The README quickstart's first instruction is `cp .env.example .env &&
$EDITOR .env`.

---

## 7. Test overlay (`docker-compose.test.yml`)

A second compose file used by integration and E2E tests:

- Overrides `ANTHROPIC_API_KEY` with a mock server URL when Anthropic
  is not reachable (CI).
- Sets `RATE_LIMIT_MAX=3` so rate-limit tests run quickly.
- Disables the init-script import on `atw_postgres` and lets the
  test fixtures seed the DB instead.
- Uses a separate network so tests can coexist with a running dev
  stack without port collisions.

Invoked by tests as `docker compose -f docker-compose.yml -f
docker-compose.test.yml up --wait`.

---

## 8. Pinning contract

Every image tag in `docker-compose.yml` MUST include a digest
(`image: foo:tag@sha256:...`). CI includes a lint step that fails
if any service references a tag without a digest. The digests are
updated together with the corresponding image version, not in
drive-by PRs.

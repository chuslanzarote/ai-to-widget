# Aurelia Demo — Reproduction Guide

End-to-end walkthrough for the AI-to-Widget hackathon demo: Medusa v2
coffee storefront + the ATW setup flow + `/atw.build` + the embedded
widget.

Run every command from the **repo root** (`ai-to-widget/`) unless the
step says otherwise.

---

## Step 1 — Collect inputs for the ATW setup flow

The `/atw.*` slash commands consume two deterministic input files that
the Builder stages under `.atw/inputs/`. Prepare them once, up front.

> Prerequisite for this step: Medusa is already running locally (i.e.
> you've run `make fresh` and http://localhost:8000 loads the Aurelia
> storefront). We'll document `make fresh` itself in an earlier step
> later; for now assume it's up.

### 1a. Medusa schema dump — consumed by `/atw.schema`

```bash
docker compose exec -T medusa_postgres \
  pg_dump --schema-only --no-owner --no-privileges \
  -U medusa -d medusa \
  > demo/atw-aurelia/.atw/inputs/medusa-schema.sql
```

Why these flags:

- `--schema-only` — DDL only, no rows. `/atw.schema` refuses live
  connection strings and raw data dumps by contract (FR-018); a schema
  dump is the correct input shape.
- `--no-owner --no-privileges` — strips `ALTER OWNER TO medusa` and
  `GRANT` noise so the file stays clean and stable across reseeds.
- `-T` on `docker compose exec` — disables the TTY so the `>` redirect
  writes a plain file instead of terminal control sequences.

Expected output: ~120 KB of `CREATE TABLE` / `CREATE INDEX` statements
covering `product`, `product_variant`, `product_category`, `customer`,
`order`, etc.

### 1b. Medusa Store API OpenAPI spec — consumed by `/atw.api`

Medusa v2 does **not** expose an `/openapi.json` endpoint at runtime
(unlike v1). The spec is maintained in Medusa's public docs repo:

```bash
curl -L -o demo/atw-aurelia/.atw/inputs/medusa-store-openapi.yaml \
  https://raw.githubusercontent.com/medusajs/medusa/develop/www/apps/api-reference/specs/store/openapi.yaml
```

If Medusa renames the path in the future, browse to
<https://github.com/medusajs/medusa/tree/develop/www/apps/api-reference/specs/store>
and download `openapi.yaml` manually into the same location.

---

## Step 2 — Run the ATW setup flow

The setup flow is five slash commands, executed **inside a Claude Code
session opened in `demo/atw-aurelia/`** (that directory has the
`.claude/commands/atw.*.md` scaffolded by `create-atw`).

```bash
cd demo/atw-aurelia
claude
```

Run the commands in order. Each one interviews you, shows a proposal,
and only writes its artefact after you confirm (FR-041).

| # | Command | Argument | LLM calls | Output |
|---|---|---|---|---|
| 2a | `/atw.init` | — | 0 | `.atw/config/project.md` |
| 2b | `/atw.brief` | — | 1 | `.atw/config/brief.md` |
| 2c | `/atw.schema` | `.atw/inputs/medusa-schema.sql` | 1–5 | `.atw/artifacts/schema-map.md` |
| 2d | `/atw.api` | `.atw/inputs/medusa-store-openapi.yaml` | 1–5 | `.atw/artifacts/action-manifest.md` |
| 2e | `/atw.plan` | — | 1 | `.atw/artifacts/build-plan.md` |

Notes:

- `/atw.schema` refuses database connection strings and live-DB
  instructions; only schema dumps are accepted (FR-018). Your input
  from Step 1a satisfies this.
- `/atw.api` detects Swagger 2.0 and halts with a conversion hint
  (FR-033). OpenAPI 3.0/3.1 is accepted; Medusa's spec is 3.1.
- `/atw.plan` prints a cost estimate **before** the confirmation
  prompt. For a fresh seed (50 products, ~10 categories, a handful of
  collections/regions) expect ~$2 in Opus calls. It can be re-run
  whenever any upstream artefact changes (FR-040, FR-049).

When `/atw.plan` finishes, all five artefacts exist under `.atw/` and
Feature 001 is complete.

---

## Step 3 — Prepare the data dump for `/atw.build`

`/atw.build` needs a **data** dump (not the schema-only one from 1a) so
it can populate the `client_ref` tables of its own pgvector database
from your Medusa catalogue. The orchestrator picks up the first `.sql`
or `.sql.gz` it finds under `.atw/inputs/`, then filters it through
your `schema-map.md` to drop every PII-excluded table and column
before applying it.

### 3a. Generate the data dump

Back at the repo root (open another terminal if needed — keep Claude
Code running in `demo/atw-aurelia/`):

```bash
docker compose exec -T medusa_postgres \
  pg_dump --data-only --inserts --no-owner --no-privileges \
  -U medusa -d medusa \
  > demo/atw-aurelia/.atw/inputs/medusa-data.sql
```

`pg_dump` will warn about circular foreign keys on `order_*`,
`tax_region` and `return_reason`. Those tables are PII-excluded in the
schema-map and `import-dump.js` filters them out before applying the
SQL — the warnings are harmless.

Expected output: ~450 KB, ~3000 lines of `INSERT INTO` statements.

### 3b. Move the schema-only dump out of `.atw/inputs/`

The orchestrator finds the first `.sql` in `.atw/inputs/`; leaving two
there makes the pick ambiguous. The schema dump already did its job
(it was consumed by `/atw.schema`), so move it aside:

```bash
mv demo/atw-aurelia/.atw/inputs/medusa-schema.sql \
   demo/atw-aurelia/.atw/medusa-schema.sql
```

### 3c. Export `ANTHROPIC_API_KEY` in the Claude Code shell

`atw-orchestrate` reads the key from the process environment, not from
`.env`. In the terminal where `claude` is running inside
`demo/atw-aurelia/`:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Skip this if your shell already exports it via `~/.bashrc` /
`~/.zshrc`.

---

## Step 4 — Run `/atw.build`

Inside the Claude Code session in `demo/atw-aurelia/`. Three useful
modes, cheapest first:

| Mode | Cost | Time | What you get |
|---|---|---|---|
| `/atw.build --dry-run` | $0 | seconds | Validates inputs, prints the plan, exits. No Docker, no Opus. |
| `/atw.build --no-enrich` | $0 | ~2 min | Postgres + import + backend templates rendered + `dist/widget.{js,css}` + `atw_backend:latest` image. Retrieval answers "not in catalogue" because `atw_documents` has empty enriched text. |
| `/atw.build` | ~$2 | ~10 min | Everything above **plus** the Opus enrichment pass — the agent actually knows your catalogue. |

Recommended sequence:

1. `/atw.build --dry-run` — sanity-check the plan and confirm the
   orchestrator found the right inputs.
2. `/atw.build --no-enrich` — validate the full build pipeline
   (Postgres boot, import, render, bundle, Docker image, PII scan)
   without spending on Opus.
3. `/atw.build` — run it for real once, then commit `atw.sql` so the
   reviewer path in `make demo` works offline.

When `/atw.build` completes you'll have:

- `atw_postgres` running on `:5433` with `atw_documents` populated
- `dist/widget.js` + `dist/widget.css` compiled
- `atw_backend:latest` Docker image on your local daemon
- `.atw/state/build-manifest.json` — hash-pinned audit trail

---

*Step 5 (`/atw.embed` + integrating the widget into the Medusa
storefront) will be documented once we reach it.*

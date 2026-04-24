# AI-to-Widget — Builder Quickstart

This project was scaffolded with `create-atw`. The `.atw/` directory
holds the artifacts every `/atw.*` slash command reads and writes.
Nothing under `.atw/config/` or `.atw/artifacts/` leaves your machine.

## Prerequisites

- Node.js 20+
- Claude Code CLI (installed and authenticated)
- A Postgres `--schema-only` dump of your domain database (for
  `/atw.schema`) — do **not** share a connection string.
- An OpenAPI 3.0 or 3.1 spec for your HTTP surface (for `/atw.api`).

## Workflow

Run these commands inside Claude Code, in order:

1. **`/atw.init`** — capture project name, agent language(s), and
   deployment type. Writes `.atw/config/project.md`. **No LLM call.**

2. **`/atw.brief`** — 8-question interview about what the agent may
   and may not do for customers. Writes `.atw/config/brief.md`.

3. **`/atw.schema`** — parses your schema, classifies entities, flags
   PII automatically. Writes `.atw/artifacts/schema-map.md`.

   Stage the schema first:

   ```sh
   mkdir -p .atw/inputs
   cp /path/to/schema-only-dump.sql .atw/inputs/
   ```

4. **`/atw.api`** — parses your OpenAPI spec, excludes admin
   endpoints by default, marks destructive operations for
   confirmation. Writes `.atw/artifacts/action-manifest.md`.

5. **`/atw.plan`** — validates cross-artifact consistency, shows a
   cost estimate, writes `.atw/artifacts/build-plan.md`. Completion
   of this command ends Feature 001. Feature 002 will execute the
   plan.

## Re-running commands

Each command is safe to re-run. Unchanged inputs short-circuit to a
refinement prompt with zero LLM calls. Changed inputs trigger only the
delta through the LLM; your hand-edits to artifacts are preserved.

## What not to do

- Do not paste database connection strings into `/atw.schema`. The
  command refuses them on purpose.
- Do not commit anything under `.atw/inputs/`. It is gitignored for
  you. Schemas and specs tend to contain customer details.
- Do not edit `.atw/state/` by hand. Those files are hashes used for
  idempotency detection.

## Next

After `/atw.plan` succeeds, the `.atw/artifacts/` directory contains
everything Feature 002 needs to build your runtime. The
`docker-compose.yml` in this directory is the anchor that
`/atw.build` (Feature 002) will uncomment and parameterize.

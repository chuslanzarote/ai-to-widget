---
description: Build the local backend and widget from the markdown artifacts produced by the setup flow.
---

# /atw.build

Run the full AI to Widget build pipeline on the local machine, turning the
five markdown artifacts produced by the setup flow into:

- A running pgvector-enabled Postgres instance populated with enriched
  `atw_documents` rows
- Rendered backend TypeScript sources under `backend/src/`
- A compiled widget bundle at `dist/widget.{js,css}`
- A multi-stage Docker image tagged `atw_backend:latest`
- An atomic `build-manifest.json` audit trail at `.atw/state/`

Contract: [contracts/slash-command.md](../specs/002-build-pipeline/contracts/slash-command.md)

## Prerequisites

Before running `/atw.build`, the following five artifacts MUST exist:

| Artifact                             | Produced by  |
|--------------------------------------|--------------|
| `.atw/config/project.md`             | `/atw.init`  |
| `.atw/config/brief.md`               | `/atw.brief` |
| `.atw/artifacts/schema-map.md`       | `/atw.schema`|
| `.atw/artifacts/action-manifest.md`  | `/atw.api`   |
| `.atw/artifacts/build-plan.md`       | `/atw.plan`  |

A SQL dump of the Builder's business data MUST be placed at
`.atw/inputs/<filename>.sql`. The filename is referenced in `schema-map.md`.

Environment requirements:

- Node.js 20 LTS (`.nvmrc` is authoritative)
- Docker 24+ with the daemon reachable (Docker Desktop on macOS / Windows)
- `ANTHROPIC_API_KEY` exported in the shell

If any prerequisite is missing the command halts with a one-line diagnostic
pointing at the specific remediation (the prior slash command to run, or the
missing environment).

## Running

```bash
npx atw-orchestrate
```

Or, inside Claude Code, invoke the slash command `/atw.build` directly.

## Flags

| Flag                    | Effect                                                                  |
|-------------------------|-------------------------------------------------------------------------|
| `--force`               | Re-enrich every entity even if `source_hash` matches (see Clarifications Q2). Does NOT re-run migrations, re-import `client_ref`, or invalidate the embedding model cache. |
| `--dry-run`             | Print the plan summary and exit without Docker writes or Opus calls.    |
| `--concurrency <n>`     | Cap in-flight Opus calls. Default 10. Must be ≥ 1.                      |
| `--postgres-port <n>`   | Host port to bind pgvector (default 5433).                              |
| `--entities-only`       | Run enrichment + Postgres only; skip render/bundle/image/scan.          |
| `--no-enrich`           | Skip enrichment; render + bundle + image from existing rows only.       |
| `-y`, `--yes`           | Skip the interactive confirmation prompt (scripted / CI use).           |
| `-h`, `--help`          | Print usage and exit.                                                   |
| `-v`, `--version`       | Print version and exit.                                                 |

`--entities-only` and `--no-enrich` cannot be combined.

## What you'll see

Once prerequisites pass, the command prints a plan summary (project name,
entity counts, Opus model, concurrency, Postgres image, embedding model,
estimated cost, estimated time, outputs to be written). Confirm `y` to
proceed. Progress lines stream at least every 5 entities or every 10 seconds
per FR-053.

On completion a `[DONE]` banner shows the actual cost, duration, and variance
against the estimate. Full detail is in `.atw/state/build-manifest.json`.

The banner ends with a **Next steps** section (Feature 008 / FR-005 /
contracts/embed-snippet.md §`/atw.build` DONE banner):

```
✅ Build complete.

Next steps:
  1. Run /atw.embed to get your integration snippet.
  2. Copy dist/widget.{js,css} and .atw/artifacts/action-executors.json
     into your host's public assets.
  3. Paste the snippet from /atw.embed into your host's HTML <body>.
  4. Review .atw/artifacts/host-requirements.md before going live.
```

Step 4 is printed verbatim only when `deploymentType ===
"customer-facing-widget"` (i.e. `host-requirements.md` was emitted by
`/atw.api`).

## Interruption

Ctrl+C during enrichment triggers a graceful shutdown: in-flight Opus calls
are allowed to complete (so their cost is not wasted), per-entity upserts
are committed, no render/bundle/image phase runs, and the manifest is
written with `result: "aborted"`. Re-run `/atw.build` to resume — already-
indexed entities are recognized by `source_hash` and skipped.

## Troubleshooting

See [Quickstart §11](../specs/002-build-pipeline/quickstart.md#11-when-things-go-wrong).

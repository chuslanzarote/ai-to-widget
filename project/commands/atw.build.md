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

Before each LLM phase the command prints an informational pre-call line
and waits **2 seconds** so you can Ctrl+C if the cost looks wrong:

```
[CLASSIFY] OpenAPI: 14 operations | model: claude-opus-4-7 | est. cost: ~$0.07 (continuing in 2s, Ctrl+C to abort)
```

There is no `[y/N]` prompt before LLM calls — only the countdown.

If the host `docker-compose.yml` lacks the `# ----- atw:begin -----` /
`# ----- atw:end -----` marker block, the COMPOSE phase prompts `[y/N]`
(default **no**). Pressing **n** (or accepting the default) leaves the
file untouched and prints the exact diff that would have been applied
plus the manual-paste instructions. Pass `-y` / `--yes` to auto-confirm
in scripted runs. ATW will not modify your compose file without explicit
confirmation.

On completion a status-aware end-of-run summary names every phase that
did not finish cleanly. The status taxonomy:

| Status            | Meaning                                                          |
|-------------------|------------------------------------------------------------------|
| `success`         | Phase ran and produced its artifacts.                            |
| `success_cached`  | Inputs and `model_snapshot` matched a prior successful run; phase short-circuited. |
| `warning`         | Phase finished with non-fatal issues (e.g., partial enrichment failures). |
| `skipped`         | Phase declined to run (missing input, integrator declined `[y/N]`, flag like `--no-enrich`). |
| `failed`          | Phase aborted; build cannot proceed without remediation.         |
| `not_run`         | Phase reached but skipped because of an earlier abort.           |

`✅ Build complete.` only prints when **every** phase ended in `success`
or `success_cached`. Otherwise the summary lists each phase with its
status, the reason, and a dynamic `next_hint` pointing at the actual
next required command. Full detail lives in
`.atw/artifacts/build-provenance.json` (per-phase log, append-only) and
`.atw/state/build-manifest.json` (legacy single-run audit trail).

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

# Quickstart: Build Pipeline (Feature 002)

**Feature**: Build Pipeline
**Plan**: [plan.md](./plan.md)
**Spec**: [spec.md](./spec.md)
**Audience**: a Builder who has completed Feature 001 and is ready to
turn their markdown artifacts into a running local backend.

This is the Builder-facing happy path from a clean checkout to a
running, enriched local system. It doubles as the Principle VIII
reproducibility baseline and the `tests/integration/build-full-flow.test.ts`
integration path.

---

## 0. Prerequisites

| Tool            | Minimum version | Notes                                                        |
|-----------------|-----------------|--------------------------------------------------------------|
| Node.js         | 20 LTS          | `.nvmrc` pins it. Use `nvm use` if you have nvm.             |
| Docker          | 24+             | Docker Desktop on macOS / Windows, Docker Engine on Linux.   |
| Claude Code     | current         | The CLI that exposes the `/atw.build` slash command.         |
| Anthropic key   | —               | `export ANTHROPIC_API_KEY=sk-ant-...` in your shell.         |

Total estimated cost for a full Aurelia run: **$12–14** (measured in
research; budget-sized).

Total estimated wall-clock: **14–18 minutes** on the reference CI
runner (GitHub Actions `ubuntu-latest`, 4-core / 16 GB / SSD).

---

## 1. Start from a project that completed Feature 001

Expected layout in the Builder's project:

```text
my-agent/
├── .atw/
│   ├── config/
│   │   ├── project.md          # written by /atw.init
│   │   └── brief.md            # written by /atw.brief
│   ├── artifacts/
│   │   ├── schema-map.md       # written by /atw.schema
│   │   ├── action-manifest.md  # written by /atw.api
│   │   └── build-plan.md       # written by /atw.plan
│   ├── inputs/
│   │   └── aurelia-schema-with-data.sql    # Builder-provided SQL dump
│   └── state/
│       └── input-hashes.json
├── .claude/
│   └── commands/
│       ├── atw.init.md
│       ├── atw.brief.md
│       ├── atw.schema.md
│       ├── atw.api.md
│       ├── atw.plan.md
│       └── atw.build.md        # NEW — installed by Feature 001 once Feature 002 lands
├── docker-compose.yml          # ATW block still commented out at this point
└── README-atw.md
```

If any of the five `.atw/` artifacts are missing, `/atw.build` will
halt and tell you which prior command to run — don't try to work
around it.

---

## 2. Run `/atw.build`

Inside Claude Code:

```text
/atw.build
```

You'll see the plan summary:

```text
AI to Widget — build plan

  Project           : Aurelia Beauty
  Entities to index : 342 (product: 182, variant: 112, collection: 28, region: 20)
  Opus model        : claude-opus-4-7
  Concurrency       : 10
  Postgres image    : pgvector/pgvector:pg16 (port 5433)
  Embedding model   : Xenova/bge-small-multilingual-v1.5 (384 dim)

  Estimated cost    : $12.50
  Estimated time    : 14–18 minutes

  Outputs           :
    backend/src/*.ts
    dist/widget.js, dist/widget.css
    atw_backend:latest (Docker image)

Proceed? [y/N]
```

Type `y` and press enter.

---

## 3. Watch the pipeline

The command streams progress lines at least every five entities or
every ten seconds. A typical session looks like:

```text
[BOOT]    Starting atw_postgres (pgvector/pgvector:pg16) on :5433 ... ready
[MIGRATE] Applying 3 migrations ... 001_init ✓  002_atw_documents ✓  003_hnsw_index ✓
[IMPORT]  Filtering dump → client_ref (2/12 tables excluded as PII) ... 342 rows imported
[ENRICH]  342 entities to enrich @ concurrency 10

[ENRICH]   50/342   ✓  48  ⊙  0  ✗  2   $1.89   01:12 elapsed   ETA 07:04
[ENRICH]  100/342   ✓  97  ⊙  0  ✗  3   $3.71   02:24 elapsed   ETA 05:48
...
[ENRICH]  342/342   ✓ 327  ⊙  0  ✗ 15   $12.31  15:38 elapsed   done

[RENDER]  backend/src: 5 files (0 unchanged, 5 rewritten)
[BUNDLE]  dist/widget.js (74 KB), dist/widget.css (3 KB)
[IMAGE]   Building atw_backend:latest (multi-stage, 284 MB) ... done
[SCAN]    PII compliance scan (342 rows × 7 columns) ... clean ✓
[DONE]    2026-04-22 14:47:11 — $12.31 actual (estimated $12.50, -1.5 %)
```

The fifteen failed entities (`✗ 15`) are recorded in
`.atw/state/build-manifest.json`'s `failures[]` — they had
insufficient source data and were flagged, not silently dropped.

---

## 4. Verify the output

```bash
# atw_documents populated
docker exec -it atw_postgres psql -U postgres -c \
  "SELECT entity_type, COUNT(*) FROM atw_documents GROUP BY entity_type;"

# Image built
docker image inspect atw_backend:latest --format '{{.Size}}'

# Widget bundle exists
ls -la dist/widget.js dist/widget.css

# Manifest written
jq '.result, .totals, .opus.cost_usd' .atw/state/build-manifest.json
```

Expected:

```text
 entity_type | count
-------------+-------
 collection  |    28
 product     | 170    (12 flagged + some empties skipped)
 region      |    20
 variant     | 109

 284013312

 -rw-r--r--  1 you  staff  74218 Apr 22 14:47 dist/widget.js
 -rw-r--r--  1 you  staff   3210 Apr 22 14:47 dist/widget.css

"success"
{
  "total_entities": 342,
  "enriched": 327,
  "skipped_unchanged": 0,
  "failed": 15
}
12.31
```

---

## 5. Re-run on unchanged inputs (SC-013)

```text
/atw.build
```

Expect:

```text
AI to Widget — nothing to do

  Inputs unchanged since the last build at 2026-04-22 14:47.
  No Opus calls will be made.

  (pass --force to re-enrich every entity, or edit an artifact.)
```

Wall-clock: < 30 seconds. Opus calls: 0. No writes except a fresh
`build-manifest.json` stamped with `"nothing-to-do"` and zero opus
cost.

---

## 6. Incremental rebuild (SC-013 variant)

Edit `.atw/artifacts/action-manifest.md` (e.g. toggle one endpoint),
then re-run:

```text
/atw.build
```

Only template rendering and the image rebuild happen — enrichment
is skipped because neither `brief.md`, `schema-map.md`, nor
`client_ref` changed. Wall-clock: < 2 minutes.

---

## 7. Resumability (SC-015)

Kill a mid-enrichment run with Ctrl+C around 30 % progress:

```text
[ENRICH]  107/342   ...    Aborting — letting 7 in-flight Opus calls complete so their cost is not wasted ...
[DONE]    result = "aborted", $3.54 spent, resume with /atw.build
```

Re-run `/atw.build`. The second run recognizes the 114 already-indexed
entities via `source_hash` and enriches only the remaining 228.
Total Opus cost across both runs is within 5 % of a single
uninterrupted run.

---

## 8. Interpret the manifest

`.atw/state/build-manifest.json` is the full audit trail. Inspect
it any time:

```bash
jq '.failures' .atw/state/build-manifest.json
jq '.opus' .atw/state/build-manifest.json
jq '.environment' .atw/state/build-manifest.json
```

The contract shape is at [contracts/manifest.md](./contracts/manifest.md).
Schema version is `"1"`.

---

## 9. Clean reset

To wipe the build completely and start fresh (development use only):

```bash
docker compose down -v                      # stops containers, removes volume
rm -rf dist/ backend/src/*.ts               # remove rendered outputs
rm -f .atw/state/build-manifest.json        # clear manifest
rm -f .atw/state/input-hashes.json          # clear hashes (force full re-run)
docker image rm atw_backend:latest
```

Then re-run `/atw.build` from scratch.

---

## 10. Cross-platform notes

- **macOS / Linux.** Works out of the box with Docker + Node 20.
- **Windows.** Use WSL2 for both Docker and the shell. Docker
  Desktop's WSL2 integration is required; the Linux-side Docker
  daemon is what `dockerode` talks to.
- **Paths.** Every path in `build-manifest.json` is relative to the
  project root. Absolute paths never appear — they would leak host
  layout and break reproducibility.

---

## 11. When things go wrong

| Symptom                                                    | Remedy                                                                      |
|------------------------------------------------------------|-----------------------------------------------------------------------------|
| `Docker daemon is not reachable.`                          | Start Docker Desktop / `sudo systemctl start docker`.                        |
| `Port 5433 is in use.`                                     | `/atw.build --postgres-port 5434` or free the port.                         |
| `Anthropic API authentication failed.`                     | `export ANTHROPIC_API_KEY=sk-ant-...` and re-run.                            |
| `Missing .atw/artifacts/build-plan.md.`                    | Run `/atw.plan` first.                                                      |
| `Compliance scan failed: PII value ... appears in facts.`  | Open `build-manifest.json → compliance_scan.matches`; fix the PII leak in your enrichment prompt or schema-map and re-run. |
| `Anthropic rate limits exhausted even at concurrency=3.`   | Wait a few minutes, or request higher limits from Anthropic.                |
| `A prior migration's on-disk file was edited.`             | Never edit applied migrations. Create a new one that forwards the schema.   |
| Enrichment cost much higher than estimated.                | Check manifest `opus.cost_variance_pct`. Usually caused by a schema with more related rows than the estimator expected; file a note in `post-impl-notes.md`. |

---

## 12. Principle VIII reproducibility

This quickstart is the authoritative reproducibility path. CI runs it
end-to-end on `ubuntu-latest` against the Aurelia fixture (with Opus
stubbed to fixture responses). macOS and WSL2 runs the quickstart
manually before each release to verify cross-platform parity.

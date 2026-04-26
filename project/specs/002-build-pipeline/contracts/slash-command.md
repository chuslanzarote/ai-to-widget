# Contract: `/atw.build` slash command

**Feature**: Build Pipeline (Feature 002)
**Date**: 2026-04-22
**Source**: `commands/atw.build.md` (copied into the Builder's
`.claude/commands/` by the Feature 001 installer)

This contract fixes the input surface, flag semantics, confirmation
gate, progress stream shape, exit conditions, and failure modes for the
single `/atw.build` slash command. It is the contract the command
markdown file MUST honor and that integration tests MUST exercise.

---

## 1. Input surface

### 1.1 Invocation

The Builder invokes `/atw.build` in Claude Code. The command accepts
zero or more of the following flags:

| Flag                  | Type     | Default | Purpose                                                        |
|-----------------------|----------|---------|----------------------------------------------------------------|
| `--concurrency <n>`   | integer  | 10      | Maximum concurrent Opus calls. Must be ≥ 1.                    |
| `--force`             | boolean  | false   | Re-enrich every entity regardless of `source_hash` match. Re-enrichment scope only — DB / volume / cache untouched (Clarifications Q2). |
| `--entities-only`     | boolean  | false   | Run only the enrichment phase; skip template rendering, widget bundle, and image build. |
| `--no-enrich`         | boolean  | false   | Skip enrichment entirely; run only template rendering, bundle, and image build. |
| `--dry-run`           | boolean  | false   | Run validation and plan summary, then exit without writing anything. |
| `--backup`            | boolean  | false   | When overwriting a rendered backend file whose content differs from the template output, write a `.bak` sibling first. |
| `--postgres-port <n>` | integer  | 5433    | Override the Postgres container's host-side port.              |

Mutually exclusive combinations halt immediately with a one-line
diagnostic:

- `--entities-only` + `--no-enrich` — meaningless (both halves are off).
- `--dry-run` + `--force` — `--force` has no effect under `--dry-run`
  (warn, then proceed with `--dry-run` semantics).

### 1.2 Prerequisites

Before any container, migration, or Opus call, the command MUST
validate that all five Feature 001 artifacts exist under `.atw/`:

- `.atw/config/project.md`
- `.atw/config/brief.md`
- `.atw/artifacts/schema-map.md`
- `.atw/artifacts/action-manifest.md`
- `.atw/artifacts/build-plan.md`

Any missing artifact triggers a halt naming the prior command the
Builder must run (FR-053). Likewise, the command MUST verify at least
one `.sql` or `.sql.gz` file exists under `.atw/inputs/`.

### 1.3 Environment

- `ANTHROPIC_API_KEY` — required for any build that performs enrichment.
  Missing or invalid triggers the auth-halt path (FR-085).
- `DOCKER_HOST` or the default Docker socket — required. The command
  probes reachability before the plan summary.

---

## 2. Plan summary (confirmation gate)

After validation and before any work, the command prints:

```text
AI to Widget — build plan

  Project           : <project.name from project.md>
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

The command MUST NOT execute any step that writes to disk, a container,
or Anthropic until the Builder types `y`, `yes`, or (equivalent). A
plain return or `N` exits cleanly with zero side effects.

Under `--dry-run`, the prompt is skipped and the command exits 0 after
printing the summary.

---

## 3. Progress stream

Once the Builder confirms, the command streams progress lines. The
minimum cadence is **every 5 entities or every 10 seconds, whichever
comes first**. Each progress event matches `PipelineProgress`
([data-model.md §3.4](../data-model.md)).

Rendered line example:

```text
[ENRICH] 127/342   ✓ 122  ⊙ 4  ✗ 1   $4.71   05:22 elapsed   ETA 09:13
```

`✓` enriched, `⊙` skipped-unchanged, `✗` failed. Running cost is
cumulative Opus spend. ETA is based on rolling average throughput.

Phase transitions produce a single-line banner:

```text
[BOOT]    Starting atw_postgres (pgvector/pgvector:pg16) on :5433 ...
[MIGRATE] Applying 3 migrations ...
[IMPORT]  Filtering dump → client_ref (2/12 tables excluded as PII) ...
[ENRICH]  327 entities to enrich @ concurrency 10 ...
[RENDER]  backend/src: 5 files (3 unchanged, 2 rewritten) ...
[BUNDLE]  dist/widget.js (74 KB), dist/widget.css (3 KB) ...
[IMAGE]   Building atw_backend:latest (multi-stage, 284 MB) ...
[SCAN]    PII compliance scan (342 rows × 7 columns) ... clean ✓
[DONE]    2026-04-22 14:47:11 — $12.31 actual (estimated $12.50, -1.5 %)
```

---

## 4. Exit codes and result classes

| Exit | Result      | Meaning                                                                  |
|------|-------------|--------------------------------------------------------------------------|
| 0    | `success`   | All entities enriched (or skipped-unchanged), all outputs written, scan clean. |
| 0    | `nothing-to-do` | All inputs unchanged; completed in < 30 s with zero Opus calls.       |
| 1    | `partial`   | Build completed but one or more entities were flagged (≥ 1 failure in manifest). |
| 2    | `aborted`   | Ctrl+C received; in-flight responses validated and upserted; manifest written. |
| 3    | `failed`    | Fatal error (auth, Docker down, migration error, PII scan positive) — halt early. |

In all cases the manifest at `.atw/state/build-manifest.json` is
written atomically before exit, with `result` set accordingly.

---

## 5. Failure modes and diagnostics

Every failure MUST surface a one-line Builder-facing diagnostic,
followed by a pointer to the manifest or log for details. No bare stack
traces (FR-043, FR-085, FR-086).

| Failure                         | Diagnostic                                                                                                     | Exit  |
|---------------------------------|----------------------------------------------------------------------------------------------------------------|-------|
| Docker not reachable            | `Docker daemon is not reachable. Start Docker Desktop (or your Docker service) and try again.`                  | 3     |
| Port 5433 in use                | `Port 5433 is in use by another process. Pass --postgres-port <n> to pick a different port.`                    | 3     |
| Missing artifact (e.g. brief.md)| `Missing .atw/config/brief.md. Run /atw.brief first.`                                                           | 3     |
| `ANTHROPIC_API_KEY` unset/401   | `Anthropic API authentication failed. Set ANTHROPIC_API_KEY in your shell environment and re-run /atw.build.`    | 3     |
| Sustained 429 after auto-reduce | `Anthropic rate limits exhausted even at concurrency=3. Wait a few minutes or raise your account limits.`        | 3     |
| PII value found in enrichment   | `Compliance scan failed: PII value from client_ref.customer.email appears in enriched text. See build-manifest.json.` | 3 |
| Opus 400 for a single entity    | warn on the progress line, flag the entity in `build-manifest.failures`, continue with the remaining entities. | 1     |
| Opus network timeout            | retry once per the HTTP 5xx policy; if still failing, flag the entity and continue.                           | 1     |
| Ctrl+C                          | `Aborting — letting 7 in-flight Opus calls complete so their cost is not wasted ...`                            | 2     |

---

## 6. Interruption boundary (FR-083)

On SIGINT:

1. Stop scheduling new Opus calls immediately.
2. Let in-flight Opus responses complete normally (their cost is paid).
3. Run each completed response through the validator; upsert if valid,
   flag if not.
4. Skip the remaining pipeline phases (render / bundle / image / scan).
5. Write `build-manifest.json` with `result = "aborted"`.
6. Exit with code 2.

No partial row is ever written to `atw_documents`. The next
`/atw.build` picks up from exactly the right place via `source_hash`.

---

## 7. `--dry-run` semantics (FR-056)

Under `--dry-run` the command MUST:

1. Run the full artifact validation (FR-053).
2. Probe Docker reachability and `ANTHROPIC_API_KEY` presence (warn
   only — do not halt).
3. Print the plan summary from §2.
4. Exit 0 without issuing any Opus call, starting any container,
   writing any file, or building any image.

`--dry-run` is a safety pressure valve: the Builder can check the plan
summary on every invocation without risking side effects.

---

## 8. What the command MUST NOT do

- MUST NOT accept or prompt for a DSN.
- MUST NOT write any file before the Builder confirms the plan (§2).
- MUST NOT bake `ANTHROPIC_API_KEY` (or any other secret) into the
  image (FR-077).
- MUST NOT leave a partial row in `atw_documents` under any
  interruption.
- MUST NOT silently skip a failed entity without recording it in the
  manifest.
- MUST NOT phone home to any host other than the three listed in §1.3
  (Anthropic, Docker, embedding model registry on first-run).

---

## 9. Contract tests

The integration tests under `tests/integration/build-*.test.ts`
collectively cover the contract above:

- `build-full-flow.test.ts` — §2, §3, §4 success path on the Aurelia
  fixture.
- `build-resumability.test.ts` — §6 SIGINT + resume.
- `build-incremental.test.ts` — §4 `nothing-to-do` short-circuit.
- `build-determinism.test.ts` — SC-016 byte-identical outputs.
- `build-pii-scan.test.ts` — §5 compliance-scan failure path.
- `build-docker-down.test.ts` — §5 Docker-unreachable path.
- `build-auth-failure.test.ts` — §5 missing `ANTHROPIC_API_KEY` path.
- `build-force-flag.test.ts` — §1.1 `--force` scope (Clarifications Q2).

---

## 10. Principle compliance

- **I.** §1.3 forbids DSN input. §5 + §8 forbid secret baking.
- **IV.** §2 confirmation gate; §7 dry-run escape hatch.
- **V.** Delegated to the enrichment contract (`enrichment.md`), but
  §6 ensures interruption never corrupts anchored rows.
- **VIII.** §2 plan summary names pinned images and model versions.

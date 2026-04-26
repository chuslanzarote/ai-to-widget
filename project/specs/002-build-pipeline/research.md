# Research: Build Pipeline (Feature 002)

**Feature**: Build Pipeline
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-22

This document records the technology and approach decisions the plan
depends on. Every section follows the Decision / Rationale / Alternatives
format. Each decision cites the principle(s) that informed it.

---

## 1. Anthropic SDK choice for Opus enrichment

**Decision.** `@anthropic-ai/sdk` (official JS/TS SDK).

**Rationale.** First-party, TypeScript-native, supports streaming and
structured tool-use, ships typed error classes for HTTP 429 / 5xx / 401 /
400 so the backoff logic in FR-069 is straightforward to type-match.
Introduces zero new transitive risk — Anthropic publishes and signs the
package.

**Alternatives considered.**

- `openai` or `litellm-js` style multi-provider wrappers — add complexity
  for no benefit; we call one model.
- Raw `fetch` — feasible but means re-implementing retry, streaming, and
  usage-token accounting. The SDK gives all three.
- LangChain / LlamaIndex — flagged out by Principle IX and the
  constitution's Complexity Justification section.

**Principle.** IX (Opus as a Tool), VII (Single Ecosystem).

---

## 2. Embedding model & inference runtime

**Decision.** `@xenova/transformers` with the
`Xenova/bge-small-multilingual-v1.5` model (384-dim, multilingual,
1.0.0 pinned release). Run on CPU in-process, cached under
`~/.cache/atw/models/`.

**Rationale.** ONNX-ported sentence-transformers model that runs in pure
JS/TS via `onnxruntime-node`. No Python required (Principle VII). The
multilingual variant handles Spanish and Portuguese catalog data without
per-language tuning. 384 dimensions is the sweet spot for pgvector HNSW
index size and query latency at our scale. The model is ~90 MB
uncompressed and is pre-baked into `atw_backend:latest` so runtime
containers start without a first-call download (FR-077).

**Determinism.** `@xenova/transformers` honors a fixed `seed` and uses
the CPU ONNX backend by default; with `session_options.graphOptimization
Level = 'all'`, the same input text produces a bit-identical output
vector across runs on the same platform, satisfying FR-063. Cross-platform
determinism (Linux vs macOS vs Windows) is weaker by 1–2 ULPs in some
dimensions; we accept this because retrieval quality is unaffected at
the 1e-6 scale and the backend always embeds at runtime against the same
image layer the build produced, so production queries and indexed
documents are guaranteed to share a platform.

**Alternatives considered.**

- Python `sentence-transformers` via subprocess — ruled out by Principle
  VII.
- OpenAI / Cohere embedding APIs — introduce a second external
  dependency, network cost per query, and a non-local retrieval path
  that conflicts with User Data Sovereignty.
- Larger models (`bge-large`, `e5-large`) — 1024 dims inflate index size
  and retrieval latency without meaningful quality gain on product
  catalog data.
- MiniLM (384-dim, English-only) — monolingual quality cliff for
  non-English catalogs.

**Principle.** VII (Single Ecosystem), I (User Data Sovereignty —
embeddings stay local), VIII (Reproducibility — pinned SHA).

---

## 3. Postgres + pgvector container image and pin

**Decision.** `pgvector/pgvector:pg16` tagged at the latest immutable
digest at ratification time, captured in `build-plan.md`'s `runtime`
block and surfaced in `docker-compose.yml`.

**Rationale.** Official pgvector-maintained image bundling Postgres 16
with a compatible pgvector build. Pinning by digest (not floating tag)
is what Principle VIII requires. pgvector 0.7+ supports HNSW which is
essential for retrieval latency at our scale.

**Alternatives considered.**

- `postgres:16` + manual `CREATE EXTENSION vector` with a build-time
  install step — adds a Dockerfile stage and fails in air-gapped
  environments. The pgvector image already did the work.
- Qdrant / Weaviate / Pinecone — explicitly flagged out by Principle
  VII.

**Principle.** VII, VIII.

---

## 4. Docker daemon interaction

**Decision.** `dockerode` (typed Node client for the Docker API).

**Rationale.** No shell-out to `docker` CLI (which would make cross-platform
error handling painful and introduce WSL2 path-mapping issues on Windows).
`dockerode` is widely used, maintained, and handles the Engine API on
Linux sockets, Docker Desktop on macOS and Windows, and WSL2 equivalently.

**Alternatives considered.**

- `execa` + `docker ...` CLI — shell-escaping, path-mapping, and
  cross-platform error parsing add net complexity.
- `testcontainers` for *both* build orchestration and tests — mismatches
  concerns; `testcontainers` is for ephemeral test containers, not long-
  lived user-facing ones.

**Principle.** VI (Composable Deterministic Primitives), VIII.

---

## 5. Backend template renderer

**Decision.** Handlebars. One `.hbs` per rendered file under
`packages/backend/src/`. Atomic write via `write-file-atomic`. Idempotency
check: read the target file, compute normalized-LF SHA-256, skip write
if equal; write `.bak` sibling (when `--backup`) if different.

**Rationale.** Handlebars is tiny, has first-class TypeScript types, and
its template surface is intentionally small — no code injection, no
logic beyond simple conditionals and iteration. That matches the
auditability requirement under US-008 and Principle VI. Output is
deterministic given identical inputs (no implicit Date, no random).

**Alternatives considered.**

- EJS — permits embedded JavaScript, which is exactly the surface
  Principle VI rules out for generated code.
- String concatenation / template literals — fast to write, hard to
  maintain as templates grow.
- Code-gen DSLs (plop, hygen) — heavier frameworks that bring their own
  workflow conventions on top.

**Principle.** VI, VIII, IV (auditable generated code per US-008).

---

## 6. Widget bundling

**Decision.** `esbuild`. Single invocation: `bundle: true`, `format:
'iife'`, `platform: 'browser'`, `target: 'es2020'`, `minify: true`,
`sourcemap: 'external'`. Output `dist/widget.js` + `dist/widget.css`.

**Rationale.** Fastest JS bundler in the single-ecosystem category. Ships
a single binary per platform. Supports CSS import graphs out of the box,
which the widget CSS pipeline needs. Deterministic output under a
pinned version.

**Alternatives considered.**

- Rollup — great output, but extra plugin ecosystem for CSS and TS that
  esbuild handles natively.
- Vite — brings a dev server and HMR we don't need for a one-file IIFE
  build.
- Parcel — implicit config and zero-config magic make reproducibility
  harder to guarantee.

**Principle.** VI, VII, VIII.

---

## 7. Concurrency control for Opus enrichment

**Decision.** `p-limit` semaphore, default 10, configurable via
`--concurrency` (FR-071). Auto-reduce to 3 on sustained 429 responses
(FR-070). Halt on continued 429 after reduction.

**Rationale.** Lightweight, zero-dep semaphore primitive. Fits the
"bounded parallelism + backoff" pattern Anthropic's published guidance
recommends. The auto-reduction path preserves forward progress on tight
accounts without requiring Builder intervention.

**Alternatives considered.**

- `async`'s `queue` or `eachLimit` — functionally equivalent but heavier
  dependency footprint.
- Rolling-window rate limiter (token bucket) — overkill; Anthropic's
  own 429 backoff is the authoritative signal.
- Fixed-concurrency-1 (serial) — safest but makes SC-012's 20-minute
  target hard to hit on the Aurelia fixture (~342 entities at ~2 s per
  enrichment round-trip = ~11 minutes serial before other work; we need
  headroom).

**Principle.** III (Idempotent & Interruptible), IX (Opus as a Tool —
budget discipline via bounded parallelism).

---

## 8. Migration strategy

**Decision.** Hand-rolled SQL migrations under
`packages/scripts/src/migrations/`, applied by
`apply-migrations.ts` with an idempotent `atw_migrations` table tracking
`(id, filename, applied_at, sha256)`. Three migrations ship in V1:
`001_init.sql` (extensions, `client_ref` schema, migrations table),
`002_atw_documents.sql` (table + indexes), `003_hnsw_index.sql`
(HNSW index creation — separate file because `CREATE INDEX CONCURRENTLY`
on a large table is slow and we want the option of running it out-of-band
in future versions).

**Rationale.** `node-pg-migrate`, `umzug`, and friends would add a
dependency and a conventions-framework layer for four SQL files. The
migration surface for AI to Widget is small enough that a 150-line
runner with a checksum table is clearer, easier to audit, and easier to
reproduce cross-platform.

**Alternatives considered.**

- `node-pg-migrate` — mature but opinionated on directory layout and
  env-var conventions; brings a CLI that overlaps with our `atw-`
  shims.
- `prisma migrate` — requires a Prisma schema, which we don't otherwise
  need; conflicts with the "deterministic primitives" principle.
- No migrations table, idempotent CREATE IF NOT EXISTS — works for V1
  but forecloses schema evolution for V2 without a rewrite.

**Principle.** VI, VII.

---

## 9. `client_ref` schema import strategy

**Decision.** Import the Builder's SQL dump into a dedicated
`client_ref` schema using a filtered `psql` replay orchestrated from
`import-dump.ts`. Filtering is done by pre-processing the dump text
(stripping statements that touch tables *not* in `schema-map.md`'s
primary/related lists, and any tables explicitly flagged PII-excluded)
before feeding it to `psql`. Postgres extensions the base image doesn't
have are warned and skipped.

**Rationale.** `pg_dump` output is line-oriented and easy to filter
textually (COPY / INSERT blocks are delimited). Doing the filtering in
our own code keeps PII exclusion under our test surface (FR-059) rather
than trusting Postgres's own `REVOKE`/`GRANT` machinery. The `client_ref`
schema means all imported data is quarantined under one namespace we
control — we can `DROP SCHEMA client_ref CASCADE` to reset, and our
`atw_documents` / `atw_migrations` tables live outside it so a
`client_ref` drop never touches our own state.

**Alternatives considered.**

- `pg_restore --table` filtering — works for custom-format dumps but
  not for plain-text dumps, and we can't require the Builder to run
  `pg_dump -Fc` specifically.
- Import everything into `public`, trust per-table PII exclusion at
  read time — violates Principle I's "PII exclusion by design, not by
  convention" stance.
- Build a full SQL AST parser to filter statements robustly — over-
  engineered; `pgsql-ast-parser` (already in the repo for Feature 001)
  can be used for the few edge cases the text filter misses.

**Principle.** I, VI.

---

## 10. Enrichment validator rules

**Decision.** The validator (`enrichment-validator.ts`) rejects an Opus
response when any of the following hold:

1. The response is not valid JSON matching the zod schema from
   `contracts/enrichment.md`.
2. `document` is empty or < 40 characters (likely refusal).
3. Any entry in `facts` lacks a non-empty `claim` or a non-empty
   `source`.
4. Any `fact.source` string does not appear as a key in the flattened
   assembled input JSON.
5. Any entry in `categories` uses a label not declared in the
   `build-plan.md` vocabulary for that entity type.
6. Top-level shape returns `{"insufficient_data": true}` — this is a
   valid refusal per Principle V but causes the entity to be flagged
   and skipped, not retried.

Rule 4 is the Principle V core. It implements anchoring as a structural
invariant rather than a prompt hope.

**Rationale.** Source-existence is the only check that directly
catches hallucination; the other four are shape integrity. Category
vocabulary enforcement is SC-009's spiritual successor from Feature 001
and ensures retrieval filters match the indexed labels.

**Alternatives considered.**

- Trust the prompt alone — historically unreliable; we need the structural
  gate.
- Fuzzy source matching (Levenshtein) — opens up false positives when
  Opus paraphrases a column name; exact key-match is strict and that's
  what Principle V demands.

**Principle.** V (red line), VI.

---

## 11. `source_hash` construction

**Decision.** SHA-256 over the concatenation of
(a) the UTF-8 JSON canonicalization of the assembled input (sorted keys,
no whitespace), (b) the literal prompt-template version string (bumped
when the prompt text changes), and (c) the enrichment model identifier
(`claude-opus-4-7`). Stored on every `atw_documents` row. Re-enrichment
is gated by `source_hash` match unless `--force` is supplied.

**Rationale.** Canonicalization removes spurious key-order / whitespace
variance. Including the prompt version means a prompt edit invalidates
stale rows and forces re-anchoring — which Principle V mandates.
Including the model identifier future-proofs against model-version
changes that could alter enrichment characteristics.

**Alternatives considered.**

- Hash the raw JSON string as produced — key-order non-determinism
  would cause false re-enrichment.
- Hash only the assembled input — a prompt-rules tightening would
  silently ship, violating Principle V's "every claim cites a source".
- SHA-1 — lower collision resistance; no reason to choose it when SHA-256
  is already used elsewhere (`hash-inputs.ts`, Feature 001).

**Principle.** III, V, VIII.

---

## 12. Image build approach

**Decision.** Multi-stage Dockerfile under `packages/backend/Dockerfile`:

1. `FROM node:20-alpine AS builder` — install deps, compile TypeScript,
   bundle.
2. `FROM node:20-alpine AS runtime` — copy only the compiled output and
   production dependencies, copy the pre-cached embedding model into
   `/app/.model-cache`, run as non-root.

Built via `dockerode` from `build-backend-image.ts`. No shell-out. No
`ANTHROPIC_API_KEY` baked in — runtime env injection only.

**Rationale.** Alpine keeps the image small (~300 MB target). Multi-stage
excludes devDependencies and compilation residue. Shipping the model in
the image removes the first-call download latency Feature 003 would
otherwise face. Non-root user is standard hardening; the backend has
no reason to run privileged.

**Alternatives considered.**

- Distroless (`gcr.io/distroless/nodejs20`) — smaller still but
  awkward for debugging; Alpine's shell is worth the 20 MB.
- Mount the model from a Docker volume instead of baking — breaks the
  Principle VIII reproducibility promise that `docker compose up`
  works without a post-clone step.
- `@xenova/transformers` first-call download at runtime — measured
  ~20 s cold-start, unacceptable for an end-user-facing widget.

**Principle.** VII, VIII.

---

## 13. Testing strategy and containerized integration tests

**Decision.** Three vitest tiers (see plan.md). Integration tests spin
up a disposable Postgres via `testcontainers` in a `beforeAll` hook,
stub Anthropic calls against a local HTTP mock server that replays
fixture responses from `tests/fixtures/aurelia/opus-responses/`. One
opt-in real-Opus smoke test runs behind `ATW_E2E_REAL_OPUS=1`.

**Rationale.** Real Postgres (not pg-mem) because pgvector functions
aren't stubbable — any mock would diverge. `testcontainers` handles
container lifecycle cross-platform. Anthropic stubbing is necessary
because the CI matrix cannot carry a real API key; the opt-in real-Opus
test exists so a human can sanity-check end-to-end before release.

**Alternatives considered.**

- Shared long-lived Postgres for all tests — creates order-dependent
  flakiness.
- pg-mem — doesn't implement pgvector.
- Nock for Anthropic stubbing — works but a dedicated mock server is
  clearer when multiple tests replay multi-response streams.

**Principle.** VIII.

---

## 14. Compliance scan match semantics (Clarifications Q1)

**Decision.** Case-insensitive substring match after whitespace
normalization (trim + collapse internal whitespace), applied to every
PII value from PII-flagged columns in `schema-map.md` against every
`atw_documents.document` and `atw_documents.facts` JSON-stringified
text. Implementation lives in `scan-pii-leaks.ts` and fails the build
with a full `(entity_id, pii_column, matched_snippet)` triple list.

**Rationale.** Per Clarifications session Q1 (2026-04-22). Prioritizes
Principle I recall over precision — false positives halt the build with
an actionable diagnostic the Builder can resolve; false negatives leak
PII and are unacceptable. Substring + case-insensitive catches Opus
paraphrasings that a token-exact match would miss.

**Alternatives considered.** See Clarifications Q1 options B / C / D.

**Principle.** I (red line).

---

## 15. `--force` scope (Clarifications Q2)

**Decision.** `--force` re-enriches every entity regardless of
`source_hash` match. It does **not** drop migrations, re-import the
dump, invalidate the embedding cache, delete the Docker volume, or
bypass image-layer caching. Destructive resets are left to future
opt-in flags.

**Rationale.** Per Clarifications session Q2 (2026-04-22). The narrow
reading of FR-065 + FR-052; the safest default; avoids a Builder who
wanted "re-enrich one more time" from nuking their Postgres volume.

**Alternatives considered.** See Clarifications Q2 options B / C / D.

**Principle.** IV (Builder stays in control; surprise destruction ruled
out).

---

## 16. Reference hardware baseline (Clarifications Q3)

**Decision.** GitHub Actions `ubuntu-latest` runner (4-core / 16 GB
RAM / SSD) is the reference hardware against which SC-012 and SC-019
are measured.

**Rationale.** Per Clarifications session Q3 (2026-04-22). Turns
previously vague "modern developer laptop" wording into a CI-verifiable
baseline anyone can reproduce. Also the hardware class used by Feature
001's CI matrix, so no new rigging is needed. Builder laptops are
expected to be at least as fast.

**Alternatives considered.** See Clarifications Q3 options A / C / D.

**Principle.** VIII.

---

## Summary

All NEEDS CLARIFICATION items from Technical Context are resolved. No
new ecosystem is introduced. Every dependency is pure TypeScript /
pre-built ONNX binary. The constitution's red-line principles (I, V,
VIII) all have structural enforcement in the pipeline design — not
prompt hopes or review conventions. The plan is ready for Phase 1
design.

# Phase 0 Research: Setup Flow (Feature 001)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-04-21

This document records every technical decision required before Phase 1
design can proceed. Each item resolves a NEEDS CLARIFICATION-class
question or a dependency-choice / integration-pattern question surfaced
by the Technical Context. The spec deferred only one such item to the
plan phase (installer distribution channel); the rest are introduced
here because they are internal to implementation, not to requirements.

---

## 1. Installer distribution channel — resolved

**Decision.** Publish the installer package as `create-atw` on npm. The
Builder's documented command becomes:

```
npx create-atw@latest <target-directory>
```

**Rationale.**
- Matches the exact UX in `001-setup-flow.md` §3 ("the Builder's mental
  model"), which the constitution pins as the canonical flow.
- `npx create-*` is the industry-standard pattern for project scaffolders
  (`create-react-app`, `create-t3-app`, `create-next-app`). Builders
  recognize it instantly; no README preamble is needed.
- Version pinning via `@latest` gives deterministic installer behavior
  for the demo without forcing the Builder to clone the repo first —
  satisfies Principle VIII (Reproducibility).
- Claude Code hackathon judges evaluate the demo against a tight
  timeline; `npx` beats `git clone && npm install && node install.js`
  every time.

**Alternatives considered.**
- **Clone-and-run script.** Rejected. Adds a `git clone` step to the
  quickstart, breaks the pattern the source doc's §3 promises, and
  makes hackathon evaluation slower. Kept internally only as the
  development-mode entry (`npm run dev:install` from the monorepo
  checkout).
- **Global npm install (`npm i -g create-atw`).** Rejected. `npx` avoids
  asking Builders to manage a global binary; each invocation uses the
  pinned latest.
- **Standalone binary (pkg, bun compile).** Rejected. Adds a second build
  pipeline for no Builder-side benefit; Principle VII argues against.

**Implications for code.** The `@atw/installer` package has `"bin": {
"create-atw": "./bin/create-atw.js" }` and publishes under the name
`create-atw`. The repo keeps `@atw/installer` as the internal workspace
name to avoid confusion with the public package.

---

## 2. SQL parser for `pg_dump --schema-only` — resolved

**Decision.** Use `pgsql-ast-parser` (Postgres-specific, pure JavaScript
port of the libpg parser).

**Rationale.**
- `pg_dump` output includes Postgres-specific syntax: `CREATE EXTENSION`,
  inherited tables, serial columns, `ALTER TABLE ... OWNER TO`,
  enum type declarations, schema-qualified identifiers, `WITH (...)`
  table options. A generic SQL parser mishandles several of these
  silently.
- `pgsql-ast-parser` targets Postgres syntax directly and is widely used
  (e.g., by `pg-mem`).
- Pure JS — no native binding, keeps the install footprint small
  (Principle VII constraint SC: < 10 MB installer footprint).

**Alternatives considered.**
- **`node-sql-parser`.** Rejected. General-purpose (MySQL / MariaDB /
  PostgreSQL / BigQuery dialects). Postgres dialect coverage is
  looser; `pg_dump` features like `ALTER TABLE ONLY ... ADD CONSTRAINT`
  have been reported broken historically. Tolerable in a hackathon
  demo but rules out tougher Builder-supplied schemas.
- **`libpg_query` (native via `libpg-query-node`).** Rejected.
  Native-compilation requirement complicates installation on Windows
  and WSL2; violates the "npx works everywhere" reproducibility goal.
- **Spawn `psql` or `pg_dump` subprocess.** Rejected. Requires Postgres
  to be installed on the Builder's machine; Feature 001 must be usable
  without any Postgres runtime.

**Implications for code.** `packages/scripts/src/parse-schema.ts` imports
`parse` from `pgsql-ast-parser`, walks the AST looking for
`create table`, `create type ... as enum`, `alter table ... add
constraint`, and `comment on` statements. Output is a typed JSON shape
(see `data-model.md`) validated by `zod`.

---

## 3. OpenAPI parser — resolved

**Decision.** Use `@apidevtools/swagger-parser` (the de-facto standard).

**Rationale.**
- Handles OpenAPI 3.0, 3.1, and legacy Swagger 2.0.
- Resolves `$ref` pointers (local and remote) — critical because most
  real-world specs are split across files.
- Detects and reports the spec version, enabling FR-033's Swagger-2.0
  suggestion flow.
- Validates the spec against the OpenAPI JSON Schema, producing typed,
  actionable errors for FR-033's malformed-spec handling.

**Alternatives considered.**
- **`openapi-types` + manual parse.** Rejected. Loses validation +
  `$ref` resolution; reimplementing both is significant work.
- **`oasdiff` / `swagger-diff`.** Rejected. These are diff tools, not
  parsers; would be orthogonal helpers if needed for FR-049 L2 diff,
  but `parse-openapi.ts` doesn't need them — `swagger-parser` returns
  a resolved object we can diff ourselves.

**Implications for code.** `parse-openapi.ts` accepts URL, file path, or
pasted content (FR-026); calls `SwaggerParser.bundle()` to resolve
`$ref`; reports Swagger 2.0 detection with a distinct exit code so the
command can surface the conversion suggestion.

---

## 4. Markdown artifact parsing (for idempotent re-runs) — resolved

**Decision.** `unified` + `remark-parse` + `remark-frontmatter` for
structural parsing; `gray-matter` for lightweight frontmatter-only reads
where the body is not needed.

**Rationale.**
- Re-running any `/atw.*` command requires loading the existing
  artifact, comparing to inputs, and producing a focused-update diff
  (FR-025, FR-040, FR-049 Level 2). Regex-based reads are brittle when
  the Builder has hand-edited headings or inserted new sub-sections
  (FR-040 mandates we respect edits).
- `unified` + `remark-parse` produces a stable AST (mdast) that is
  trivial to walk for `## Section` headings and code-fenced JSON blocks
  where structured decisions live (per `examples/sample-schema-map.md`
  shape).
- Both libraries are widely adopted and have no native dependencies.

**Alternatives considered.**
- **Pure regex.** Rejected. Fails on Builder edits and on nested
  markdown structures.
- **Markdown-it.** Viable but unified-ecosystem tooling is better at
  structured mdast round-tripping (parse → transform → stringify),
  which we will want when producing focused-update diffs.
- **Store a parallel JSON shadow file.** Rejected. Violates Principle II
  (Markdown as Source of Truth) — markdown IS the state; a shadow file
  creates drift risk.

**Implications for code.** `packages/scripts/src/lib/markdown.ts`
exports a `loadArtifact(path, kind)` helper that returns a typed
representation per artifact kind (brief / schema-map / action-manifest /
build-plan / project). The structural-diff helper operates over these
typed representations, never over raw markdown strings.

---

## 5. Atomic file writes (cross-platform) — resolved

**Decision.** `write-file-atomic` (npm package; ~2 KB).

**Rationale.**
- FR-046 requires atomic writes with a backup of the prior version.
- On POSIX, the canonical pattern is `fs.writeFile(tmp)` +
  `fs.rename(tmp, target)`. On Windows, `rename` over an existing file
  throws `EEXIST`; a naive port leaves a half-written file in a crash
  window. `write-file-atomic` handles the Windows case via a
  `fs.unlink` + `fs.rename` sequence with a fsync.
- The package is tiny, widely used (`npm`, `yarn`, VS Code), and has
  zero native dependencies.

**Alternatives considered.**
- **Roll our own.** Rejected. Correct atomicity under crash is subtle
  (ordering of fsync, handling of rename errors). Not worth re-learning
  the lessons already encoded in a 12-year-old package.
- **`fs.promises.rename` only.** Rejected. Fails on Windows as above.

**Implications for code.** `packages/scripts/src/lib/atomic.ts` wraps
`write-file-atomic` and handles the backup file: before writing, copy
the existing artifact to `<name>.md.bak`. On a clean write, the backup
is removed; on a crash, it remains for recovery.

---

## 6. CLI framework for the installer — resolved

**Decision.** `commander` (v12+).

**Rationale.**
- The installer has one command with a handful of flags (`--force`,
  `--dry-run`, `--yes`). `commander` is the simplest widely-understood
  option.
- Zero runtime dependencies beyond itself; < 50 KB.
- Typed via `@types/` package; fits naturally with TypeScript source.

**Alternatives considered.**
- **`yargs`.** More featureful (subcommand middleware, strict parsing)
  than we need. Rejected for simplicity.
- **`citty`.** Modern (unjs), but smaller ecosystem and we don't need
  its lazy-loaded subcommand model.
- **Hand-rolled `process.argv` parsing.** Rejected. Error-prone for
  `--force` vs positional argument handling.

**Implications for code.** `packages/installer/src/index.ts` uses
`commander` to parse `<target-dir>`, `--force`, and `--dry-run`. No
subcommand tree (one operation: scaffold).

---

## 7. Testing framework — resolved

**Decision.** `vitest` (v1.x).

**Rationale.**
- TypeScript-native: no Babel config, no `ts-jest` compilation overhead.
- ESM-first, matching our `"type": "module"` package.json.
- Watch mode is instant; CI parallelism is first-class.
- Integration tests can spawn the installer as a child process and
  assert on `fs`/tree — idiomatic Node test pattern with no extra deps.
- API compatible with Jest expectations, so existing muscle memory
  transfers.

**Alternatives considered.**
- **Jest.** Rejected. Needs `ts-jest` or SWC configuration; ESM support
  is still wobbly in 29.x.
- **Node's built-in `node:test`.** Workable but missing the ergonomic
  assertion library. Would need a separate `expect` implementation.
- **`uvu` / `ava`.** Rejected. Smaller ecosystems; team familiarity
  with Jest/Vitest syntax is the tiebreaker.

**Implications for code.** Root `vitest.config.ts` with `workspace:
['packages/*', 'tests']`. Each package has its own `test/` folder; the
integration suite lives at the repo root in `tests/integration/`.

---

## 8. Content hashing for idempotency — resolved

**Decision.** SHA-256 (`crypto.createHash('sha256')`) over the input
file's bytes with one normalization: LF line endings.

**Rationale.**
- FR-047 requires content hashes of upstream inputs; FR-049 Level 1
  uses the hash to gate whether to invoke the LLM at all.
- SHA-256 is built into Node — zero dependency, fast enough for
  multi-MB SQL dumps.
- LF-normalizing CRLF before hashing prevents false diffs when a
  Windows-editor-touched file reappears identical except for line
  endings.
- No other normalization (whitespace, BOM) — over-normalizing risks
  missing real Builder changes.

**Alternatives considered.**
- **xxHash.** Faster but adds a dep for no meaningful speedup at our
  input sizes.
- **Content-defined chunking (rsync-style).** Overkill. Level 2 of
  FR-049 does structural diff, not byte-level resync.

**Implications for code.** `packages/scripts/src/hash-inputs.ts` takes
a list of file paths, normalizes line endings, hashes each, and writes
`.atw/state/input-hashes.json` with entries of the form `{ path,
sha256, seenAt }`. The script exits 0 on success and 1 on any read
error.

---

## 9. Monorepo tooling — resolved

**Decision.** Plain **npm workspaces** (Node 20's built-in). No
Turborepo, no Nx, no pnpm.

**Rationale.**
- Principle VII: "Monorepo tooling beyond strict need is overkill at
  this scope."
- Two packages + data directories is trivially handled by `npm
  workspaces` with `"workspaces": ["packages/*"]` in the root
  package.json.
- No cross-package task graph requiring caching; each package's build
  is independent.

**Alternatives considered.** All rejected per Principle VII.

---

## 10. Large-schema chunking strategy — resolved

**Decision.** Chunk by foreign-key cluster using a disjoint-set
(union-find) pass over table references. Each cluster is sent as one
LLM request; a final reconciliation pass harmonizes cross-cluster
decisions (e.g., a reference table shared between two clusters gets one
classification).

**Rationale.**
- FR-024 and the source doc §5.4 require chunking for > 100 tables or
  > 500 columns.
- FK clustering preserves semantic locality — tables that reference
  each other almost always belong together (orders + order_items +
  order_status). Sending them as separate requests would degrade
  classification quality.
- Union-find is O(n·α(n)), trivial to implement, deterministic.

**Alternatives considered.**
- **Alphabetical chunking.** Rejected. Splits related tables; degrades
  LLM context.
- **Schema-name chunking.** Partial — valid as a coarser first split,
  but within a schema, FK clustering is still the right subdivision.
- **LLM-decides-chunking.** Rejected per Principle VI (deterministic
  primitives).

**Implications for code.** `packages/scripts/src/lib/fk-clusters.ts`
implements the union-find helper; `parse-schema.ts` exposes the FK
graph alongside the table list so the `/atw.schema` markdown command
can request chunked classifications.

---

## 11. Runtime env + secrets handling — resolved

**Decision.** The LLM API key is read from `ANTHROPIC_API_KEY` at the
point Claude Code invokes its model. The auxiliary scripts never read
this variable and never make HTTP calls to the API. `/atw.api`'s
optional fetch of a Builder-supplied OpenAPI URL is the sole network
call outside the Claude Code → Anthropic path.

**Rationale.**
- FR-042, FR-043: network scope is tightly constrained.
- Principle I: the backend (scripts) is never in the credential path.
- Claude Code already handles `ANTHROPIC_API_KEY` for its own calls;
  the slash command is a markdown instruction, so no additional secret
  handling is introduced by this feature.

**Alternatives considered.**
- **Pass the API key into scripts via env.** Rejected. Violates the
  "scripts are deterministic, no LLM" separation.

---

## 12. Testing the installer on Windows — resolved

**Decision.** Run CI on macOS, ubuntu-latest, and windows-latest with
Node 20. Primary developer machine (Windows 11 + WSL2) covers WSL2 by
construction. Principle VIII's three-platform test matrix is satisfied.

**Rationale.** SC-003 and the ratification date constrain this feature
to ship within the hackathon week, so the test matrix must be CI-gated,
not hand-tested.

**Alternatives considered.** None viable given the timeline.

---

## Open items deferred to Phase 2 (`/speckit-tasks`)

The following are **not** research items — they're concrete implementation
choices best made while writing tasks:

- Exact directory layout *inside* `templates/atw-tree/` (file-by-file).
- The text of the post-install "Next: run `/atw.init`" message.
- The shape of `docker-compose.yml.tmpl`'s commented-out services
  (Feature 002 will uncomment these; this feature only places the file).
- The exact structure of each slash command's markdown file — the
  shape is sketched in `001-setup-flow.md` §5.8 but the final prose
  belongs in tasks / implementation.

Everything a Phase 1 design artifact needs is resolved above.

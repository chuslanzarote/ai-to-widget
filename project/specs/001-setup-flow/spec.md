# Feature Specification: Setup Flow (Feature 001)

**Feature Branch**: `001-setup-flow`
**Created**: 2026-04-21
**Status**: Draft
**Input**: User description sourced from `001-setup-flow.md` at the project root, with upstream context in `constitution.md`, `PRD.md`, and `examples/`.

## Overview

The Setup Flow is the first of three features comprising AI to Widget. It
covers everything the Builder does **before** anything runs: a one-command
installer that prepares a project directory, plus five conversational slash
commands that interview the Builder about their client's business, interpret
the client's database schema, classify the client's API, and consolidate
every decision into a build plan. All output is human-readable markdown in
`.atw/`. No container starts, no embeddings are computed, no runtime code
is generated — those are handled by Features 002 and 003.

The flow is deliberately conversational and human-in-the-loop: the Builder
never types markdown by hand, but no decision lands on disk without their
explicit confirmation.

## Clarifications

### Session 2026-04-21

- Q: What is the lifecycle of files staged under `.atw/inputs/` (SQL dumps, OpenAPI responses) after the command that consumed them succeeds? → A: `.atw/inputs/` is gitignored by default; files remain on disk untouched and are the Builder's responsibility to delete.
- Q: At what granularity do idempotent re-runs detect changes to upstream inputs? → A: Two-level — file-level content hash gates whether to act at all; when it changed, a deterministic structural diff isolates added/removed/modified items (tables, columns, endpoints) and Opus is invoked only on the delta.
- Q: When Claude Code is closed mid-command (the language model has proposed but the Builder has not confirmed), what happens on re-open? → A: Command-level atomicity. Interruption mid-command discards the in-progress proposal; re-running the command re-invokes the language model from scratch. No intermediate draft state is persisted. Idempotency is guaranteed at command boundaries (committed artifacts), not at step boundaries inside a command.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Bootstrap a new project directory (Priority: P1)

**As a Builder**, I want to initialize an AI to Widget project with a single
command so that I can start setting up an agent for a new client without
writing boilerplate.

**Why this priority**: Nothing else in the flow can happen until the
directory is initialized. This is the MVP entry point — without it, there
are no command files loaded, no `.atw/` tree, and no next step.

**Independent Test**: Run the installer against an empty target directory
and verify that the `.atw/` tree, the five slash command definitions under
`.claude/commands/`, and a commented `docker-compose.yml` template appear,
along with a clear "next command" message. No further commands need to
execute for this story to be considered delivered.

**Acceptance Scenarios**:

1. **Given** an empty target directory and a machine with the project
   prerequisites installed, **When** the Builder runs the installer pointed
   at that directory, **Then** the directory contains a populated `.atw/`
   tree (`config/`, `artifacts/`, `state/`, `templates/`), five slash
   command files under `.claude/commands/atw.*.md`, a commented
   `docker-compose.yml`, a `README-atw.md`, and a `package.json` if none
   existed, within 60 seconds.
2. **Given** a directory that already contains an `.atw/` tree, **When**
   the Builder runs the installer without a force flag, **Then** the
   installer halts and reports which files would be overwritten.
3. **Given** the same directory with a force flag, **When** the installer
   runs, **Then** it proceeds with a warning and leaves the directory in a
   re-initialized state.
4. **Given** a successful install, **When** the installer finishes, **Then**
   it prints a short message naming the exact next command
   (`Open Claude Code here and run /atw.init`).

---

### User Story 2 — Capture the business brief conversationally (Priority: P1)

**As a Builder**, I want to describe my client's business in a guided
conversation so that every downstream interpretation (schema, API,
enrichment, runtime prompt) is grounded in the correct domain context.

**Why this priority**: The brief is the anchor document that every later
command reads. A weak brief degrades every subsequent artifact.

**Independent Test**: Following a successful bootstrap, the Builder runs
`/atw.brief`, answers questions in natural language, and confirms the
synthesized draft. `.atw/config/brief.md` is produced, its structure matches
the reference example in `examples/sample-brief.md`, and its content only
contains statements the Builder made (no invented facts).

**Acceptance Scenarios**:

1. **Given** a fresh initialized project, **When** the Builder runs
   `/atw.brief`, **Then** the system asks a sequence of business questions
   covering what the client sells, who their customers are, what the agent
   should do, what it must never do, tone, representative use cases, and
   business vocabulary.
2. **Given** a Builder who answers each question in 2–5 sentences, **When**
   the conversation ends, **Then** the system presents a synthesized draft
   matching the structure of `examples/sample-brief.md` and asks for
   confirmation before writing.
3. **Given** the draft includes a claim the Builder did not make, **When**
   the Builder rejects it, **Then** the system revises without fabricating
   replacement content and re-presents.
4. **Given** a completed `brief.md` in the project, **When** the Builder
   re-runs `/atw.brief`, **Then** the system summarizes what is already
   captured and asks what to change rather than replaying the full
   interview.

---

### User Story 3 — Interpret the schema with automatic PII protection and human review (Priority: P1)

**As a Builder**, I want to share my client's database schema without
exposing production credentials, have the system propose how to interpret
and index it, automatically flag sensitive fields, and review every
decision before anything is committed.

**Why this priority**: Schema understanding is the foundation for retrieval
at runtime. Getting this wrong means the agent either misses data or leaks
it — both are product-killing outcomes.

**Independent Test**: With a completed brief in the project, the Builder
provides a `pg_dump --schema-only` output, reviews the system's
classifications entity-by-entity, confirms, and sees
`.atw/artifacts/schema-map.md` produced matching the reference example.
Personally identifiable tables in the reference demo are flagged and
excluded without intervention.

**Acceptance Scenarios**:

1. **Given** the Builder runs `/atw.schema` and provides a
   `pg_dump --schema-only` file path, paste, or staged input, **When** the
   command starts, **Then** the SQL is parsed deterministically (no
   language-model parsing) and the system never asks for or accepts a
   database connection string.
2. **Given** the parsed schema and a completed brief, **When** the system
   proposes classifications (indexable entity / joined reference /
   infrastructure / PII-excluded), **Then** every proposal cites evidence
   (column names, sample values, foreign keys, or the brief).
3. **Given** a column named or sampled like personally identifiable data
   (email, phone, name, address, payment data, government ID, free-text
   biographical field), **When** the system classifies the schema, **Then**
   that column is flagged as PII and excluded from indexing by default.
4. **Given** the Builder reviews entity-by-entity and requests a change to
   one table's classification, **When** they confirm the revised view,
   **Then** the system updates the draft without losing other decisions,
   and writes `schema-map.md` only after full confirmation.
5. **Given** a schema with more than 100 tables, **When** `/atw.schema`
   runs, **Then** processing is chunked along foreign-key clusters with
   visible progress and no single request exceeds the language model's
   input limit.

---

### User Story 4 — Classify API endpoints into an action manifest (Priority: P2)

**As a Builder**, I want the system to read my client's OpenAPI
specification, classify each endpoint according to what the agent should be
allowed to do, and produce the manifest of tools the runtime agent will
have.

**Why this priority**: Actions are what separates AI to Widget from a
generic RAG chatbot. Without a reviewed manifest the agent is read-only,
which is still useful (P1 flow delivers that); hence P2 rather than P1.

**Independent Test**: With brief and schema-map already in place, the
Builder runs `/atw.api`, provides an OpenAPI URL or file, reviews
classifications grouped by entity, confirms, and sees
`.atw/artifacts/action-manifest.md` produced matching the reference
example. All administrative endpoints in the reference demo are excluded
without intervention.

**Acceptance Scenarios**:

1. **Given** `/atw.api` accepts a URL, local file path, or pasted document,
   **When** the Builder provides any of these, **Then** the OpenAPI
   specification is parsed deterministically (no language-model parsing).
2. **Given** the parsed operations plus upstream artifacts, **When** the
   system classifies each operation, **Then** every operation lands in
   exactly one of: public read, authenticated-user read,
   authenticated-user action requiring confirmation, destructive action
   requiring explicit confirmation, admin-only (excluded), or
   infrastructure (excluded).
3. **Given** an operation under an administrative path prefix or guarded by
   admin-only security, **When** the agent being built is customer-facing,
   **Then** that operation is excluded from the manifest by default.
4. **Given** an operation classified as a destructive action, **When** the
   system emits its tool definition, **Then** the definition carries a
   `requires_confirmation` flag so the runtime will ask the end user before
   invoking it.
5. **Given** classifications presented entity-by-entity, **When** the
   Builder overrides one, **Then** the override is reflected in the final
   manifest and the manifest is written only after full confirmation.

---

### User Story 5 — Consolidate the plan with a cost estimate (Priority: P2)

**As a Builder**, I want the system to collect every prior decision into an
executable build plan and tell me the estimated cost before anything
expensive happens, so I do not accidentally over-spend.

**Why this priority**: The plan is what Feature 002 executes. It is
necessary for any real build but not needed to validate the earlier
exploration steps — hence P2.

**Independent Test**: With all upstream artifacts in place, the Builder
runs `/atw.plan`, sees a plain-English summary and a cost estimate,
confirms, and `.atw/artifacts/build-plan.md` appears matching the reference
example.

**Acceptance Scenarios**:

1. **Given** all four upstream artifacts (`project.md`, `brief.md`,
   `schema-map.md`, `action-manifest.md`), **When** `/atw.plan` starts,
   **Then** the system validates their presence and cross-consistency (no
   action references an entity that is excluded from the schema map).
2. **Given** consistent upstream artifacts, **When** the plan is
   synthesized, **Then** it covers embedding approach, category
   vocabularies for enrichment, enrichment prompt templates per entity
   type, estimated entity counts, and backend/widget configuration
   defaults.
3. **Given** the plan includes a cost estimate, **When** the estimate is
   displayed, **Then** it breaks down the number of enrichment calls,
   average cost per call, total cost, and a retry buffer.
4. **Given** the Builder confirms the plan, **When** the command writes,
   **Then** `build-plan.md` is written; given the Builder adjusts (e.g.,
   asks for lower concurrency), **Then** the plan is revised and
   re-presented before any write.
5. **Given** an upstream artifact is missing, **When** `/atw.plan` starts,
   **Then** it halts with an explicit message naming which prior command to
   run first.

---

### User Story 6 — Iterate, edit, and resume without loss (Priority: P3)

**As a Builder**, I want to re-run any command later, or edit any artifact
by hand, without losing prior work — so I can refine decisions as I learn
more about the client.

**Why this priority**: Setup is multi-step and realistic Builders will
revisit decisions. Without this, the first four stories still deliver a
working one-shot flow (the product is viable); adding this makes it pleasant
and sustainable — hence P3.

**Independent Test**: After the Builder has completed the full flow once,
(a) re-running any single command without changing upstream inputs
preserves every prior decision and asks only what to change; (b) editing a
committed artifact in a text editor and then running a downstream command
causes the edit to be honored in the downstream output.

**Acceptance Scenarios**:

1. **Given** a completed flow and unchanged inputs, **When** the Builder
   re-runs `/atw.brief`, **Then** the system summarizes the existing brief
   and asks what to change rather than replaying the interview.
2. **Given** the same for `/atw.schema` or `/atw.api`, **When** re-run,
   **Then** the system surfaces diff-level changes (new tables, removed
   endpoints, edited columns) and proposes focused updates only.
3. **Given** the Builder opens `.atw/artifacts/schema-map.md` in a text
   editor, removes an entity, and saves, **When** they subsequently run
   `/atw.plan`, **Then** the plan reflects the edited schema map without a
   cached override.
4. **Given** a Claude Code session is closed mid-flow between commands,
   **When** the Builder re-opens it later, **Then** every committed
   artifact is intact and the next command can be run. **Given** the
   session is closed mid-command (before the Builder has confirmed the
   proposal), **When** they re-open and re-run that command, **Then** the
   in-progress proposal is gone and the command re-synthesizes from the
   same inputs — committed artifacts from earlier commands are untouched.

---

### Edge Cases

- **Malformed SQL dump.** The deterministic parser reports the line and
  column of the parse failure; no language-model call is attempted on the
  broken input.
- **Unreachable OpenAPI URL.** The command offers a file-path fallback and
  does not retry indefinitely against a failing host.
- **Older Swagger 2.0 specification.** The command detects the version and
  suggests a conversion step before retrying.
- **Schema exceeds single-request capacity.** The command chunks by
  foreign-key cluster and reconciles in a final pass; it does not silently
  truncate.
- **API authentication error during any command.** The command halts with
  a clear message pointing to the expected environment variable, without
  consuming further resources.
- **API rate limit (429).** The command retries with exponential backoff up
  to 3 attempts, then halts with an actionable message.
- **`.atw/` directory deleted or corrupted mid-flow.** Commands detect the
  missing state and offer re-initialization; original inputs (SQL dumps,
  OpenAPI files) staged under `.atw/inputs/` are preserved where possible.
- **Claude Code closed mid-command, before Builder confirmation.** The
  in-progress proposal is not persisted; on re-open the Builder re-runs
  the command, which re-synthesizes from the same inputs. Committed
  upstream artifacts from prior commands are untouched (see FR-050).
- **Builder disagrees with most schema classifications.** The system
  surfaces this as a signal that the brief may be underspecified and
  suggests revisiting `/atw.brief`.
- **PII detection misses a sensitive column.** The Builder can flag it
  manually during review or by editing `schema-map.md` directly — direct
  edits are respected on the next run.
- **Conflicting answers in the brief interview.** The system surfaces the
  contradiction and asks which applies rather than silently picking one.
- **Builder attempts to install over a non-empty directory without force.**
  Installer halts with a list of conflicting files before any write.

## Requirements *(mandatory)*

### Functional Requirements

**Installer**

- **FR-001**: The installer MUST create, when run against an empty target
  directory, the full `.atw/` tree (`config/`, `artifacts/`, `state/`,
  `templates/`).
- **FR-002**: The installer MUST copy five slash command definitions to
  `.claude/commands/atw.init.md`, `atw.brief.md`, `atw.schema.md`,
  `atw.api.md`, and `atw.plan.md` in the target directory.
- **FR-003**: The installer MUST place a `docker-compose.yml` template at
  the target directory root with AI to Widget services defined but
  commented out.
- **FR-004**: The installer MUST place a `README-atw.md` quickstart and a
  `package.json` (if none exists) containing the minimum dependencies the
  auxiliary scripts require.
- **FR-005**: The installer MUST refuse to run in a directory that already
  contains an `.atw/` tree unless an explicit force flag is supplied; on
  refusal it MUST list the conflicting paths.
- **FR-006**: The installer MUST, on success, print a short message naming
  the exact next command the Builder should run.
- **FR-007**: The installer MUST complete on a typical machine with good
  internet connectivity within 60 seconds.

**`/atw.init`**

- **FR-008**: `/atw.init` MUST capture project name, primary spoken
  language(s), and deployment type (customer-facing widget / internal
  back-office copilot / custom).
- **FR-009**: `/atw.init` MUST write `.atw/config/project.md` and MUST NOT
  invoke any language model to do so.
- **FR-010**: When `project.md` already exists, `/atw.init` MUST load it,
  show current values, and allow the Builder to change any of them.

**`/atw.brief`**

- **FR-011**: `/atw.brief` MUST conduct a multi-turn conversation covering
  at minimum: business scope, customers, allowed agent actions, forbidden
  agent actions, tone, primary use cases, and business vocabulary.
- **FR-012**: `/atw.brief` MUST synthesize the Builder's answers into a
  draft structured per `examples/sample-brief.md`, present it for
  confirmation, and only write `.atw/config/brief.md` after explicit
  confirmation.
- **FR-013**: The synthesis step MUST NOT infer facts the Builder did not
  state; unfilled sections MUST carry a placeholder note rather than
  fabricated content.
- **FR-014**: When the Builder's answers contradict each other, the command
  MUST surface the contradiction and ask which applies.
- **FR-015**: When `brief.md` already exists, `/atw.brief` MUST summarize
  what is captured and ask what to change rather than replay the full
  interview.

**`/atw.schema`**

- **FR-016**: `/atw.schema` MUST accept its SQL input as a file path, as
  pasted content in the chat, or as an input staged under `.atw/inputs/`
  from a prior run. When the Builder also supplies representative row data
  (e.g., `pg_dump --data-only --inserts`), `/atw.schema` MUST sample **at
  most 50 rows per table** for classification evidence and MUST NOT send
  unbounded row data to the language model.
- **FR-017**: `/atw.schema` MUST parse SQL dumps using a deterministic
  parser; the system MUST NOT delegate SQL parsing to a language model.
- **FR-018**: `/atw.schema` MUST NOT request, accept, store, log, or
  transmit any database connection string or equivalent credential.
- **FR-019**: `/atw.schema` MUST classify every table into one of:
  indexable business entity, joined reference, internal/infrastructure
  (ignored), or PII-excluded.
- **FR-020**: Every classification MUST cite evidence (column names, sample
  values, foreign keys, or a statement from the brief).
- **FR-021**: Columns whose name or sample values indicate personally
  identifiable information (email, phone, names, addresses, payment data,
  government IDs, free-text biographical fields) MUST be flagged as PII and
  excluded from indexing by default.
- **FR-022**: PII-heavy tables (customers, addresses, payments, and
  analogues) MUST be excluded wholesale by default.
- **FR-023**: `/atw.schema` MUST present classifications to the Builder
  entity-by-entity (or in bulk for ignored tables) and MUST NOT write
  `.atw/artifacts/schema-map.md` without explicit Builder confirmation.
- **FR-024**: When a schema exceeds single-request capacity (more than 100
  tables or more than 500 columns), `/atw.schema` MUST process it in chunks
  along foreign-key clusters and reconcile in a final pass; no single
  request may exceed the language model's input limit.
- **FR-025**: When `schema-map.md` already exists, `/atw.schema` MUST
  surface changes in the incoming dump (added, removed, changed tables and
  columns) and propose focused updates rather than full re-interpretation.

**`/atw.api`**

- **FR-026**: `/atw.api` MUST accept its OpenAPI input as a URL, a file
  path, or a pasted JSON/YAML document.
- **FR-027**: `/atw.api` MUST parse the OpenAPI specification using a
  deterministic parser; the system MUST NOT delegate OpenAPI parsing to a
  language model.
- **FR-028**: `/atw.api` MUST classify every operation into exactly one of:
  public read, authenticated-user read, authenticated-user action
  (confirmation required), destructive action (explicit confirmation
  required), admin-only (excluded), or infrastructure (excluded).
- **FR-029**: For customer-facing deployments, all operations under an
  administrative path prefix or guarded by admin-only security MUST be
  excluded from the manifest by default.
- **FR-030**: For every exposed operation, the manifest MUST include a
  verb+noun tool name, an agent-facing description, a parameter schema,
  a `requires_confirmation` flag, and notes identifying the source of each
  parameter.
- **FR-031**: Destructive operations MUST always carry `requires_confirmation: true`
  so the runtime agent must confirm with the end user before invoking
  them.
- **FR-032**: `/atw.api` MUST present classifications grouped by entity and
  MUST NOT write `.atw/artifacts/action-manifest.md` without explicit
  Builder confirmation.
- **FR-033**: When the OpenAPI source is unreachable, `/atw.api` MUST offer
  a file-path fallback rather than retrying indefinitely.

**`/atw.plan`**

- **FR-034**: `/atw.plan` MUST validate that `project.md`, `brief.md`,
  `schema-map.md`, and `action-manifest.md` all exist and are internally
  consistent before synthesizing.
- **FR-035**: `/atw.plan` MUST produce a cost estimate covering expected
  enrichment calls, per-call cost, total cost, and a retry buffer, and MUST
  display it before requesting confirmation.
- **FR-036**: `/atw.plan` MUST NOT write `.atw/artifacts/build-plan.md`
  without explicit Builder confirmation.
- **FR-037**: When an upstream artifact is missing, `/atw.plan` MUST halt
  and identify which prior command must be run first.
- **FR-038**: When upstream artifacts are inconsistent (e.g., an action
  references an entity excluded from the schema map), `/atw.plan` MUST
  surface the inconsistency and ask the Builder to resolve it before
  proceeding.

**Cross-cutting**

- **FR-039**: All five commands MUST be idempotent: re-running any command
  without changes to its inputs MUST preserve all prior decisions.
- **FR-040**: Direct edits made by the Builder to any `.atw/` markdown
  artifact in a text editor MUST be honored by subsequent commands; the
  system MUST NOT silently override edits from a hidden cache.
- **FR-041**: No command MAY write an artifact to disk without explicit
  Builder confirmation of the proposal.
- **FR-042**: No command MAY make network calls other than to the language
  model API and, in the case of `/atw.api`, to a Builder-supplied OpenAPI
  URL; no telemetry is collected.
- **FR-043**: On language-model authentication failure, the active command
  MUST halt with an actionable message naming the expected credential and
  how to supply it.
- **FR-044**: On language-model rate limiting, the active command MUST
  retry with exponential backoff up to 3 attempts and then halt with an
  actionable message.
- **FR-045**: The suite of deterministic auxiliary scripts
  (`parse-schema`, `parse-openapi`, `write-artifact`, `load-artifact`,
  `validate-artifacts`, `hash-inputs`) MUST each have a single
  responsibility, typed input/output, and a non-zero exit code with an
  actionable stderr message on failure.
- **FR-046**: All writes to `.atw/` artifacts MUST be atomic (write to a
  temporary file, then rename) with a backup of the prior version kept
  during the transition.
- **FR-047**: Content hashes of input files (SQL dumps, OpenAPI specs, the
  brief) MUST be tracked under `.atw/state/` so that idempotent re-runs can
  detect unchanged inputs without re-reading the originals.
- **FR-048**: The installer MUST ensure `.atw/inputs/` is listed in the
  project's `.gitignore` (creating `.gitignore` if absent, or appending if
  present without duplication). No command MAY automatically purge files
  from `.atw/inputs/`; deletion of staged inputs is the Builder's explicit
  responsibility.
- **FR-049**: Re-run change detection MUST operate in two levels. Level 1:
  the file-level content hash from `.atw/state/input-hashes.json` gates
  whether any further work is needed — if the input is unchanged **and** a
  committed artifact already exists, the command enters pure refinement
  mode and does not invoke the language model. Level 2: when the hash has
  changed (or no committed artifact exists), a deterministic structural
  diff (implemented by the auxiliary scripts, not the language model) MUST
  identify added, removed, and modified items — tables and columns for
  `/atw.schema`, endpoints and operations for `/atw.api`, sections for
  `/atw.brief`, upstream artifact references for `/atw.plan`. Language-model
  synthesis on re-run MUST be invoked only on the delta, never on the
  entire input.
- **FR-050**: All five commands MUST be atomic at the command boundary: a
  committed `.atw/` artifact is the unit of persisted state. No command MAY
  persist intermediate draft state (in-progress language-model output,
  partially confirmed classifications, mid-interview answers) to disk
  between invocations. When a command is interrupted before the Builder
  confirms (e.g., Claude Code closed mid-flow), the in-progress proposal is
  discarded; re-running the command re-invokes the language model from
  scratch against the same inputs. Idempotency (FR-039) is guaranteed at
  the command boundary, not at step boundaries inside a command.

### Key Entities

- **Project metadata** (`.atw/config/project.md`) — Minimal identification
  of the project: name, spoken language(s), deployment type, creation date.
  Output of `/atw.init`.
- **Business brief** (`.atw/config/brief.md`) — Canonical statement of the
  client's business, customers, allowed and forbidden agent actions, tone,
  primary use cases, and business vocabulary. Output of `/atw.brief`. The
  anchor document every later command reads.
- **Schema map** (`.atw/artifacts/schema-map.md`) — Decision record for
  every table in the client's database: classification
  (indexable / reference / infrastructure / PII-excluded), per-column
  decisions, evidence, PII flags. Output of `/atw.schema`.
- **Action manifest** (`.atw/artifacts/action-manifest.md`) — List of API
  tools the runtime agent will have: name, description, parameter schema,
  confirmation policy, source of each parameter, runtime system prompt
  block. Output of `/atw.api`.
- **Build plan** (`.atw/artifacts/build-plan.md`) — Consolidated executable
  plan for Feature 002: embedding approach, category vocabularies,
  enrichment prompt templates, estimated entity counts, cost estimate,
  backend/widget configuration defaults, failure handling. Output of
  `/atw.plan`.
- **Input state** (`.atw/state/input-hashes.json`) — Content hashes of
  upstream inputs for idempotency tracking. Populated and read by
  auxiliary scripts.
- **Staged inputs** (`.atw/inputs/`) — Optional staging area for SQL dumps
  and OpenAPI files the Builder wants to keep alongside the artifacts they
  produced. Gitignored by default and never auto-purged; lifecycle is the
  Builder's responsibility (see FR-048).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a fresh machine with the project prerequisites installed,
  the installer produces a working project structure in under 60 seconds.
- **SC-002**: A Builder following the documented flow completes the full
  five-command sequence against the reference demo (Aurelia on Medusa) in
  under 30 minutes.
- **SC-003**: The five output artifacts produced against the reference
  demo structurally match their counterparts in `examples/` (same section
  headings, same major decisions for at least 90% of entities and
  endpoints).
- **SC-004**: On the reference demo's schema, every table containing
  customer personally identifiable data (customer profile, addresses,
  payment records) is excluded from indexing without Builder intervention.
- **SC-005**: On the reference demo's API specification, every
  administrative endpoint is excluded from the action manifest without
  Builder intervention.
- **SC-006**: Re-running any setup command against unchanged inputs
  preserves 100% of prior decisions and requires no re-confirmation of
  unchanged content.
- **SC-007**: Direct edits the Builder makes to any setup artifact in a
  text editor are honored by the next command run, with no silent
  override.
- **SC-008**: The pre-build cost estimate produced by `/atw.plan` falls
  within 20% of the actual enrichment cost incurred during Feature 002's
  build phase, measured once that feature is integrated.
- **SC-009**: Total language-model spend for one complete setup run on a
  reference-scale project (≈ 300 entities, ≈ 120 endpoints) stays under
  USD 2.
- **SC-010**: No production database connection string, session token,
  bearer token, or authentication header is requested, logged, stored, or
  transmitted by any command at any point during setup. This is verified
  by code review and by inspection of all network calls and log output.
- **SC-011**: No artifact is written to `.atw/` without the Builder
  explicitly confirming the proposal presented to them (confirmation-gate
  pass rate = 100%).
- **SC-012**: On a schema of at least 300 tables, `/atw.schema` completes
  within 5 minutes; on an API specification of at least 120 endpoints,
  `/atw.api` completes within 2 minutes.

## Assumptions

- **Technology stack is fixed by the project constitution.** The feature
  is delivered under the constraints of Constitution Principle VII
  (single-ecosystem simplicity): TypeScript on a current Node runtime for
  all code, and Docker Compose for any orchestration concern that
  subsequent features may add. This is a project-wide constraint rather
  than a decision to be revisited inside this feature.
- **Builder environment.** The Builder has local shell access, Git, Docker,
  and Claude Code installed, with a valid language-model API key
  configured via the expected environment variable.
- **Schema access is the Builder's responsibility.** The Builder is able to
  generate a `pg_dump --schema-only` (and optionally
  `pg_dump --data-only --inserts` for sample data) from their client's
  database using permissions the client has granted them outside this
  product's scope.
- **Reference demo.** The Aurelia specialty-coffee shop running on Medusa
  is the reference integration. Structural success claims
  (SC-003 / SC-004 / SC-005) reference it.
- **Slash-command delivery.** The five commands are delivered as markdown
  files under `.claude/commands/`, loaded by Claude Code when the Builder
  types `/atw.init`, `/atw.brief`, etc. These files are themselves an
  output of this feature.
- **Installer distribution channel** (`npx create-atw@latest` vs
  clone-and-run) is deliberately left to `/speckit.plan` to decide.
- **Single Builder per project.** No concurrent multi-user editing of the
  same `.atw/` is supported or attempted.
- **Network scope.** The only network endpoints contacted are the
  language-model API and — in `/atw.api` only — the Builder-supplied
  OpenAPI URL. No telemetry is collected.
- **What this feature does NOT do.** No Postgres container is started, no
  embeddings are computed, no runtime code is generated, no data is
  ingested into any database, and no language-model enrichment calls are
  made. All of these belong to Feature 002 (build pipeline) or
  Feature 003 (runtime surface).

## Dependencies

- **Upstream (read-only):** the project constitution (`constitution.md`),
  the product PRD (`PRD.md`), and the reference artifacts in `examples/`
  — all present at the repository root at the time of writing.
- **Downstream consumers:** Feature 002 (`/atw.build`) consumes the five
  `.atw/` artifacts this feature produces. The artifact shapes in
  `examples/` are the contract; changes to them must be coordinated with
  Feature 002.

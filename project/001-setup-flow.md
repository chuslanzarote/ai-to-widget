# Feature 001 — Setup Flow

> **What this document is.** This is the input for `/speckit.specify` for the first of three features of AI to Widget. It scopes the "setup" half of the product: the installer plus the five conversational slash commands that produce the markdown artifacts describing the Builder's client. Nothing in this feature builds or runs code that will serve end users — that happens in Features 002 and 003.
>
> **Upstream dependencies.** The project constitution (`constitution.md`), the product PRD (`PRD.md`), and the sample artifacts in `examples/` are all available in the repository root. This feature references them heavily; spec-kit should read them as context when generating the spec.
>
> **Downstream consumers.** Feature 002 (build pipeline) consumes the markdown artifacts this feature produces. Do not break the contract on the artifact shape documented in `examples/`.

---

## 1. Context and purpose

AI to Widget is an open-source toolkit that turns any existing web application into one that embeds a conversational AI agent grounded in its own data and capable of actions on the user's behalf, without modifying the host application's code. The toolkit is delivered as Claude Code slash commands that guide the Builder through a conversational setup. See `PRD.md` §1 for the full product overview.

This first feature covers **setup only**: the Builder opens Claude Code in a fresh directory, runs a sequence of slash commands that interview them about their client's business, interpret their client's database schema, interpret their client's OpenAPI specification, and end with a consolidated plan ready for the build phase. Every output of this feature is a markdown file in `.atw/`. No Postgres container starts, no embeddings are computed, no code is generated. That comes next.

The purpose of isolating this as its own feature is twofold. First, the setup flow is agentic and conversational by nature (Opus reasoning over user input and structured data) whereas the build pipeline is deterministic plumbing (ingestion, embedding, templates). Separating them keeps the development scope manageable and lets us iterate on each without touching the other. Second, the setup artifacts are the durable auditable spec of the agent — anyone looking at a `.atw/` directory can understand what was built and why. Getting them right matters.

---

## 2. Scope

### 2.1 In scope

- **The installer.** A minimal CLI that initializes a new AI to Widget project or augments an existing directory. Distributed either as `npm create atw@latest` or as a clone-and-run script (final channel decided in `/speckit.plan`).
- **Five slash commands**, delivered as markdown command files under `.claude/commands/` in the Builder's project:
  - `/atw.init` — project metadata
  - `/atw.brief` — business context
  - `/atw.schema` — database schema interpretation
  - `/atw.api` — OpenAPI specification interpretation
  - `/atw.plan` — consolidated build plan
- **The auxiliary deterministic scripts** invoked by the slash commands: SQL schema parser, OpenAPI parser, artifact writer, idempotency detector. These live in `packages/scripts/` and are called via bash from within the slash commands.
- **The `.atw/` directory layout** inside the Builder's project: `config/`, `artifacts/`, `state/`, `templates/` subdirectories.
- **The `docker-compose.yml` template** placed at the Builder's project root, with AI to Widget services commented out — Feature 002 will uncomment and fill values, this feature just puts the template in place.
- **The five output markdown artifacts**, matching the structure of the corresponding files in `examples/`:
  - `.atw/config/project.md`
  - `.atw/config/brief.md`
  - `.atw/artifacts/schema-map.md`
  - `.atw/artifacts/action-manifest.md`
  - `.atw/artifacts/build-plan.md`
- **End-to-end validation against the Aurelia demo.** Running the five commands on the Aurelia Medusa schema and OpenAPI spec must produce artifacts close in shape and content to the pre-committed `examples/`.

### 2.2 Out of scope (for this feature)

- The `/atw.build` command and everything it does (that is Feature 002).
- The runtime backend or widget (Feature 003).
- The `/atw.verify` and `/atw.embed` commands (Feature 003).
- Any Postgres container, pgvector setup, or embedding computation.
- Actual code generation for backend or widget — only markdown artifacts are produced here.
- Real-time synchronization with the client's database (permanently out of scope in V1; see `PRD.md` §10).

### 2.3 Relationship to other features

- Feature 001 **produces** the markdown artifacts under `.atw/` and sets up the installer and command structure.
- Feature 002 **reads** those artifacts and materializes them into a running local system.
- Feature 003 **assumes** a working local system and adds the runtime surface (widget + demo integration).

If Feature 001 changes an artifact's shape, Features 002 and 003 need corresponding updates. The `examples/` files are the contract; treat them as canonical.

---

## 3. Mental model for the Builder

After Feature 001 completes, the Builder's experience looks like this:

```
$ mkdir my-client-agent && cd my-client-agent
$ npx create-atw@latest .        # or clone-and-run equivalent
   ✓ Created .atw/ structure
   ✓ Copied slash commands to .claude/commands/
   ✓ Wrote docker-compose.yml template
   Next: open Claude Code here and run /atw.init

$ claude            # opens Claude Code
> /atw.init
   [short conversation: project name, language, deployment type]
   ✓ Wrote .atw/config/project.md

> /atw.brief
   [10-minute conversation about the client's business]
   ✓ Wrote .atw/config/brief.md

> /atw.schema
   [shares local pg_dump output, reviews Opus's interpretation]
   ✓ Wrote .atw/artifacts/schema-map.md

> /atw.api
   [provides OpenAPI URL, reviews Opus's endpoint classification]
   ✓ Wrote .atw/artifacts/action-manifest.md

> /atw.plan
   [reviews consolidated plan + cost estimate]
   ✓ Wrote .atw/artifacts/build-plan.md
   Next: run /atw.build (Feature 002)
```

The Builder never writes markdown directly. They have a conversation, they see proposals, they confirm or override. The artifacts accumulate in `.atw/` as a human-readable audit trail.

---

## 4. User stories

### US-001.1 — Fast initialization
*As a Builder, I want to initialize a new AI to Widget project with a single command, so that I can start setting up an agent for a new client without writing boilerplate.*

**Scenario.** The Builder is starting a project for a new client. They create a directory, run `npx create-atw@latest .`, see the structure appear, and know the next command to run. Total time from command to "ready for `/atw.init`": under 60 seconds on a reasonable internet connection.

### US-001.2 — Describing the business
*As a Builder, I want to describe my client's business conversationally so that subsequent commands interpret the client's data with the correct domain context.*

**Scenario.** The Builder runs `/atw.brief`. Claude Code asks about what the client sells, who their customers are, what the agent should and shouldn't do, tone, primary use cases, and business vocabulary. The Builder answers in natural language, typing 2-5 sentences per question. Claude Code synthesizes a draft `brief.md`, shows it, asks for confirmation or corrections. Total time: 10-15 minutes for a well-prepared Builder. The resulting `brief.md` resembles `examples/sample-brief.md` in structure and depth.

### US-001.3 — Providing schema without credentials
*As a Builder, I want to provide my client's database schema without exposing production credentials, so that the agent understands what data exists without any security risk.*

**Scenario.** The Builder runs `pg_dump --schema-only --no-owner production_db > schema.sql` on their own machine (they have access the client has granted them separately). They run `/atw.schema` and point the command at the file. The file never leaves their machine except as content they choose to paste into the Claude Code session. This is a hard requirement from Constitution Principle 1 (User Data Sovereignty).

### US-001.4 — Reviewing Opus's schema interpretation
*As a Builder, I want Claude Code to propose how to interpret the schema and what to index, and I want to review and override those proposals before anything is committed.*

**Scenario.** Claude Code presents, entity by entity, its interpretation: which tables are primary business entities (indexable), which are joined reference tables, which are internal/infrastructure (ignored), which contain PII (excluded by default). For each decision, it cites evidence (column names, sample values, foreign keys, the brief). The Builder scans through, spots one table it wants indexed differently, says so. Claude Code updates its interpretation. Only when the Builder says "looks good" does Claude Code write `schema-map.md`. Under no circumstances does Claude Code commit the artifact before explicit confirmation.

### US-001.5 — Automatic PII detection
*As a Builder, I want the system to automatically flag PII columns and propose excluding them, so that I do not accidentally leak sensitive data into a customer-facing agent.*

**Scenario.** The schema has a `customer` table with columns `email`, `phone_number`, `first_name`, `last_name`, `shipping_address`. Claude Code flags all as PII based on column names and sample values, proposes excluding the entire `customer` table from the RAG index (since the agent is customer-facing). The Builder confirms. `schema-map.md` records the decision and the rationale.

### US-001.6 — OpenAPI endpoint classification
*As a Builder, I want Claude Code to classify every endpoint in my client's OpenAPI spec according to what the agent should be allowed to do.*

**Scenario.** The Builder runs `/atw.api` with the URL of their client's Swagger doc. Claude Code fetches, parses, and classifies each operation into one of: public read, authenticated-user read, authenticated-user action (requires confirmation), destructive action (requires explicit confirmation), admin-only (exclude), infrastructure (exclude). For each exposed tool, it generates a name, a description tuned for the agent's tool-use loop, and a parameter schema. The Builder reviews by entity group (products, cart, customer, etc.), confirms or overrides per operation.

### US-001.7 — Cost-aware plan consolidation
*As a Builder, I want to see the estimated Opus API cost before the build begins, so that I don't accidentally spend more than I intended.*

**Scenario.** The Builder runs `/atw.plan`. Claude Code reads all prior artifacts, decides the embedding model, enrichment prompt templates, category vocabularies, backend config, and widget config. It estimates the number of Opus enrichment calls, average token cost, and total: something like *"342 entities × ~$0.03 each = ~$10.41, plus a 10% buffer for retries"*. It also estimates build duration and required disk. The Builder reviews and confirms before anything proceeds.

### US-001.8 — Iterative refinement
*As a Builder, I want to re-run any command later to refine my choices, without losing prior work.*

**Scenario.** After completing all five commands, the Builder realizes the brief needs an extra note about subscription products. They run `/atw.brief` again. Claude Code detects the existing `brief.md`, summarizes what was captured before, and asks what the Builder wants to change — rather than re-asking the full interview. The Builder adds the note. The file is updated; unrelated sections are preserved.

### US-001.9 — Direct artifact editing
*As a Builder, I want to be able to edit any `.atw/` markdown file in my editor and have later commands respect my edits.*

**Scenario.** The Builder opens `.atw/artifacts/schema-map.md` in their editor, manually removes an entity they decided not to index, saves. When they later run `/atw.plan`, the plan reflects the edited schema-map (not a cached earlier version).

### US-001.10 — Graceful handling of large schemas
*As a Builder, I want the setup to work even when my client's schema is large or sprawling.*

**Scenario.** The client has 180 tables across 4 schemas. Claude Code processes them in chunks grouped by foreign-key clusters or by schema name, producing a coherent `schema-map.md` at the end. Progress is visible throughout. No single prompt exceeds token limits.

---

## 5. Functional requirements

### 5.1 The installer

**What it does.** Prepares a directory for AI to Widget use. Creates the `.atw/` tree, copies the slash command markdown files into `.claude/commands/` of the target directory, installs npm dependencies needed by the auxiliary scripts, places a `docker-compose.yml` template at the root.

**Invocation.**
- `npx create-atw@latest <target-dir>` — creates and initializes a new directory.
- `npx create-atw@latest .` — initializes in the current directory.
- `npx create-atw@latest . --force` — allows initializing over an existing `.atw/` (with warning).

**Idempotency.** Running the installer a second time in the same directory detects the existing `.atw/` and refuses unless `--force` is passed.

**Files written.**
- `.atw/config/` (empty)
- `.atw/artifacts/` (empty)
- `.atw/state/` (empty)
- `.atw/templates/` (populated with templates that `/atw.build` will later use — copied verbatim from the AI to Widget package)
- `.claude/commands/atw.init.md`
- `.claude/commands/atw.brief.md`
- `.claude/commands/atw.schema.md`
- `.claude/commands/atw.api.md`
- `.claude/commands/atw.plan.md`
- `docker-compose.yml` (template with ATW services commented out)
- `package.json` (if not present) with the minimum deps the auxiliary scripts need
- `README-atw.md` quickstart

**Post-install message.** Clear, short, tells the Builder exactly the next command: *"Open Claude Code in this directory and run `/atw.init`."*

**Failure modes.** If the target directory contains files that would be overwritten without `--force`, the installer halts with a list of conflicts. If `npm install` fails, the installer reports the error cleanly and points to logs.

### 5.2 Slash command `/atw.init`

**Purpose.** Capture minimal project metadata before any substantive work.

**Interaction.** Three questions asked in sequence:
1. Project name? (used for slug, file names, container names)
2. Primary language(s) the agent will speak? (free text — single or comma-separated)
3. Deployment type? (choice: customer-facing widget / internal back-office copilot / custom)

**Processing.** No Opus call needed. The command is conversational but deterministic — an auxiliary script collects answers and writes the artifact.

**Output.** `.atw/config/project.md` following the structure of `examples/sample-brief.md`'s project header section (name, language, deployment type, creation date).

**Idempotency.** If `project.md` exists, the command loads it, shows the current values, and lets the Builder change any of them.

**Failure modes.** None material — this command is short and cannot fail meaningfully unless disk is full.

### 5.3 Slash command `/atw.brief`

**Purpose.** Capture business context so that every subsequent semantic decision (schema interpretation, API classification, enrichment prompts, runtime system prompt) has a grounded frame of reference. This is the anchoring document for all semantic work.

**Interaction.** Multi-turn conversation, typically 10-15 minutes. Questions adapt to earlier answers. Sequence (not rigid):
1. What does your client do / what do they sell?
2. Who are their customers?
3. What should the agent be able to do? Give examples.
4. What should the agent never do?
5. What tone should the agent use?
6. Primary use cases the Builder imagines (3-5 examples)?
7. Business vocabulary / glossary terms the agent should know?
8. Any anti-patterns or known pitfalls specific to the client's industry?

**Processing.** Claude Code (acting as the command) holds the conversation, then calls Opus once at the end to synthesize the answers into a structured draft following the `examples/sample-brief.md` structure. The draft is shown to the Builder. The Builder edits or confirms. Only after confirmation is the final `brief.md` written to disk.

**Internal prompt for the synthesis step.** See `PRD.md` §5.2.2 for the prompt template. Key constraints: only include what the Builder stated; do not infer; use the Builder's own phrasing for tone and scope; leave empty sections with a placeholder note rather than fabricating.

**Output.** `.atw/config/brief.md` matching `examples/sample-brief.md` in structure.

**Idempotency.** If `brief.md` exists, Claude Code summarizes what's already there and asks what the Builder wants to change, rather than re-running the full interview.

**Failure modes.**
- Builder gives vague answers → follow-up questions instead of synthesis.
- Builder contradicts themselves → surface the contradiction, ask which applies.
- Opus synthesis fails (rate limit, auth error) → retry up to 3 times, then halt with actionable message.

### 5.4 Slash command `/atw.schema`

**Purpose.** Take a Postgres schema dump, interpret it semantically, and produce a decision document about what to index and how.

**Interaction.** The Builder provides input in one of three ways:
1. Points Claude Code at a file path within the project (e.g., `./schema.sql`).
2. Pastes the contents of the dump into the Claude Code chat.
3. Points Claude Code at a file already staged in `.atw/inputs/` from a prior run.

The Builder may also provide a data sample file (`--data-only --inserts`) alongside the schema.

**Processing.**

*Step 1 (deterministic).* The auxiliary script `packages/scripts/parse-schema.ts` reads the SQL dump and produces a structured JSON representation: every table with its columns (name, type, nullable, default), primary keys, foreign keys, indexes. Uses an existing Node library (e.g., `pgsql-ast-parser` or `node-sql-parser`) — no Opus for this step.

*Step 2 (agentic).* The command invokes Opus with:
- The structured schema from step 1
- The up-to-50-row sample per table (if provided)
- The contents of `project.md` and `brief.md`
- An anchored prompt (see `PRD.md` §5.2.3 for the full template)

Opus classifies every table and proposes field-level decisions for indexable entities. Output is a structured draft of `schema-map.md`.

*Step 3 (interactive).* Claude Code presents the draft to the Builder in chunks (by entity group). The Builder confirms entity by entity, or requests overrides. For larger schemas, the review UI should avoid overwhelming the Builder — offer to skim ignored tables in bulk, then focus on indexable ones.

*Step 4 (deterministic).* On confirmation, the auxiliary script `packages/scripts/write-artifact.ts` writes the final `schema-map.md`.

**Output.** `.atw/artifacts/schema-map.md` matching `examples/sample-schema-map.md`.

**Idempotency.** If `schema-map.md` exists, Claude Code shows a summary of what was indexed before, surfaces what has changed in the schema dump (newly added tables, removed tables, changed columns), and proposes focused updates rather than full re-interpretation.

**Handling large schemas.** If the schema exceeds a reasonable single-prompt size (>100 tables or >500 columns), split processing into chunks along foreign-key clusters. Each chunk is interpreted independently, then a final synthesis pass reconciles cross-chunk decisions.

**PII detection.** Opus is instructed to flag any column whose name or sample values suggest personally identifiable information: `email`, `phone`, names, addresses, payment data, government IDs, free-text biographical fields. PII-flagged columns are excluded from indexing by default, regardless of the containing table's status. PII-heavy tables (customers, addresses, payments) are excluded wholesale.

**Failure modes.**
- SQL parse failure → the script reports the line/column of the failure; Builder fixes and retries.
- Opus classification fails entirely → retry; if persistent, halt with message.
- Builder disagrees with most decisions → Claude Code offers to re-synthesize with explicit new guidance.

### 5.5 Slash command `/atw.api`

**Purpose.** Take an OpenAPI specification, classify every endpoint, and produce the action manifest that defines what tools the runtime agent will have.

**Interaction.** The Builder provides input as:
1. A URL to the OpenAPI spec (JSON or YAML).
2. A local file path.
3. A pasted JSON/YAML document in the chat.

**Processing.**

*Step 1 (deterministic).* `packages/scripts/parse-openapi.ts` fetches and parses the spec using `@apidevtools/swagger-parser`. Output: a normalized list of operations with method, path, parameters, request body, responses, security requirements.

*Step 2 (agentic).* Opus receives the normalized operations plus `project.md`, `brief.md`, and `schema-map.md`. It classifies each operation into one of: public-read, authenticated-user-read, authenticated-user-action (confirmation required), destructive-action (explicit confirmation required), admin-only (exclude), infrastructure (exclude).

For each exposed tool, Opus generates:
- A verb+noun tool name (e.g., `add_to_cart`, `list_orders`, `get_product`).
- A description for the agent's tool-use context, explaining when to use the tool and what not to confuse it with.
- A cleaned-up parameter schema (sometimes simpler than the raw OpenAPI).
- A `requires_confirmation` flag.
- Notes about where the agent should source each parameter (widget context, prior tool call, user's message).

The prompt template for this step is in `PRD.md` §5.2.4. Hard rules: never expose `/admin/*` endpoints to customer-facing agents; when uncertain, exclude; destructive actions always require confirmation.

*Step 3 (interactive).* Claude Code presents the classification grouped by entity (matching the entities in `schema-map.md` where possible). Builder reviews per-entity, overrides as needed.

*Step 4 (deterministic).* On confirmation, write the final `action-manifest.md`.

**Output.** `.atw/artifacts/action-manifest.md` matching `examples/sample-action-manifest.md`, including a system prompt block that the runtime backend will use.

**Idempotency.** If `action-manifest.md` exists, show the current state, surface newly-added or changed endpoints in the spec, propose focused updates.

**Failure modes.**
- Spec unreachable (auth, network) → offer file-path fallback.
- Spec is Swagger 2.0 not OpenAPI 3.x → detect, suggest conversion (e.g., using `swagger2openapi`), retry after conversion.
- Spec has hundreds of endpoints → chunk by path prefix or tag.
- Spec is malformed → swagger-parser error is surfaced cleanly.

### 5.6 Slash command `/atw.plan`

**Purpose.** Consolidate all prior artifacts into an executable build plan that Feature 002's `/atw.build` will follow. Also produces a cost estimate.

**Interaction.** Read-only with respect to user input for most of the command. The Builder's job here is to review, not to generate new content.

**Processing.**

*Step 1.* Read `project.md`, `brief.md`, `schema-map.md`, `action-manifest.md`. Validate that all four exist and are consistent (e.g., entities referenced in the action manifest exist in the schema map).

*Step 2 (agentic).* Opus synthesizes `build-plan.md` per the structure in `examples/sample-build-plan.md`: embedding model choice, category vocabularies for enrichment, enrichment prompt templates per entity type, estimated entity counts, estimated Opus cost with breakdown, backend configuration defaults, widget configuration defaults, build sequence, failure handling per step.

Prompt template in `PRD.md` §5.2.5. Hard rules: decisions must cite source artifacts; every decision must be executable (no "figure out later"); defaults are explained when used.

*Step 3 (interactive).* Claude Code presents:
- A plain-English summary of the plan.
- The estimated Opus cost and build duration.
- A prompt to confirm before writing.

Builder confirms or requests adjustments (e.g., "lower concurrency", "skip regions for now").

*Step 4 (deterministic).* Write `build-plan.md`.

**Output.** `.atw/artifacts/build-plan.md` matching `examples/sample-build-plan.md`.

**Idempotency.** If `build-plan.md` exists, re-synthesize only if upstream artifacts have changed since its last generation (tracked via file hashes in `.atw/state/`).

**Failure modes.**
- Upstream artifact missing → halt, tell Builder which command to run first.
- Upstream artifacts inconsistent (e.g., action references an entity that was excluded) → surface the inconsistency, ask Builder to resolve.

### 5.7 Auxiliary scripts in `packages/scripts/`

All deterministic, typed, unit-tested where it matters. Invoked by slash commands via bash. Input and output through stdin/stdout or files, never through environment state.

Scripts needed by this feature:
- `parse-schema.ts` — Postgres SQL dump → structured JSON
- `parse-openapi.ts` — OpenAPI spec (URL or file) → normalized operations JSON
- `write-artifact.ts` — rendered markdown → file with safety (backup, atomic write)
- `load-artifact.ts` — reads an existing artifact, returns structured representation for idempotency checks
- `validate-artifacts.ts` — cross-checks consistency between artifacts (called by `/atw.plan`)
- `hash-inputs.ts` — produces content hashes for idempotency tracking

Each script has:
- A single responsibility.
- Typed input and output (TypeScript types, optionally validated with zod).
- Non-zero exit code on failure with an actionable stderr message.
- No hidden state — same input produces same output.

### 5.8 Slash command markdown files

Each slash command is a markdown file under `.claude/commands/atw.{name}.md`. The installer copies these from the AI to Widget package at init time. The structure of each file:

```markdown
# /atw.{name}

<natural-language description of the command's purpose>

## Context files to read first
- constitution.md
- examples/sample-{artifact}.md

## Steps

1. Check if the existing artifact exists at {path}; if so, enter refinement mode (see below).
2. Gather input (specific to the command).
3. Invoke the auxiliary script {script-name} with the input.
4. Analyze / synthesize (agentic step — may call Opus).
5. Present the proposal to the Builder; iterate until confirmation.
6. Invoke the auxiliary script `write-artifact.ts` to commit.
7. Report success and suggest the next command.

## Refinement mode
<instructions for re-running idempotently>

## Anchored prompt template for Opus
<the prompt used in the agentic step, with placeholders for inputs>

## Failure handling
<specific failure modes for this command>
```

These markdown files are themselves **inputs** to Claude Code, not code. The quality of the Builder's experience depends heavily on how well they're written. They are the most important output of this feature after the artifacts themselves.

---

## 6. Artifacts produced by this feature

After Feature 001 completes and the Builder runs the full flow against the Aurelia demo:

```
<project-root>/
├── .atw/
│   ├── config/
│   │   ├── project.md
│   │   └── brief.md
│   ├── artifacts/
│   │   ├── schema-map.md
│   │   ├── action-manifest.md
│   │   └── build-plan.md
│   ├── state/
│   │   └── input-hashes.json     (for idempotency tracking)
│   └── templates/                (staged for /atw.build, not yet used)
├── .claude/
│   └── commands/
│       ├── atw.init.md
│       ├── atw.brief.md
│       ├── atw.schema.md
│       ├── atw.api.md
│       └── atw.plan.md
├── docker-compose.yml            (ATW services commented out)
├── package.json
└── README-atw.md
```

The AI to Widget package itself (the source of the commands, scripts, and installer) lives separately:

```
ai-to-widget/
├── packages/
│   ├── installer/
│   │   ├── src/
│   │   ├── package.json
│   │   └── bin/
│   └── scripts/
│       ├── parse-schema.ts
│       ├── parse-openapi.ts
│       ├── write-artifact.ts
│       ├── load-artifact.ts
│       ├── validate-artifacts.ts
│       └── hash-inputs.ts
├── commands/
│   ├── atw.init.md
│   ├── atw.brief.md
│   ├── atw.schema.md
│   ├── atw.api.md
│   └── atw.plan.md
├── templates/
│   └── docker-compose.yml.tmpl
└── package.json
```

---

## 7. Non-functional requirements

**Language and ecosystem.** TypeScript only. Node ≥ 20. No Python runtime. See Constitution Principle 7.

**Installer size.** Under 10MB of npm install footprint for the Builder's project; the majority of deps are dev-only (TypeScript compiler, test framework).

**Performance.**
- Installer completes in under 60 seconds on a typical machine with good internet.
- `/atw.init` completes in seconds (deterministic).
- `/atw.brief` synthesis Opus call completes in under 30 seconds.
- `/atw.schema` on a 300-table dump completes in under 5 minutes.
- `/atw.api` on a 127-endpoint spec completes in under 2 minutes.
- `/atw.plan` completes in under 90 seconds.

**Cost.**
- `/atw.init` — zero Opus calls.
- `/atw.brief` — 1 Opus call (synthesis).
- `/atw.schema` — 1-5 Opus calls depending on chunking.
- `/atw.api` — 1-3 Opus calls depending on chunking.
- `/atw.plan` — 1 Opus call.
- Total budget for one complete setup run on Aurelia-scale project: under $2.

**Privacy.** No network calls other than Anthropic's API (for Opus) and, in `/atw.api`, fetching the OpenAPI spec URL if one is provided. No telemetry.

**Security.**
- No production database connection strings requested, stored, or transmitted.
- SQL dumps pasted into Claude Code never leave the Builder's machine except through the Anthropic API for inference.
- The AI to Widget installer pins dependency versions and does not fetch code from arbitrary URLs.

**Accessibility.** Markdown files are human-readable, version-controllable, directly editable. The Builder can edit any artifact in their editor between commands.

**Reproducibility.** Running the flow twice on the same inputs produces semantically equivalent artifacts. Prose may differ (Opus is stochastic) but structural decisions (which tables indexed, which actions exposed) must be stable.

---

## 8. Success criteria for this feature

Concrete, verifiable outcomes:

1. **Installer works fresh.** On a fresh macOS, Linux, or WSL2 machine with Node 20 installed, running `npx create-atw@latest test-project` produces a working `.atw/` structure and usable `.claude/commands/` in under 60 seconds.

2. **Full-flow Aurelia run.** A Builder following the documented steps can complete `/atw.init` → `/atw.brief` → `/atw.schema` → `/atw.api` → `/atw.plan` on the Aurelia Medusa demo in under 30 minutes. The resulting artifacts match the shape of `examples/` (not identical prose, but same structure, same major decisions).

3. **PII detection.** On the Aurelia Medusa schema, the `customer`, `customer_address`, `payment`, and similar PII-heavy tables are automatically flagged and excluded without the Builder having to intervene.

4. **Admin endpoints excluded.** On the Medusa OpenAPI spec, all `/admin/*` endpoints are classified as admin-only and excluded from the action manifest without the Builder having to intervene.

5. **Idempotent re-runs.** Re-running any of the five commands a second time without changing inputs does not lose prior decisions. It detects the existing artifact and offers focused refinement.

6. **Direct editing preserved.** Manually editing any artifact in a text editor, then running a subsequent command, respects the edit.

7. **Cost awareness.** `/atw.plan` displays a cost estimate that is within 20% of the actual cost incurred by Feature 002's enrichment run.

8. **Constitution compliance.** The feature adheres to principles 1 (no production credentials), 2 (markdown as source of truth), 3 (idempotent), 4 (human-in-the-loop — every artifact confirmed before write), 6 (agentic vs deterministic separation), 9 (Opus only where needed).

---

## 9. Handoff to Feature 002

Feature 002 (`/atw.build`) assumes the following are present and valid when it runs:

- `.atw/config/project.md` — readable, non-empty, valid structure.
- `.atw/config/brief.md` — readable, non-empty.
- `.atw/artifacts/schema-map.md` — readable, non-empty, structurally matches `examples/sample-schema-map.md`.
- `.atw/artifacts/action-manifest.md` — readable, non-empty, structurally matches `examples/sample-action-manifest.md`.
- `.atw/artifacts/build-plan.md` — readable, non-empty, structurally matches `examples/sample-build-plan.md`.
- `.atw/templates/` — populated with templates for the backend and widget (staged by the installer; not modified by this feature).
- `docker-compose.yml` — present at the project root with ATW services defined (commented out).

If any of these is missing or malformed when Feature 002 runs, `/atw.build` must fail cleanly with a message telling the Builder which Feature 001 command to run or re-run.

---

## 10. Out of scope for this feature (explicit reminder)

- Starting any Postgres container.
- Computing any embeddings.
- Generating any runtime code (backend, widget).
- Ingesting any data from the SQL dump into a running database.
- Calling Opus for enrichment (that's the build phase).
- Anything that produces a running service or compiled artifact.

If spec-kit proposes any of the above during `/speckit.plan`, push back. They belong to Features 002 or 003.

---

## 11. Failure modes and edge cases

| Situation | Handling |
|---|---|
| Installer run in an already-initialized directory without `--force` | Halt with clear conflict report |
| Claude Code session closed mid-flow | All partial state is in markdown artifacts on disk; Builder resumes by re-opening and running the next command |
| Builder's SQL dump is malformed | Deterministic parser fails cleanly with line/column info |
| OpenAPI spec URL requires auth | Ask Builder for a local file as fallback |
| Schema so large it exceeds a single-prompt capacity | Chunk by FK clusters; Opus synthesis per chunk; final reconciliation pass |
| Opus API auth error during a command | Halt, clear message about `ANTHROPIC_API_KEY` env var |
| Opus rate limit (429) | Retry with exponential backoff; halt after 3 failures |
| `.atw/` accidentally deleted or corrupted mid-flow | Commands detect and offer to reinitialize with `--force`; existing source inputs (SQL, OpenAPI) are preserved |
| Builder disagrees with >50% of Opus's schema interpretation | Surface this as a sign the brief may be underspecified; suggest revisiting `/atw.brief` before `/atw.schema` |
| PII detection misses a column the Builder knows contains sensitive data | Builder can flag it manually during review or by editing `schema-map.md` directly |

---

## 12. Constitution principles that apply most strongly

- **P1 (User Data Sovereignty).** No production credentials. Dumps stay on Builder's machine.
- **P2 (Markdown as Source of Truth).** Every decision lands in a markdown file; nothing in hidden state.
- **P3 (Idempotent and Interruptible).** Every command re-entrant.
- **P4 (Human-in-the-Loop by Default).** Nothing committed without confirmation.
- **P5 (Anchored Generation).** Opus cites evidence for every classification.
- **P6 (Composable Deterministic Primitives).** Parsers, writers, validators are typed scripts; Opus is for interpretation.
- **P7 (Single-Ecosystem Simplicity).** TypeScript-only.
- **P9 (Opus as a Tool, Not a Crutch).** Opus calls are budgeted and justified per command.

Deviations from these principles in `/speckit.plan` require explicit justification.

---

*End of Feature 001 specification. Pass this document to `/speckit.specify` along with a prompt like: "Specify this feature based on the document, following the project constitution in constitution.md and referencing the sample artifacts in examples/."*

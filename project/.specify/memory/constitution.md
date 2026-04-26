<!--
Sync Impact Report
==================
Version change: 0.0.0 (unfilled template) → 1.0.0
Bump rationale: Initial ratification. The prior file was the unpopulated speckit
  template with every placeholder token intact. This revision replaces all
  placeholders with the ten principles authored in /constitution.md at the
  project root and adopts them as binding for Ai to Widget. MAJOR bump is
  appropriate because this is the first ratified version — no prior semantics
  existed to break.

Added principles (all new — first ratification):
  - I. User Data Sovereignty
  - II. Markdown as Source of Truth
  - III. Idempotent and Interruptible
  - IV. Human-in-the-Loop by Default
  - V. Anchored Generation
  - VI. Composable Deterministic Primitives
  - VII. Single-Ecosystem Simplicity
  - VIII. Reproducibility as a First-Class Concern
  - IX. Opus as a Tool, Not a Crutch
  - X. Narrative-Aware Engineering

Modified principles: N/A (initial ratification)
Removed principles: N/A

Added sections:
  - Priority Ordering (meta-principle governing conflict resolution)
  - Development Workflow & Quality Gates
  - Governance

Removed sections: All [SECTION_*] template placeholders; their intent is
  subsumed by the three added sections above.

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — "Constitution Check" gate references
       the constitution file generically; no wording change needed. Each /plan
       output MUST evaluate the ten principles, with special attention to
       Priority 1–3 red lines.
  - ✅ .specify/templates/spec-template.md — no principle mandates new mandatory
       spec sections; aligned.
  - ✅ .specify/templates/tasks-template.md — tests remain OPTIONAL, consistent
       with the absence of a test-first principle here; no change required.
  - ✅ /constitution.md (project root) — source document, kept in sync with
       this file verbatim on principle text.
  - ⚠ README.md — does not yet exist. Principle VIII (Reproducibility) requires
       a `git clone && docker compose up` quickstart tested on macOS, Linux,
       and WSL2. Create when scaffolding begins; flag pending until then.
  - ⚠ CLAUDE.md — currently minimal (points to the active plan). Expand to
       reference this constitution as the runtime guidance anchor once plans
       begin landing.

Follow-up TODOs: None deferred. All placeholders are resolved.
-->

# Ai to Widget Constitution

> **Purpose.** This document establishes the foundational principles that guide
> every decision in the Ai to Widget project — architectural, product,
> engineering, and operational. When `/speckit.plan` or any subsequent phase
> must choose between competing options, it defers to these principles first.
>
> **Status.** These principles are deliberately opinionated. They reflect
> specific decisions made during the design phase and encode the project's
> priorities. Deviations require explicit justification in the relevant plan or
> task document.
>
> **Ten principles.** Not five, not twenty. Each one earns its place.

## Core Principles

### I. User Data Sovereignty (NON-NEGOTIABLE)

**Principle.** The Builder's client data never leaves the Builder's control. Ai
to Widget MUST NOT ask for, transmit, or store production database connection
strings, and MUST NOT handle end-user authentication credentials.

**Rationale.** Every enterprise customer a Builder serves has hard constraints
about where their data lives and who can see it. A tool that requires
production database access is dead on arrival for most target markets. Making
this non-negotiable from day one avoids painting ourselves into a corner and
sidesteps an entire class of security incidents — we cannot leak credentials we
never held.

**In practice.**
- `/atw.schema` accepts only SQL dumps the Builder generates manually
  (`pg_dump --schema-only`, `pg_dump --data-only --inserts`).
- No component calls back to a client's production database.
- The backend MUST NOT store end-user session tokens, JWT bearer tokens, or any
  identifying authentication material — not even transiently.
- Widget actions attach credentials client-side via
  `fetch(url, { credentials: 'include' })` or a configured bearer-token
  provider. The backend is never in the credential path.
- Server logs MUST NOT include raw authentication headers; tokens, if logged
  at all, MUST be redacted.

**Rules out.**
- A "cloud version" that ingests directly from client databases.
- Any feature that proxies authenticated API calls through the backend on
  behalf of end users.
- "Just for convenience" connection strings stored even temporarily in config.
- A future `--auto-sync-from-db` flag that would normalize this behavior.

**Related.** Enables [V. Anchored Generation]. Enabled by
[VI. Composable Deterministic Primitives].

### II. Markdown as Source of Truth

**Principle.** Every piece of configuration, every decision the system makes
about a client's data, and every artifact produced during setup MUST live as
human-readable markdown in `.atw/`. There is no hidden state.

**Rationale.** The Builder MUST be able to understand, audit, edit,
version-control, and share every decision the system has made. A black-box
config database or serialized binary state would make Ai to Widget impossible
to debug, onboard teammates onto, or review in a pull request. Markdown is
slow to parse machine-side but infinitely readable human-side — and LLMs parse
it trivially. The trade-off is correct.

**In practice.**
- `schema-map.md`, `action-manifest.md`, `build-plan.md`, and every other
  artifact are literal markdown files.
- The Builder can open any artifact in their editor and change a decision. The
  next `/atw.build` respects the edit.
- Git shows the complete evolution of an agent over time.
- Teams review an Ai to Widget setup in a pull request, just like code.

**Rules out.**
- A SQLite or Postgres table that holds "which tables to index" — that
  information lives in `schema-map.md`.
- A binary format, even a "faster" one, for any configuration.
- An embedded UI that stores choices in a frontend state manager before
  writing to disk.
- YAML over markdown, unless a specific artifact has hierarchical structured
  data that markdown lists cannot represent naturally (prefer code-fenced JSON
  inside a markdown file even then).

**Related.** Enables [III. Idempotent and Interruptible]. Enables
[IV. Human-in-the-Loop by Default].

### III. Idempotent and Interruptible

**Principle.** Every slash command MUST be re-runnable at any point. Re-running
MUST NOT destroy prior work; it MUST detect existing state and offer
refinement. The Builder can stop mid-flow and return hours or days later.

**Rationale.** Setup is a multi-step process over large inputs (schemas, API
specs, catalogs with thousands of rows). A single hackathon-style happy path
that assumes completion in one sitting is unrealistic. Real Builders will
discover mid-flow that they need to exclude a table they already indexed, or
that their OpenAPI spec was outdated. The system MUST accommodate this without
forcing a full restart.

**In practice.**
- Re-running `/atw.schema` loads the existing `schema-map.md`, shows what was
  decided, and offers refinement rather than re-asking every question.
- `/atw.build` detects what has changed since the last build and re-processes
  only the delta.
- Interrupted enrichment runs resume: already-enriched entities are skipped.
- Any artifact MAY be deleted to force a full re-run of its producing command.

**Rules out.**
- Any slash command that starts from scratch without detecting existing state.
- A "setup wizard" UX that forces linear progression through all steps.
- Destructive operations without confirmation — re-running `/atw.build` MUST
  NOT drop data without asking.
- Hidden caches that bypass the "re-run = re-validate" model.

**Related.** Depends on [II. Markdown as Source of Truth]. Supports
[IV. Human-in-the-Loop by Default].

### IV. Human-in-the-Loop by Default

**Principle.** Opus proposes, the Builder decides. Every material decision —
what to index, what actions to expose, what tone the agent adopts — MUST pass
through human review before it becomes binding.

**Rationale.** Opus is capable but not infallible, and it lacks business
context the Builder holds. A system that quietly interprets a schema and
builds an agent on its first-pass guess will produce agents that embarrass the
Builder in front of their clients. The cost of a review click is trivial; the
cost of an unsupervised hallucination in production is potentially existential.
This principle also gives the Builder agency — they direct the system, not the
reverse.

**In practice.**
- Every slash command that produces a material artifact presents its proposal
  to the Builder for confirmation before writing.
- Destructive actions in the runtime (anything with side effects visible to
  the end user) require explicit UI confirmation in the widget — never
  one-click execution of a multi-step agent plan.
- The enrichment review step shows a sample of Opus's semantic documents
  before committing the full run.
- The Builder can always say "no" and redirect without losing prior work.

**Rules out.**
- An `--auto-approve` flag as the default mode (MAY exist for CI/automation,
  but MUST NOT be default).
- Agent behavior that silently executes destructive actions "because it was
  obvious the user wanted it."
- Setup flows that commit decisions to disk before the Builder has seen them.
- A "just pick reasonable defaults" fallback that skips review when Opus's
  confidence is high — confidence is not a proxy for correctness.

**Related.** Enabled by [II. Markdown as Source of Truth]. Enforced by
[V. Anchored Generation].

### V. Anchored Generation (NON-NEGOTIABLE)

**Principle.** Opus's creative output — enrichments, summaries, explanations —
MUST be grounded in the Builder's actual data. Every claim the agent makes
about a product, customer, or entity MUST trace back to a source field. No
invented facts, no plausible-sounding fabrications.

**Rationale.** Hallucination is the failure mode that will get Ai to Widget
uninstalled. An agent that tells a customer a product is "hypoallergenic" when
nothing in the data says so is worse than no agent at all — it creates legal
and reputational risk for the client. Our defense is structural: enrichment
prompts forbid claims without a source, every enriched document carries
internal provenance, and the Builder audits enrichment before it goes live.

**In practice.**
- Enrichment prompts include hard rules: *"You may only state facts directly
  supported by the input fields. Every claim MUST reference the field it comes
  from. If the information is not in the input, you MUST NOT infer it."*
- Output separates **facts** (what the data says) from **categories** (how we
  classify semantically for retrieval). Categories are interpretive but
  bounded; facts are verbatim.
- Review surfaces internal citations so the Builder can spot-check.
- Runtime quoted data (e.g., *"4.5 stars from 38 reviews"*) MUST come from
  retrieved content, not agent imagination.
- PII-marked fields are excluded from retrieval by design, not by convention.

**Rules out.**
- Enrichment prompts that invite creative elaboration without constraints.
- Answering *"I don't know"* as *"it's probably X"* to seem helpful.
- Retrieval augmentation with general-knowledge priors — the agent is an
  expert on *this* client's data, not a generic chatbot with a little context.

**Related.** Directly supports [IV. Human-in-the-Loop by Default]. Protected
by [I. User Data Sovereignty].

### VI. Composable Deterministic Primitives

**Principle.** Agentic reasoning (Opus calls, slash commands, multi-step
inference) and deterministic execution (parsing, embedding, database I/O, file
generation) MUST be separate layers. The agentic layer decides *what* to do;
the deterministic layer reliably *does* it.

**Rationale.** Letting Opus do everything — parse SQL, compute embeddings,
write to Postgres, generate code — is tempting and produces impressive demos.
It is also a reliability disaster. Agentic code is non-deterministic by
design; "the same input produces similar outputs" is not a usable guarantee
when you need a schema dump parsed correctly, 5,000 embeddings inserted
without duplicates, or a config file rendered with exact formatting.
Separation is what makes the system predictable.

**In practice.**
- Slash commands invoke auxiliary scripts (`scripts/parse-schema.ts`,
  `scripts/fetch-openapi.ts`, `scripts/embed-entities.ts`) that each do one
  deterministic thing.
- Opus is invoked when work requires semantic interpretation (*what does this
  table mean? which endpoints are admin-only? what does this product describe?*)
  and never to do work a regex or typed function could handle.
- Production code (backend, widget) is rendered from templates with values
  from the markdown artifacts. Opus does not freehand this code during build.
- Deterministic failures are typed, logged, and actionable. Opus failures let
  the slash command decide: retry, fall back, or ask the Builder.

**Rules out.**
- Using Opus to parse JSON because the prompt is shorter than writing code.
- Agentic backends that re-reason about which endpoint to call per request.
- Code generation by Opus for files that land in the Builder's repo without
  human review.
- Hiding deterministic logic inside prompts because "the model can handle it."

**Related.** Supports [III. Idempotent and Interruptible]. Supports
[VII. Single-Ecosystem Simplicity].

### VII. Single-Ecosystem Simplicity

**Principle.** Unless there is a strong reason to deviate, all code is
TypeScript on Node.js ≥ 20. Postgres holds both relational data and vector
embeddings. Docker Compose orchestrates locally. Fewer ecosystems means fewer
context switches, fewer build tools, fewer ways for things to go wrong.

**Rationale.** A hackathon project with four language runtimes, three message
queues, and two databases fails in ways the team didn't anticipate — not
because any choice is wrong, but because failure modes multiply. Every added
ecosystem is a tax on attention. One ecosystem and its accepted limitations is
almost always correct for projects under two weeks.

**In practice.**
- Backend, widget, scripts, CLI installer — all TypeScript.
- Embeddings run locally via `@xenova/transformers` (ONNX ports of
  sentence-transformers) rather than a Python subprocess.
- One Postgres container handles reference data, enriched entity documents,
  and vector indexes via `pgvector`.
- Docker Compose is the orchestration layer. No Kubernetes, no Docker Swarm,
  no Nomad.
- Configuration is environment variables plus markdown files. No YAML-based
  service definition frameworks.

**Rules out.**
- Python side-services unless no Node equivalent exists (for
  `@xenova/transformers` specifically, a Node port exists and is chosen).
- Separate vector databases (Qdrant, Weaviate, Pinecone) — pgvector handles
  the scale Ai to Widget needs.
- Multi-language code generation (e.g., a Go worker for speed). Save that for
  post-hackathon.
- Monorepo tooling beyond strict need (one `package.json` with workspaces is
  fine; Turborepo/Nx is overkill for this scope).

**Related.** Complements [VI. Composable Deterministic Primitives].

### VIII. Reproducibility as a First-Class Concern (NON-NEGOTIABLE)

**Principle.** `git clone && docker compose up` MUST produce a working demo on
any machine with Docker and Claude Code installed. Every step of the demo
MUST be reproducible with a fixed seed, a pinned image version, and an
explicit dependency.

**Rationale.** A hackathon submission that requires the judge to *"install
these three things, configure that file, remember to set this environment
variable"* is a submission the judge will not evaluate. The path from
`git clone` to *"I can see it work"* MUST be short enough that a tired
reviewer at 11pm on judging day completes it. Beyond the hackathon,
reproducibility is what makes open-source adoption possible.

**In practice.**
- Every service in `docker-compose.yml` pins an exact image tag (no `:latest`).
- Seed data for the Medusa demo is committed to the repo, not downloaded from
  a flaky CDN.
- Random seeds in embedding generation are fixed where deterministic output
  matters (testing), and left variable where production behavior benefits.
- The README's quickstart is tested on macOS, Linux, and WSL2-on-Windows
  before the hackathon deadline.
- The demo includes pre-built `.atw/` artifacts so a reviewer can see the
  runtime working in under 2 minutes without completing full setup.

**Rules out.**
- *"Install Node 20 from nvm, then Python 3.11 from pyenv, then run..."* as a
  quickstart.
- Dependencies that fetch at runtime from GitHub master branches.
- "Works on my machine" configurations documented nowhere.
- Secret values that MUST be manually provided for the demo to work (a
  dev-only Anthropic API key with minimal quota MAY be acceptable, documented
  as such).

**Related.** Enforced by [VII. Single-Ecosystem Simplicity]. Supports
[X. Narrative-Aware Engineering].

### IX. Opus as a Tool, Not a Crutch

**Principle.** Opus 4.7 is invoked where its unique capabilities matter —
semantic interpretation, conversational reasoning, anchored generation over
rich context. It MUST NOT be invoked for work that a typed function or a
regex can do. Every Opus call MUST justify its existence.

**Rationale.** The $500 API budget is substantial but not infinite, and
runtime latency per call matters. More importantly: Opus is a tool with
appropriate and inappropriate uses. Piping every decision through Opus
degrades the project in three ways — it slows the hackathon, it obscures
logic (you cannot easily debug "why did the LLM decide X?"), and it trains
the team to outsource thinking to the model.

**In practice.**
- Schema parsing: deterministic (Node SQL parser).
- Schema interpretation: agentic (*"this table of `sku_inventory_movements` is
  internal audit, probably ignore, please confirm"* needs domain reasoning).
- OpenAPI parsing: deterministic (`@apidevtools/swagger-parser`).
- OpenAPI endpoint classification: agentic (*"which of these 120 endpoints
  should the agent be allowed to call?"* is judgment).
- Embedding: deterministic, local, no LLM.
- Enrichment: agentic (Opus's anchored semantic generation shines here).
- Runtime retrieval: deterministic (pgvector query).
- Runtime response generation: agentic (Opus synthesizes).
- Tool-call decision at runtime: agentic.
- Tool-call execution: deterministic (widget does HTTP).

**Rules out.**
- Wrapping Opus in LangChain or LlamaIndex. Those frameworks' abstractions add
  complexity without proportionate value at this scope.
- Using Opus to format JSON because writing the format is "boring."
- Asking Opus for math, date arithmetic, or deterministic lookups that code
  handles reliably and freely.
- Piping error logs through Opus for summarization during the hackathon.

**Related.** Enables [VI. Composable Deterministic Primitives]. Supports
cost control within the $500 budget.

### X. Narrative-Aware Engineering

**Principle.** The three-minute demo video is a design constraint, not a
post-hoc artifact. Features that cannot be shown in the video go to roadmap.
Polish that does not survive in the video is deprioritized against polish
that does. Every hour spent is evaluated against its contribution to either
(a) the video narrative or (b) the judging criteria.

**Rationale.** The hackathon rubric is explicit: 30% Impact, 25% Demo, 25%
Opus creative use, 20% Depth. A project that ignores this rubric and
optimizes for "coolness" or "completeness" loses to one that clearly serves
it. The video is the primary artifact the jury evaluates; everything else is
evidence to back it up. This principle applies engineering judgment at the
scope-setting level.

**In practice.**
- The demo flow is storyboarded before the code is written.
- When a feature decision arises, the question is *"does this appear in the
  video or does it materially improve what appears in the video?"*
- We prefer one clean, rehearsable widget interaction over five half-working
  ones.
- Setup UX polish the Builder sees but the jury does not matters less than
  runtime UX polish the jury does see.
- Sunday (deadline day) is allocated for video recording, not coding.

**Rules out.**
- Features built because they're interesting but that do not reach the demo.
- "Polish" that does not survive compression to 3 minutes (micro-animations,
  tooltips in setup UI).
- Treating the video as something to worry about on the last day.
- Over-scoping during the first 48 hours based on enthusiasm rather than
  evaluation against the rubric.

**Related.** Grounded by [VIII. Reproducibility]. Complements
[IV. Human-in-the-Loop by Default].

## Priority Ordering (Meta-Principle)

Principles are not equal. When they conflict, the order is:

1. **I. User Data Sovereignty** — never traded for any other value.
2. **V. Anchored Generation** — correctness over cleverness.
3. **VIII. Reproducibility** — a broken demo invalidates everything else.
4. **IV. Human-in-the-Loop** — the Builder is always in charge.
5. **X. Narrative-Aware Engineering** — scope decisions in hackathon context.
6. **II. Markdown as Source of Truth** — the storage model.
7. **III. Idempotent and Interruptible** — the UX model.
8. **VI. Composable Deterministic Primitives** — the reliability model.
9. **VII. Single-Ecosystem Simplicity** — the complexity budget.
10. **IX. Opus as a Tool, Not a Crutch** — the LLM-usage discipline.

The top three (I, V, VIII) are **red lines**. The bottom seven are strong
defaults with named escape hatches. A plan or task that violates a
lower-priority principle to satisfy a higher-priority one is correct
engineering. A plan that violates a red line is wrong, full stop.

## Development Workflow & Quality Gates

**Constitution Check (plan phase).** Every `/speckit.plan` output MUST include
an explicit Constitution Check that evaluates the proposed approach against
all ten principles. Red-line principles (I, V, VIII) MUST pass unconditionally.
Lower-priority principle violations MUST be recorded in the plan's Complexity
Tracking table with justification and the simpler alternative that was
rejected (and why).

**Review gate (any artifact-producing command).** Per Principle IV, every
slash command producing a material artifact MUST present its proposal for
Builder confirmation before writing. `/speckit.specify`, `/speckit.plan`,
`/speckit.tasks`, `/speckit.implement`, and `/atw.*` commands each fall under
this rule.

**Complexity justification.** Any addition of a new language runtime, a new
datastore beyond Postgres+pgvector, a new orchestration layer beyond Docker
Compose, or a new third-party framework in the runtime path (LangChain,
LlamaIndex, Turborepo, etc.) requires explicit justification per Principles
VII and IX. Default is refusal.

**Testing stance.** The constitution does NOT mandate test-first development.
Tests are OPTIONAL per the tasks template and are added where they earn their
keep. Principle VIII (Reproducibility) is the dominant correctness discipline:
a green end-to-end demo is the minimum bar.

**Review citation.** When a PR or task document makes a non-trivial decision,
it MUST cite the principle(s) that informed the decision. Reviewers MUST flag
decisions that appear to violate a principle without naming it.

## Governance

**Authority.** This constitution supersedes competing practices, prior
conventions, and ad-hoc preferences expressed elsewhere in the repo. When
`CLAUDE.md`, a plan, a task, or inline documentation conflicts with this
document, the constitution wins until the conflict is resolved via
amendment.

**Amendment procedure.** Amendments are proposed via pull request. The PR
MUST:
1. Identify the principle(s) being added, modified, or removed.
2. Justify the change against the Priority Ordering (a lower-priority
   principle change is routine; a red-line change requires explicit approval).
3. Propose a version bump per the versioning policy below.
4. Update the Sync Impact Report at the top of this file.
5. Propagate any required changes to dependent templates
   (`.specify/templates/*.md`), runtime guidance (`CLAUDE.md`,
   `README.md`), and the root-level `constitution.md` source document.

**Versioning policy.** Semantic versioning applied to governance, not code:
- **MAJOR** — Backward-incompatible governance or principle change (removing
  a principle, redefining a red line, inverting a priority).
- **MINOR** — New principle added or a principle materially expanded.
- **PATCH** — Clarifications, wording, typo fixes, non-semantic refinements.

When in doubt, propose the reasoning in the PR and let review decide.

**Compliance review.** `/speckit.analyze` serves as the cross-artifact
compliance check: it MUST verify that spec, plan, and tasks remain consistent
with this constitution. Red-line violations surfaced by `/speckit.analyze`
block progression to `/speckit.implement` until resolved.

**Runtime guidance.** `CLAUDE.md` at the project root is the entry point for
agent-facing runtime guidance. It MUST reference this constitution as the
binding source for non-trivial decisions. `README.md` (when it exists) MUST
carry the reproducible quickstart required by Principle VIII.

**Ratification record.** This constitution was ratified at the start of the
*Built with Opus 4.7: a Claude Code hackathon* (April 21–28, 2026).

**Version**: 1.0.0 | **Ratified**: 2026-04-21 | **Last Amended**: 2026-04-21

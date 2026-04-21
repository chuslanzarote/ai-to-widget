# Ai to Widget — Project Constitution

> **Purpose.** This document establishes the foundational principles that guide every decision in the Ai to Widget project — architectural, product, engineering, and operational. When `/speckit.plan` or any subsequent phase must choose between competing options, it defers to these principles first.
>
> **Status.** These principles are deliberately opinionated. They reflect specific decisions made during the design phase and encode the project's priorities. Deviations require explicit justification in the relevant plan or task document.
>
> **Format.** Each principle includes: the principle statement, the rationale behind it, concrete examples of what it means in practice, examples of what it rules out, and how it relates to other principles.
>
> **Ten principles.** Not five, not twenty. Each one earns its place.

---

## Principle 1: User Data Sovereignty

**Principle.** The Builder's client data never leaves the Builder's control. Ai to Widget never asks for, transmits, or stores production database connection strings, and never handles end-user authentication credentials.

**Rationale.** Every enterprise customer a Builder serves will have hard constraints about where their data lives and who can see it. A tool that requires production database access is dead on arrival for most target markets. Making this principle non-negotiable from day one means we never paint ourselves into a corner. It also sidesteps an entire class of security incidents: we cannot leak credentials we never had.

**What this looks like in practice.**
- The `/atw.schema` command accepts only SQL dumps the Builder generates manually (`pg_dump --schema-only`, `pg_dump --data-only --inserts`).
- No component calls back to a client's production database.
- The Ai to Widget backend never stores end-user session tokens, JWT bearer tokens, or any identifying authentication material — not even transiently.
- When the widget executes an action, credentials are attached client-side via `fetch(url, { credentials: 'include' })` or a configured bearer-token provider. The Ai to Widget backend is never in the credential path.
- Server logs must never include raw authentication headers; if logged at all, tokens are redacted.

**What this explicitly rules out.**
- A "cloud version" of Ai to Widget that ingests directly from client databases.
- Any feature that proxies authenticated API calls through the backend on behalf of end users.
- "Just for convenience" connection strings stored even temporarily in config files.
- A future `--auto-sync-from-db` flag that would normalize this behavior.

**Related principles.** Enables [Principle 5: Anchored Generation] (no data leaks means nothing leaks into context it shouldn't). Enabled by [Principle 6: Composable Deterministic Primitives] (the dump-based workflow requires deterministic ingestion tooling).

---

## Principle 2: Markdown as Source of Truth

**Principle.** Every piece of configuration, every decision the system makes about a client's data, and every artifact produced during setup lives as human-readable markdown in `.atw/`. There is no hidden state.

**Rationale.** The Builder must be able to understand, audit, edit, version-control, and share every decision the system has made about their client's agent. A black-box config database or serialized binary state would make Ai to Widget impossible to debug, impossible to onboard a teammate onto, and impossible to review in a pull request. Markdown is slow to read machine-side but is infinitely readable human-side — and LLMs parse markdown trivially. The trade-off is correct.

**What this looks like in practice.**
- `schema-map.md`, `action-manifest.md`, `build-plan.md` and every other artifact are literal markdown files.
- The Builder can open any artifact in their editor and change a decision. The next `/atw.build` respects the edit.
- Git shows the complete evolution of an agent over time: *"on commit X we stopped indexing the `audit_log` table, on commit Y we added the `refund_order` action"*.
- Teams can review an Ai to Widget setup in a pull request, just like code.

**What this explicitly rules out.**
- A SQLite or Postgres table that holds "which tables to index" — that information lives in `schema-map.md`.
- A binary format, even a "faster" one, for any configuration.
- An embedded UI in the setup flow that stores choices in a frontend state manager before writing to disk.
- YAML over markdown, unless a specific artifact has hierarchical structured data that markdown lists cannot represent naturally (and even then, prefer code-fenced JSON inside a markdown file).

**Related principles.** Enables [Principle 3: Idempotent and Interruptible] (markdown files are trivially re-entrant). Enables [Principle 4: Human-in-the-Loop by Default] (humans can only review what they can read).

---

## Principle 3: Idempotent and Interruptible

**Principle.** Every slash command can be re-run at any point. Re-running never destroys prior work; it detects existing state and offers refinement. The Builder can stop mid-flow and come back hours or days later.

**Rationale.** Setup is a multi-step process that involves large inputs (schemas, API specs, catalogs with thousands of rows). A single hackathon-style happy path that assumes the Builder will complete everything in one sitting is unrealistic. Real Builders will discover mid-flow that they need to exclude a table they already indexed, or that their OpenAPI spec was outdated. The system must accommodate this without forcing a full restart.

**What this looks like in practice.**
- Running `/atw.schema` a second time loads the existing `schema-map.md`, shows the Builder what was decided, and offers to refine specific entries rather than re-ask every question.
- `/atw.build` detects what has changed since the last build (tables added to indexing, actions removed, enrichment rules edited) and only re-processes the delta.
- An interrupted enrichment run can be resumed: already-enriched entities are skipped, only the missing ones are processed.
- Any artifact can be safely deleted to force a full re-run of the command that produced it.

**What this explicitly rules out.**
- Any slash command that starts from scratch every time without detecting existing state.
- A "setup wizard" UX that forces linear progression through all steps.
- Destructive operations without confirmation — re-running `/atw.build` must never drop data without asking.
- Hidden caches that bypass the "re-run = re-validate" model.

**Related principles.** Depends on [Principle 2: Markdown as Source of Truth] (if state is in markdown, re-entrance is trivial). Supports [Principle 4: Human-in-the-Loop by Default] (humans make mistakes and need to correct them).

---

## Principle 4: Human-in-the-Loop by Default

**Principle.** Opus proposes, the Builder decides. Every material decision — what to index, what actions to expose, what tone the agent should adopt — passes through human review before it becomes binding.

**Rationale.** Opus is very capable but not infallible, and it lacks business context the Builder has in their head. A system that quietly interprets a schema and builds an agent based on its first-pass guess is going to produce agents that embarrass the Builder in front of their clients. The cost of a review click is trivial; the cost of an unsupervised hallucination deployed to production is potentially existential. This principle also gives the Builder agency — they are directing the system, not being directed by it.

**What this looks like in practice.**
- Every slash command that produces a material artifact presents its proposal to the Builder for confirmation before writing.
- Destructive actions in the runtime (anything with side effects visible to the end user) require explicit UI confirmation in the widget — never one-click execution of a multi-step agent plan.
- The enrichment review step shows the Builder a sample of the semantic documents Opus has produced before committing the full run.
- The Builder can always say "no" and redirect the system to a different choice without losing prior work.

**What this explicitly rules out.**
- An `--auto-approve` flag as the default mode (may exist for CI/automation scenarios, but never default).
- Agent behavior that silently executes destructive actions "because it was obvious the user wanted it."
- Setup flows that commit decisions to disk before the Builder has seen them.
- A "just pick reasonable defaults" fallback that skips review when Opus's confidence is high — confidence is not a proxy for correctness.

**Related principles.** Enabled by [Principle 2: Markdown as Source of Truth] (review requires readable artifacts). Enforced by [Principle 5: Anchored Generation] (bounds what Opus can propose in the first place).

---

## Principle 5: Anchored Generation

**Principle.** Opus's creative output — enrichments, summaries, explanations — must be grounded in the Builder's actual data. Every claim the agent makes about a product, customer, or entity must trace back to a source field. No invented facts, no plausible-sounding fabrications.

**Rationale.** Hallucination is the failure mode that will get Ai to Widget uninstalled. An agent that tells a customer a product is "hypoallergenic" when nothing in the product data says so is worse than no agent at all — it creates legal and reputational risk for the client. Our defense is structural: enrichment prompts explicitly forbid claims without a source, every enriched document carries internal provenance, and the Builder can audit the enrichment before it goes live.

**What this looks like in practice.**
- Enrichment prompts include hard rules: *"You may only state facts that are directly supported by the input fields. Every claim must reference the field it comes from. If the information is not in the input, you must not infer it."*
- The enrichment output format separates **facts** (what the data says) from **categories** (how we classify the data semantically for retrieval). Categories are interpretive but bounded; facts are verbatim.
- The review step surfaces the enrichment's internal citations so the Builder can spot-check.
- Runtime responses that quote data (*"this product has a 4.5 star rating based on 38 reviews"*) must come from retrieved content, not agent imagination.
- PII-marked fields are excluded from retrieval by design, not by convention.

**What this explicitly rules out.**
- Enrichment prompts that invite creative elaboration without constraints.
- Agent behavior that answers *"I don't know"* as *"it's probably X"* to seem helpful.
- Retrieval augmentation with general-knowledge priors — the agent is an expert on *this* client's data, not a generic chatbot with a little context on the side.

**Related principles.** Directly supports [Principle 4: Human-in-the-Loop by Default] (humans review what Opus produces specifically to catch anchoring failures). Protected by [Principle 1: User Data Sovereignty] (without data sovereignty, there's no anchor to anchor to).

---

## Principle 6: Composable Deterministic Primitives

**Principle.** Agentic reasoning (Opus calls, slash commands, multi-step inference) and deterministic execution (parsing, embedding, database I/O, file generation) are separate layers. Agentic layer decides *what* to do; deterministic layer reliably *does* it.

**Rationale.** Letting Opus do everything — parse SQL, compute embeddings, write to Postgres, generate code — is tempting and produces impressive-sounding demos. It is also a reliability disaster. Agentic code is non-deterministic by design; "the same input produces similar outputs" is not a usable guarantee when you need a schema dump parsed correctly, 5,000 embeddings inserted without duplicates, or a config file rendered with exact formatting. The discipline of separating these layers is what makes the system predictable.

**What this looks like in practice.**
- Slash commands invoke auxiliary scripts (`scripts/parse-schema.ts`, `scripts/fetch-openapi.ts`, `scripts/embed-entities.ts`) that do one deterministic thing each.
- Opus is invoked when the work requires semantic interpretation (what does this table *mean*?, which endpoints are admin-only?, what does this product's text actually describe?) and never to do work a regex or a typed function could handle.
- Code that the Builder ends up running in production (backend, widget) is rendered from templates with values from the markdown artifacts. Opus does not write this code freehand during build.
- When a deterministic script fails, the failure is typed, logged, and actionable. When an Opus call fails, the slash command decides whether to retry, fall back, or ask the Builder.

**What this explicitly rules out.**
- Using Opus to parse JSON because the prompt is shorter than writing the code.
- Agentic backends that re-reason about what endpoint to call for every request.
- Code generation by Opus for files that end up in the Builder's repo without human review.
- Hiding deterministic logic inside prompts because "the model can handle it."

**Related principles.** Supports [Principle 3: Idempotent and Interruptible] (deterministic primitives are easy to replay). Supports [Principle 7: Single-Ecosystem Simplicity] (typed TypeScript primitives compose; agentic glue does not).

---

## Principle 7: Single-Ecosystem Simplicity

**Principle.** Unless there's a strong reason to deviate, all code is TypeScript on Node.js ≥ 20. Postgres holds both relational data and vector embeddings. Docker Compose orchestrates locally. Fewer ecosystems means fewer context switches, fewer build tools, fewer ways for things to go wrong.

**Rationale.** A hackathon project with four language runtimes, three message queues, and two databases fails in ways the team didn't anticipate — not because any of those choices is wrong, but because the failure modes multiply. Every added ecosystem is a tax on attention. Picking one ecosystem and accepting its limitations is almost always the right call for projects under two weeks.

**What this looks like in practice.**
- Backend, widget, scripts, CLI installer — all TypeScript.
- Embeddings run locally via `@xenova/transformers` (ONNX ports of sentence-transformers) instead of a Python subprocess.
- One Postgres container handles reference data, enriched entity documents, and vector indexes via `pgvector`.
- Docker Compose is the orchestration layer. No Kubernetes, no Docker Swarm, no Nomad.
- Configuration is environment variables and markdown files. No YAML-based service definition frameworks.

**What this explicitly rules out.**
- Python side-services unless no Node equivalent exists. For `@xenova/transformers` specifically, a Node port exists and is the chosen path.
- Separate vector databases (Qdrant, Weaviate, Pinecone) — pgvector handles the scale Ai to Widget needs.
- Multi-language code generation where the backend is Node but a worker is Go because Go is faster. Save that optimization for post-hackathon.
- Monorepo tooling beyond what is strictly needed (one `package.json` with workspaces is fine; Turborepo/Nx is overkill for this scope).

**Related principles.** Complements [Principle 6: Composable Deterministic Primitives] (fewer ecosystems → fewer primitives to coordinate).

---

## Principle 8: Reproducibility as a First-Class Concern

**Principle.** `git clone && docker compose up` must produce a working demo on any machine with Docker and Claude Code installed. Every step of the demo is reproducible with a fixed seed, a pinned image version, and an explicit dependency.

**Rationale.** A hackathon submission that requires the judge to *"install these three things, configure that file, remember to set this environment variable"* is a submission the judge will not evaluate. The path from `git clone` to *"I can see it work"* must be short enough that a tired reviewer at 11pm on judging day completes it. Beyond the hackathon, reproducibility is also what makes open-source adoption possible: the first experience a user has with Ai to Widget determines whether they persist.

**What this looks like in practice.**
- Every service in `docker-compose.yml` pins an exact image tag (no `:latest`).
- Seed data for the Medusa demo is committed to the repo, not downloaded from a flaky CDN.
- Random seeds in embedding generation are fixed where deterministic output matters (for testing, not for production where we want some variability).
- The README's quickstart is tested on macOS, Linux, and WSL2-on-Windows before the hackathon deadline.
- The demo includes pre-built `.atw/` artifacts so a reviewer can see the runtime working in under 2 minutes, without having to complete the full setup flow.

**What this explicitly rules out.**
- *"Install Node 20 from nvm, then Python 3.11 from pyenv, then run..."* as a quickstart.
- Dependencies that fetch at runtime from GitHub master branches.
- "Works on my machine" configurations documented nowhere.
- Secret values that must be manually provided for the demo to work (a dev-only Anthropic API key with minimal quota may be acceptable for the demo, documented as such).

**Related principles.** Enforced by [Principle 7: Single-Ecosystem Simplicity] (fewer ecosystems are easier to reproduce). Supports [Principle 10: Narrative-Aware Engineering] (a broken demo is a failed narrative).

---

## Principle 9: Opus as a Tool, Not a Crutch

**Principle.** Opus 4.7 is invoked where its unique capabilities matter — semantic interpretation, conversational reasoning, anchored generation over rich context. It is not invoked for work that a typed function or a regex can do. Every Opus call justifies its existence.

**Rationale.** Our $500 API budget is substantial but not infinite, and latency per call matters in the runtime path. More importantly: Opus is a tool, and like any tool, it has appropriate uses and inappropriate uses. Piping every decision through Opus degrades the project's quality in three ways: it slows down the hackathon (each call takes time), it obscures logic (you cannot easily debug "why did the LLM decide X?"), and it trains the team into a habit of outsourcing thinking to the model.

**What this looks like in practice.**
- Schema parsing: deterministic. SQL parsers exist in Node; we use one.
- Schema interpretation: agentic. *"This table of `sku_inventory_movements` is internal audit, probably ignore, please confirm"* requires domain reasoning.
- OpenAPI parsing: deterministic. `@apidevtools/swagger-parser` does this better than any LLM.
- OpenAPI endpoint classification: agentic. *"Which of these 120 endpoints should the agent be allowed to call?"* is a judgment call.
- Embedding: deterministic, local, no LLM.
- Enrichment: agentic. This is exactly where Opus's anchored semantic generation shines.
- Runtime retrieval: deterministic (pgvector query).
- Runtime response generation: agentic (Opus synthesizes).
- Tool-call decision at runtime: agentic.
- Tool-call execution: deterministic (widget does HTTP).

**What this explicitly rules out.**
- Wrapping Opus in LangChain or LlamaIndex "because that's how everyone does RAG." Those frameworks' abstractions add complexity without proportionate value at this scope.
- Using Opus to format JSON because writing the format is "boring."
- Asking Opus to do math, date arithmetic, or deterministic lookups when code can do it reliably and freely.
- Piping error logs through Opus for summarization during the hackathon (it's not worth the tokens).

**Related principles.** Enables [Principle 6: Composable Deterministic Primitives] (you can only separate agentic and deterministic if you have the discipline to distinguish them). Supports cost control within our $500 budget.

---

## Principle 10: Narrative-Aware Engineering

**Principle.** The three-minute demo video is not a post-hoc artifact; it is a design constraint. Features that cannot be shown in the video go to roadmap. Polish that does not survive in the video is deprioritized against polish that does. Every hour spent on the project is evaluated against its contribution to either (a) the video narrative or (b) the judging criteria.

**Rationale.** The hackathon rubric is explicit: 30% Impact, 25% Demo, 25% Opus creative use, 20% Depth. A project that ignores this rubric and optimizes for "coolness" or "completeness" will lose to a project that clearly serves the rubric. The video is the primary artifact the jury evaluates; everything else is evidence to back it up. This principle is not about cutting corners — it is about applying engineering judgment at the scope-setting level.

**What this looks like in practice.**
- The demo flow is storyboarded before the code is written. We know what the video will show in each 30-second segment.
- When a feature decision arises (e.g., "should we build `/atw.verify`?"), the question is *"does this appear in the video or does it materially improve what appears in the video?"*.
- We prefer one clean, rehearsable interaction with the widget over five half-working interactions.
- Setup UX polish that the Builder sees but the jury doesn't matters less than runtime UX polish that the jury does see.
- We allocate Sunday (deadline day) for video recording, not for coding.

**What this explicitly rules out.**
- Features built because they're interesting but that don't reach the demo.
- "Polish" that doesn't survive compression to 3 minutes (micro-animations, tooltips in setup UI, etc.).
- Treating the video as something to worry about on the last day.
- Over-scoping during the first 48 hours based on enthusiasm rather than evaluation.

**Related principles.** Grounded by [Principle 8: Reproducibility as a First-Class Concern] (the demo must be reproducible, or the narrative collapses during judging). Complements [Principle 4: Human-in-the-Loop by Default] (the human narrating the demo is part of the design).

---

## Meta-principle: These Principles Are Not Equal

When principles conflict, the order is:

1. **User Data Sovereignty** (Principle 1) — never traded for any other value.
2. **Anchored Generation** (Principle 5) — correctness over cleverness.
3. **Reproducibility** (Principle 8) — a broken demo invalidates everything else.
4. **Human-in-the-Loop** (Principle 4) — the Builder is always in charge.
5. **Narrative-Aware Engineering** (Principle 10) — scope decisions in a hackathon context.
6. **Markdown as Source of Truth** (Principle 2) — the storage model.
7. **Idempotent and Interruptible** (Principle 3) — the UX model.
8. **Composable Deterministic Primitives** (Principle 6) — the reliability model.
9. **Single-Ecosystem Simplicity** (Principle 7) — the complexity budget.
10. **Opus as a Tool, Not a Crutch** (Principle 9) — the LLM-usage discipline.

The top three are red lines. The bottom seven are strong defaults with named escape hatches. If a plan or task proposes violating a lower-priority principle to satisfy a higher-priority one, that is correct engineering. If it proposes violating a red line, it is wrong, full stop.

---

*End of Constitution. All subsequent plans, tasks, and implementations must cite these principles when making non-trivial decisions.*

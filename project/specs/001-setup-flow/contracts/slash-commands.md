# Contract: Slash Commands

**Feature**: [../spec.md](../spec.md) | **Plan**: [../plan.md](../plan.md)

This file is the external interface contract for the six user-visible
entry points delivered by Feature 001: the installer CLI and the five
Claude Code slash commands. For each, we fix inputs, outputs, exit
behavior, confirmation gates, and idempotency semantics.

The slash commands themselves are **markdown files** under
`.claude/commands/atw.*.md` that Claude Code loads and executes. The
"program" for each command is a natural-language script that invokes
auxiliary scripts (see [scripts.md](./scripts.md)) and makes LLM calls.

---

## 0. Installer CLI — `create-atw`

**Invocation.**

```text
npx create-atw@latest <target-dir> [--force] [--dry-run]
```

**Positional argument.**

| Name | Required | Description |
|---|---|---|
| `target-dir` | yes | Directory to scaffold. `.` is accepted for the current directory. Created if it does not exist. |

**Flags.**

| Flag | Default | Effect |
|---|---|---|
| `--force` | off | Permit scaffolding into a directory that already contains an `.atw/` tree, overwriting it (FR-005). |
| `--dry-run` | off | Print planned actions; write nothing. |

**Exit codes.**

| Code | Meaning |
|---|---|
| 0 | Success. Tree created. |
| 1 | Unexpected error (permission denied, disk full, etc.). |
| 2 | Conflict: target already has `.atw/` and `--force` was not supplied. Stderr lists conflicting paths (FR-005). |
| 3 | Invalid arguments. |

**Side effects on success.**
- Creates `.atw/config/`, `.atw/artifacts/`, `.atw/state/`,
  `.atw/templates/` in the target.
- Copies `commands/atw.*.md` into the target's `.claude/commands/`.
- Writes `docker-compose.yml` at the target root (services commented
  out).
- Writes `README-atw.md` at the target root.
- Creates `package.json` at the target root if none exists
  (Builder-facing deps pinned to known-good versions).
- Ensures `.gitignore` contains the `.atw/inputs/` rule (FR-048) —
  creates `.gitignore` if absent; appends only if the rule is not
  already present.

**Post-run message.** One line naming the exact next command (FR-006):
*"Open Claude Code in this directory and run `/atw.init`."*

**Idempotency.** Running twice without `--force` exits with code 2.
With `--force`, the installer re-scaffolds; Builder-authored artifacts
under `.atw/config/` and `.atw/artifacts/` are preserved (a `--force`
only overwrites structural scaffolding, never Builder content).

---

## 1. `/atw.init`

**Purpose.** Capture project metadata. No LLM call (FR-009).

**Inputs (elicited by the command).**

| Prompt | Accepts | Stored as |
|---|---|---|
| "Project name?" | free text | `name` |
| "Primary language(s) the agent will speak?" | comma-separated free text | `languages[]` |
| "Deployment type?" | `customer-facing widget` / `internal back-office copilot` / `custom` | `deploymentType` |

**Output.** `.atw/config/project.md` (see
[../data-model.md#11-project-metadata](../data-model.md)).

**Confirmation gate (per FR-041).** Before writing, the command shows
the three captured values and waits for Builder confirmation.

**Re-run semantics (FR-010).** If `project.md` exists, the command
loads current values, presents them as the starting point, and lets
the Builder change any of them. Unchanged values are preserved.

**Failure modes.** None material. If disk write fails, the command
prints the OS error and does not mutate other state.

---

## 2. `/atw.brief`

**Purpose.** Capture business context. 1 LLM call for synthesis
(FR-011, FR-012).

**Inputs.** Multi-turn conversation (FR-011). Questions cover business
scope, customers, allowed agent actions, forbidden agent actions,
tone, primary use cases, and business vocabulary. Optional:
anti-patterns.

**Output.** `.atw/config/brief.md` (see
[../data-model.md#12-business-brief](../data-model.md)).

**Confirmation gate.** The synthesized draft is shown in full. Builder
confirms or edits. On edit request, the command revises and re-shows
— it does NOT write between the first draft and the final
confirmation (FR-012, FR-050).

**Anchoring constraints (FR-013).** Synthesis prompt forbids
fabricated facts. Empty sections carry a placeholder note rather than
invented content.

**Contradiction handling (FR-014).** When the Builder's answers
contradict, the command surfaces the conflict and asks which applies
rather than silently picking one.

**Re-run semantics (FR-015).** If `brief.md` exists, the command
summarizes what is captured and asks what to change. It does not
replay the full interview.

**Failure modes.**
- LLM synthesis call fails (rate limit) → retry with exponential
  backoff up to 3 attempts (FR-044), then halt with actionable
  message.
- LLM auth fails → halt with message naming the expected env var
  (FR-043).

---

## 3. `/atw.schema`

**Purpose.** Interpret a Postgres schema and produce a decision map.
1–5 LLM calls depending on chunking (FR-024).

**Inputs.**
- Required: SQL schema dump in one of three forms (FR-016):
  - file path (local to the project),
  - pasted text in the chat,
  - a file staged under `.atw/inputs/` from a prior run.
- Optional: data sample file (`pg_dump --data-only --inserts`). Up to
  50 rows per table are sampled for classification evidence
  (FR-016); the rest are ignored.
- Implicit: `.atw/config/project.md` and `.atw/config/brief.md` are
  read as anchoring context.

**Banned inputs (FR-018).** Database connection strings, credentials,
or any form of live DB access. If the Builder pastes one, the command
refuses and explains why.

**Output.** `.atw/artifacts/schema-map.md` (see
[../data-model.md#13-schema-map](../data-model.md)).

**Pipeline.**

1. **Deterministic parse** via `parse-schema.ts`. On parse failure,
   surfaces line/column and halts (FR-017).
2. **Hash + change-detection** via `hash-inputs.ts`. If the hash is
   unchanged and `schema-map.md` exists, enter refinement mode
   (FR-049 Level 1). Otherwise compute structural diff against prior
   parse (FR-049 Level 2).
3. **LLM classification**, chunked by FK cluster (FR-024) if the
   schema exceeds 100 tables or 500 columns.
4. **Interactive review** — entity by entity (FR-023).
5. **Atomic write** via `write-artifact.ts`, after full confirmation.

**Confirmation gate.** Every write is preceded by an explicit
"confirm?" with a summary of what will be written (FR-023, FR-041).
Individual overrides during review update the draft; the write only
happens after the Builder confirms the complete picture.

**PII handling (FR-021, FR-022).**
- Column-level: names or sample values matching email, phone, names,
  addresses, payment data, government IDs, or free-text biographical
  fields are flagged PII and excluded from indexing by default.
- Table-level: customers, addresses, payments (and analogues) are
  excluded wholesale by default.
- The Builder can override PII decisions during review.

**Re-run semantics (FR-025, FR-040).** If `schema-map.md` exists, the
command loads it, computes a structural diff against the new schema,
and proposes focused updates (added / removed / modified tables) only.
Builder-made edits to the existing artifact are respected.

**Failure modes.** Parse failure, LLM auth / rate limit, Builder
disagrees with > 50% of classifications (command suggests revisiting
`/atw.brief` per §11 of the source doc's edge-case table).

---

## 4. `/atw.api`

**Purpose.** Classify every OpenAPI operation. 1–3 LLM calls.

**Inputs.**
- Required: OpenAPI specification in one of three forms (FR-026):
  - URL,
  - file path,
  - pasted JSON/YAML text.
- Implicit: `.atw/config/project.md`, `.atw/config/brief.md`, and
  `.atw/artifacts/schema-map.md` are read as anchoring context.

**Output.** `.atw/artifacts/action-manifest.md` (see
[../data-model.md#14-action-manifest](../data-model.md)).

**Pipeline.**

1. **Deterministic parse** via `parse-openapi.ts` (FR-027). Handles
   OpenAPI 3.0 / 3.1 / Swagger 2.0 — on Swagger 2.0 detection,
   suggests a conversion step and halts gracefully.
2. **Hash + change-detection** (FR-047, FR-049).
3. **LLM classification** — every operation into one of six buckets
   (public read, authenticated-user read, authenticated-user action,
   destructive action, admin-only (excluded), infrastructure
   (excluded)) per FR-028.
4. **Interactive review** — grouped by entity (FR-032).
5. **Atomic write** via `write-artifact.ts`, after confirmation.

**Hard defaults (FR-029, FR-031).**
- Operations under an administrative path prefix or behind admin-only
  security are excluded by default from customer-facing deployments.
- Destructive operations carry `requires_confirmation: true` —
  non-negotiable.

**Fallback handling (FR-033).** If the URL is unreachable, the
command offers a file-path fallback rather than retrying the URL
indefinitely.

**Re-run semantics (FR-049, FR-040).** Focused-update mode per
FR-049; Builder edits respected per FR-040.

---

## 5. `/atw.plan`

**Purpose.** Consolidate prior artifacts into an executable build
plan with a cost estimate. 1 LLM call.

**Inputs.** All four upstream artifacts (FR-034):
- `.atw/config/project.md`
- `.atw/config/brief.md`
- `.atw/artifacts/schema-map.md`
- `.atw/artifacts/action-manifest.md`

**Output.** `.atw/artifacts/build-plan.md` (see
[../data-model.md#15-build-plan](../data-model.md)).

**Pipeline.**

1. **Preflight** via `validate-artifacts.ts` — every upstream artifact
   exists and is internally consistent (FR-034, FR-038). On missing
   artifact: halt with explicit message naming the command to run
   first (FR-037).
2. **LLM synthesis** producing the plan.
3. **Cost estimate** (FR-035) — breakdown of enrichment calls,
   per-call cost, total cost, retry buffer. Displayed before
   confirmation.
4. **Interactive review** — plain-English summary + cost +
   confirmation gate (FR-036).
5. **Atomic write**.

**Adjustment flow.** The Builder may ask for adjustments (e.g., lower
concurrency, skip enrichment for a class of entities). The plan is
re-synthesized and re-presented. No write before explicit
confirmation (FR-036, FR-041).

---

## Cross-cutting contract

Applies to every command above.

**Confirmation gate.** Every command that writes an artifact presents
the proposal and waits for an affirmative response before writing
(FR-041, Principle IV).

**Atomicity.** Every write is atomic (temporary file + rename) with a
backup of the prior version (FR-046). See
[scripts.md](./scripts.md) — `write-artifact`.

**Idempotency.** Every command is re-runnable at any time (FR-039).
Unchanged inputs → Level 1 refinement mode (no LLM call). Changed
inputs → Level 2 structural diff; LLM only on the delta.

**Interruption semantics (FR-050).** Closing Claude Code mid-command
(before Builder confirmation) discards the in-progress proposal. The
Builder re-runs the command; the LLM is invoked again. Committed
upstream artifacts are untouched.

**Network scope (FR-042).** Each command makes network calls only to
the LLM API and — only in `/atw.api` — to a Builder-supplied OpenAPI
URL. Zero telemetry.

**Error surfacing (FR-043, FR-044).**
- LLM auth failure → halt, name the expected env var.
- LLM rate limit → exponential backoff, ≤ 3 attempts, then halt with
  actionable message.

**Re-run behavior checklist.**

| Command | Re-run with unchanged inputs | Re-run with changed inputs |
|---|---|---|
| `/atw.init` | Loads current values, lets Builder edit (FR-010). No LLM call. | N/A — inputs are Builder-typed, so re-entry is always a Builder edit. |
| `/atw.brief` | Summarizes what's captured, asks what to change (FR-015). No full-interview replay. | Same UX; LLM called only on the changed section. |
| `/atw.schema` | Refinement mode (FR-049 L1). No LLM call. | Structural diff (FR-049 L2); LLM only on added / modified tables. |
| `/atw.api` | Refinement mode. No LLM call. | Structural diff; LLM only on added / modified operations. |
| `/atw.plan` | Refinement mode unless upstream artifacts changed. | Re-synthesizes on delta. |

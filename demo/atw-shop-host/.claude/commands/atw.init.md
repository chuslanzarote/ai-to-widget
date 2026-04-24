---
description: "Capture project metadata. Zero LLM calls."
argument-hint: "(no arguments)"
---

# `/atw.init`

**Purpose.** Capture the three facts every downstream `/atw.*` command
needs: the project name, the primary language(s) the agent will speak,
and the deployment type. Writes `.atw/config/project.md` atomically
after explicit confirmation. **Zero LLM calls** (FR-009).

## Preconditions

- The current working directory contains an `.atw/` skeleton (scaffolded
  by `npx create-atw`).
- `.atw/config/` is writable.

## Steps

1. **Detect re-run.** If `.atw/config/project.md` already exists, load
   the current values via `atw-load-artifact --kind project --source
   .atw/config/project.md` and present them as defaults. (FR-010)

2. **Three questions.** Ask each in one turn:

   - *"Project name?"* — free text. The value is used for container
     names and file slugs, so suggest a kebab-case form if the Builder
     offers a multi-word name.

   - *"Primary language(s) the agent will speak?"* — comma-separated
     list of IETF language tags or common names (e.g. `en, es`).

   - *"Deployment type?"* — a choice among `customer-facing-widget`,
     `internal-copilot`, `custom`. Explain the differences in one
     sentence each if the Builder asks.

3. **Confirmation gate (FR-041).** Show the Builder the three captured
   values verbatim and ask *"Write `.atw/config/project.md` with these
   values?"*. Only proceed on an affirmative reply.

4. **Write the artifact.** Pipe the serialized markdown through
   `atw-write-artifact --target .atw/config/project.md`:

   ```bash
   cat <<'EOF' | atw-write-artifact --target .atw/config/project.md
   ---
   name: <captured name>
   languages:
     - <captured language>
   deploymentType: <captured deployment type>
   createdAt: <ISO 8601 timestamp, or preserved from existing artifact>
   ---
   # Project

   This project was initialized with `/atw.init`. Captured values:

   - **Name**: <captured name>
   - **Languages**: <comma-separated list>
   - **Deployment type**: <captured deployment type>
   - **Created at**: <ISO 8601 timestamp>

   The remaining `/atw.*` commands read these values for context.
   EOF
   ```

   The script performs an atomic write and creates a `.bak` sibling if
   the file already existed (FR-046).

5. **Announce next step.** End with exactly:

   *"Project metadata written. Next: run `/atw.brief`."*

## Failure handling

- **Disk write fails.** Surface the OS error verbatim. The `.bak`
  sibling (if a previous artifact existed) was restored automatically
  (FR-046). No other state mutated.

- **Builder closes mid-command before confirmation.** No file is
  written; re-running the command restarts the three-question flow
  (FR-050).

## Re-run semantics

On re-run with an unchanged project file the command still captures
the three values — but pre-fills them from the existing artifact and
skips the write if the Builder keeps every value identical (FR-010,
FR-049 L1).

## No LLM call

This command never invokes the LLM. Do not add a synthesis step; the
three answers go straight into the artifact (FR-009).

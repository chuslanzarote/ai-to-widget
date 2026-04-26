---
description: "Capture project metadata + integration origins. Zero LLM calls."
argument-hint: "(no arguments)"
---

# `/atw.init`

**Purpose.** Capture every fact downstream `/atw.*` commands need from the
integrator, so no later phase has to re-prompt or fall back to a
placeholder. Writes `.atw/config/project.md` atomically after explicit
confirmation. **Zero LLM calls** (FR-009).

For a `customer-facing-widget` deployment that means the four origins
plus the model snapshot the LLM phases will pin to (FR-006, FR-009, R6).

## Preconditions

- The current working directory contains an `.atw/` skeleton (scaffolded
  by `npx create-atw`).
- `.atw/config/` is writable.

## Origin glossary

The slash command captures four URLs. They are **not** interchangeable;
each downstream phase reads a specific one:

| Field                  | What it points at                                       | Example                                           |
|------------------------|---------------------------------------------------------|---------------------------------------------------|
| `atw_backend_origin`   | The ATW backend container the widget talks to.          | `http://localhost:3100`                           |
| `host_api_origin`      | The integrator's own API the widget calls actions on.   | `http://localhost:9000`                           |
| `host_page_origin`     | The page that loads `widget.js`, used for CORS allow.   | `http://localhost:8080`                           |
| `login_url` (optional) | Where unauthenticated shoppers are redirected to log in.| `https://shop.example.com/account/login`          |

`atw_backend_origin` and `host_api_origin` MUST differ (the schema
rejects equal values). The widget would otherwise route ATW traffic and
host traffic to the same listener and CORS would be ambiguous.

## Steps

1. **Detect re-run.** If `.atw/config/project.md` already exists, load
   it and present every previously-captured value as a default. (FR-010)

2. **Ask each question in turn.** For every URL question call the
   `validateOriginUrl` helper exported by `init-project.ts` between
   turns; if it returns `ok: false`, surface the message and re-prompt
   without advancing.

   - *"Project name?"* — free text. Used for container names + file
     slugs; suggest a kebab-case form for multi-word names.
   - *"Primary language(s) the agent will speak?"* — comma-separated
     IETF tags or common names (e.g. `en, es`).
   - *"Deployment type?"* — choice among `customer-facing-widget`,
     `internal-copilot`, `custom`. The next four questions only fire
     for `customer-facing-widget`.
   - *"ATW backend origin?"* — example: `http://localhost:3100`. The
     URL the widget posts chat requests to.
   - *"Host API origin?"* — example: `http://localhost:9000`. The URL
     the widget calls when an action is confirmed (the integrator's
     own API).
   - *"Host page origin?"* — example: `http://localhost:8080`. The
     page that loads `widget.js`. Used to seed `ALLOWED_ORIGINS` for
     the backend container's CORS allowlist.
   - *"Login URL? (optional)"* — example:
     `https://shop.example.com/account/login`. Press Enter to skip.
   - *"Model snapshot?"* — default `claude-opus-4-7`. Allowed values
     come from `SUPPORTED_MODEL_SNAPSHOTS` in `lib/pricing.ts`. Use
     `validateModelSnapshot` for the membership check.

   For each origin, after validation succeeds, optionally call
   `probeOrigin(value)` (FR-010 SHOULD). If unreachable, surface a
   single-line warning that does NOT block — the integrator may not
   have started the server yet.

3. **Confirmation gate (FR-041).** Show every captured value verbatim
   and ask *"Write `.atw/config/project.md` with these values?"*. Only
   proceed on an affirmative reply.

4. **Write the artifact.** Pipe the answers through `initProject({ answers,
   targetPath })`. The function:

   - validates the assembled Feature 009 frontmatter through
     `ProjectConfigSchema` and `checkProjectConfigInvariants` BEFORE
     writing (FR-011);
   - serializes legacy keys (`name`, `languages`, `deploymentType`,
     `createdAt`) AND Feature 009 keys (`project_name`, `deployment`,
     `atw_backend_origin`, `host_api_origin`, `host_page_origin`,
     `login_url`, `model_snapshot`) into the same frontmatter so both
     legacy readers and `loadProjectConfig` see identical data;
   - performs an atomic write and creates a `.bak` sibling if the file
     already existed (FR-046).

5. **Announce next step.** End with exactly:

   *"Project metadata written. Next: run `/atw.brief`."*

## Failure handling

- **Validation fails (FR-011).** `initProject` throws with the field
  paths that failed. Re-prompt the specific origin / snapshot question
  and retry; do not write a partial file.
- **Disk write fails.** Surface the OS error verbatim. The `.bak`
  sibling (if a previous artifact existed) was restored automatically
  (FR-046). No other state mutated.
- **Builder closes mid-command before confirmation.** No file is
  written; re-running the command restarts the question flow (FR-050).

## Re-run semantics

On re-run with an unchanged project file the command still captures
every value — but pre-fills from the existing artifact and skips the
write if every captured answer (legacy + Feature 009 keys) is byte
identical (FR-010, FR-049 L1).

## No LLM call

This command never invokes the LLM. Do not add a synthesis step; the
captured answers go straight into the artifact (FR-009).

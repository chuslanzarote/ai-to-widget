---
description: "Capture project metadata. Zero LLM calls."
argument-hint: "(no arguments)"
---

# `/atw.init`

**Purpose.** Capture the facts every downstream `/atw.*` command needs:
the project name, the primary language(s) the agent will speak, the
deployment type, and — when the deployment is a customer-facing widget
— the storefront origins, welcome message, auth-token localStorage key,
and login-redirect URL. Writes `.atw/config/project.md` atomically
after explicit confirmation. **Zero LLM calls** (FR-009).

## Preconditions

- The current working directory contains an `.atw/` skeleton (scaffolded
  by `npx create-atw`).
- `.atw/config/` is writable.

## Steps

1. **Detect re-run.** If `.atw/config/project.md` already exists, load
   the current values via `atw-load-artifact --kind project --source
   .atw/config/project.md` and present every field below as a
   pre-filled default. (FR-010 / FR-005a / contracts/project-md-v2.md §Re-run behaviour)

2. **Questions.** Ask each in one turn. On re-runs, pressing Enter
   keeps the previously-captured value; typing a new value replaces it.

   - *"Project name?"* — free text. The value is used for container
     names and file slugs, so suggest a kebab-case form if the Builder
     offers a multi-word name.

   - *"Primary language(s) the agent will speak?"* — comma-separated
     list of IETF language tags or common names (e.g. `en, es`).

   - *"Deployment type?"* — a choice among `customer-facing-widget`,
     `internal-copilot`, `custom`. Default: `customer-facing-widget`.
     Explain the differences in one sentence each if the Builder asks.

   The remaining questions are asked **only** when
   `deploymentType === "customer-facing-widget"`:

   - *"Storefront origins?"* — comma-separated list of absolute
     `http(s)://host[:port]` URLs the widget loads from. Default:
     `http://localhost:5173`. Each entry is validated with `new URL(...)`;
     re-prompt on any parse failure. Threaded into `ALLOWED_ORIGINS`
     at runtime and into `host-requirements.md` at build time.

   - *"Welcome message?"* — up to 200 chars of plain text shown as the
     first assistant turn on fresh page-loads. Default:
     `Hi! How can I help you today?` (FR-025).

   - *"Auth-token localStorage key?"* — the `window.localStorage` key
     where the storefront writes the shopper's bearer token on login.
     Default: `shop_auth_token`. Must match `/^[a-zA-Z0-9_-]+$/`;
     re-prompt on failure. Emitted as `data-auth-token-key` on the
     embed and as the `credentialSource.key` on every authed catalog
     entry.

   - *"Login redirect URL?"* — absolute URL the widget redirects to on
     a 401 from any authed tool call. Default: empty (widget shows an
     inline "please log in" hint without redirecting). Non-empty values
     must parse as absolute URLs; re-prompt on failure.

3. **Confirmation gate (FR-041).** Show the Builder every captured
   value verbatim; on a re-run, also show a short diff vs. the prior
   frontmatter. Ask *"Write `.atw/config/project.md` with these
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
   storefrontOrigins:
     - <captured origin[0]>
   welcomeMessage: <captured welcome message>
   authTokenKey: <captured auth token key>
   loginUrl: <captured login URL, or empty string>
   createdAt: "<preserved from existing artifact, or new ISO-8601>"
   updatedAt: "<fresh ISO-8601 on every write>"
   ---
   # Project

   This project was initialized with `/atw.init`. Captured values:

   - **Name**: <captured name>
   - **Languages**: <comma-separated list>
   - **Deployment type**: <captured deployment type>
   - **Storefront origins**: <comma-separated list>
   - **Welcome message**: <captured welcome message>
   - **Auth token key**: <captured auth token key>
   - **Login URL**: <captured login URL>
   - **Created at**: <ISO 8601 timestamp>
   - **Updated at**: <ISO 8601 timestamp>

   The remaining `/atw.*` commands read these values for context.
   EOF
   ```

   The script performs an atomic write and creates a `.bak` sibling if
   the file already existed (FR-046). Timestamps are emitted as quoted
   strings per FR-008 / contracts/project-md-v2.md.

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

On re-run the command pre-fills every question from the existing
artifact, shows an old-vs-new diff before writing, and — when every
answered value matches the stored one — still re-emits `updatedAt`
per contracts/project-md-v2.md §Re-run behaviour. If the Builder
keeps every captured value identical, the remaining frontmatter
(including `createdAt`) is preserved byte-for-byte (FR-010, FR-005a,
FR-049 L1).

## No LLM call

This command never invokes the LLM. Do not add a synthesis step; the
three answers go straight into the artifact (FR-009).

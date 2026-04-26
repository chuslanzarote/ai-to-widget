# Contract: `/atw.embed` slash command

**Feature**: Runtime (003)
**Plan**: [../plan.md](../plan.md)
**Data types**: [../data-model.md §4](../data-model.md)

The `/atw.embed` command is the Builder's on-ramp to integrating the
widget into their host app. It is fully deterministic: given the same
answers, it produces byte-identical `embed-guide.md` output.

---

## 1. Inputs

### 1.1 Environment preconditions

- Feature 002 artefacts must be present:
  - `.atw/artifacts/action-manifest.md` (for the tool allowlist).
  - `dist/widget.js` + `dist/widget.css` (the compiled bundle).
  - `.atw/state/build-manifest.json` with `result: "success"`.
- If any are missing, the command halts with an exit code 3 and a
  one-line diagnostic:

  ```
  atw-embed: missing <path>. Run /atw.build first.
  ```

### 1.2 Builder interview

The command presents the following questions, reading prior answers
from `.atw/state/embed-answers.md` (if present) as defaults:

| Key                   | Question                                                                 | Choices / format                                                  |
|-----------------------|--------------------------------------------------------------------------|-------------------------------------------------------------------|
| `framework`           | What framework is your host application using?                           | `next-app-router`, `next-pages-router`, `plain-html`, `custom`    |
| `backend_url`         | What URL will the AI to Widget backend be reachable at?                  | absolute URL                                                      |
| `auth_mode`           | How does your host authenticate end users?                               | `cookie`, `bearer`, `custom`                                      |
| `auth_token_key`      | (bearer only) Which localStorage key holds the token?                    | string                                                            |
| `api_base_url`        | Where does your host API live?                                           | absolute URL or relative (default `window.location.origin`)       |
| `login_url`           | (optional) Where should the widget link users to log in?                 | URL or blank                                                      |
| `locale`              | Default locale for users who don't have `data-locale` overridden?        | BCP-47 string                                                     |
| `theme_primary`       | (optional) Primary brand colour?                                         | CSS colour string or blank                                        |
| `theme_radius`        | (optional) Border radius?                                                | CSS length or blank                                               |
| `theme_font`          | (optional) Font family?                                                  | CSS font-family string or blank                                   |

---

## 2. Outputs

### 2.1 `.atw/state/embed-answers.md`

Persisted YAML-front-mattered markdown capturing the full answer set
(`data-model.md §4.1`). Written on every run.

### 2.2 `.atw/artifacts/embed-guide.md`

The human-readable guide. Same across reruns with identical answers
(`sha256(embed-guide.md)` is the contract).

Structure (sections, in order):

1. **Title and context** — project name (from `project.md`) +
   generated-at timestamp + a link back to
   `embed-answers.md`.
2. **Where to put the bundle** — framework-specific copy commands.
3. **Embedding the widget** — framework-specific `<script>` + `<link>`
   snippet.
4. **CORS on your host API** — the exact headers the host API must
   return to accept widget requests (Access-Control-Allow-Origin,
   Access-Control-Allow-Headers, Access-Control-Allow-Credentials when
   cookie-mode).
5. **CORS on the ATW backend** — the value to set for
   `ALLOWED_ORIGINS` in the backend environment so the widget's host
   is permitted.
6. **Theming** — copy-paste CSS showing how to override theme
   variables, with any Builder-provided values pre-filled.
7. **Troubleshooting** — checklist: widget not appearing, CORS
   errors, 401s from the host API, tool-allowlist console errors.
8. **Next steps** — pointer to
   `specs/003-runtime/quickstart.md` for reviewers and to
   `action-manifest.md` if the Builder wants to add new tools.

Framework-specific blocks follow the templates under
`packages/scripts/src/embed-templates/*.hbs`; one template per
supported framework.

---

## 3. Determinism contract

- Given identical `embed-answers.md`, the command produces
  byte-identical `embed-guide.md`. The generated-at timestamp is
  rendered from a fixed value when `--frozen-time=<iso>` is passed
  (used by tests), otherwise from the file's own last-modified time
  on rerun (so that re-running with the same answers does not touch
  the guide's bytes unless a template changed).
- The generator never calls Opus.
- The generator never performs network I/O.

---

## 4. Exit codes

| Code | Meaning                                              |
|------|------------------------------------------------------|
| 0    | Guide written successfully (new or unchanged).       |
| 1    | Interactive abort (user pressed Ctrl+C).             |
| 3    | Preconditions missing (no widget bundle / manifest). |
| 4    | Invalid answer (e.g., malformed URL). Logged clearly.|
| 17   | Template compile error (bug in the command itself).  |

---

## 5. CLI shim surface

`bin/atw-embed.js` mirrors the Feature 001/002 pattern:

- `--help` / `-h`: prints usage.
- `--version` / `-v`: prints version.
- `--answers-file <path>`: non-interactive mode. Reads all answers
  from the supplied markdown; errors if any required key is missing.
  Used by `tests/integration/embed-guide-roundtrip.test.ts` for each
  supported framework.
- `--output <path>`: override output location (default
  `.atw/artifacts/embed-guide.md`).
- `--frozen-time <iso>`: test-only; pins the generated-at timestamp.

---

## 6. Test invariants

- Running `atw-embed` twice with identical answers produces
  `embed-guide.md` files whose SHA-256 matches.
- Running with a flipped `framework` answer produces a diff whose
  non-header sections differ materially.
- Running without a widget bundle present exits 3 with the expected
  diagnostic (contract test).
- Each of the three supported frameworks produces a guide whose
  `<script>` snippet, when copied into a sample host template
  (`tests/fixtures/embed-hosts/<framework>/`), yields a working
  widget (integration test in `tests/integration/embed-guide-
  roundtrip.test.ts`, gated by `ATW_E2E_DOCKER=1`).

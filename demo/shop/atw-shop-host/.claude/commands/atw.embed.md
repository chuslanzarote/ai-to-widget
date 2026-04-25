---
description: Generate a framework-tailored integration guide so the Builder can embed the widget into their host application.
---

# /atw.embed

Produce `.atw/artifacts/embed-guide.md` — a step-by-step guide showing the
Builder exactly how to load the compiled widget (`dist/widget.js` +
`dist/widget.css`) into their host application, with the right
`<script>` / `<link>` tags, CORS configuration, theming snippet, and
troubleshooting notes for their chosen framework.

Contract: [contracts/embed-command.md](../specs/003-runtime/contracts/embed-command.md)

## Prerequisites

- `/atw.build` has completed successfully — `dist/widget.{js,css}` and
  `.atw/state/build-manifest.json` with `result: "success"` must exist.
- `.atw/artifacts/action-manifest.md` exists (the widget's tool
  allowlist is derived from it).

If any are missing, the command halts with an exit code of 3 and a
one-line diagnostic:

> `atw-embed: missing <path>. Run /atw.build first.`

## Interview

The command asks:

1. **Framework** — `next-app-router`, `next-pages-router`, `plain-html`,
   or `custom`.
2. **Backend URL** — where the ATW backend will run (e.g.,
   `http://localhost:3100` for local demo).
3. **Authentication mode** — `cookie`, `bearer`, or `custom`.
4. **(bearer only)** localStorage key that holds the host-app token.
5. **Host API base URL** — where host-side actions are executed.
6. **(optional)** Login URL for the widget's anonymous-fallback link.
7. **(optional)** Theme primary colour, border radius, font.

Answers are persisted to `.atw/state/embed-answers.md` so re-running
`/atw.embed` with unchanged answers produces byte-identical output
(determinism contract, FR-032).

## Run

From a project where the build pipeline has completed:

```bash
npx atw-embed
```

Or non-interactively with a pre-authored answers file:

```bash
npx atw-embed --answers-file .atw/state/embed-answers.md
```

Flags:

| Flag                      | Purpose                                                                 |
|---------------------------|-------------------------------------------------------------------------|
| `--answers-file <path>`   | Non-interactive mode. Reads every answer from the supplied markdown.    |
| `--output <path>`         | Override the output path (default `.atw/artifacts/embed-guide.md`).     |
| `--frozen-time <iso>`     | Test-only. Pin the generated-at timestamp so golden diffs stay stable.  |
| `--help` / `-h`           | Print usage.                                                            |
| `--version` / `-v`        | Print version.                                                          |

## Output

`.atw/artifacts/embed-guide.md` — the integration guide. Sections:

1. Where to put `widget.js` + `widget.css`
2. The `<script>` + `<link>` snippet
3. CORS configuration on the host API + on the ATW backend
4. Theming example (pre-filled with any colours / radius / font the Builder provided)
5. Troubleshooting checklist
6. Next steps / pointers

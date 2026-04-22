# AI to Widget

**AI to Widget** is an open-source toolkit for embedding conversational AI
agents into existing web apps. A Builder runs one installer and five Claude
Code slash commands, and walks away with a fully-configured agent: database
schema mapped, API actions classified, runtime build plan approved — all in
human-readable markdown under `.atw/`.

No database connection strings. No hidden state. No black-box config.
Everything the system decides about a client's agent lives in git.

---

## Quickstart (Principle VIII — Reproducibility)

You need: Node.js 20+, [Claude Code](https://claude.ai/code) authenticated,
and an `ANTHROPIC_API_KEY` exported in your shell.

```bash
# 1. Scaffold a new project
mkdir my-client-agent && cd my-client-agent
npx create-atw@latest .

# 2. Open Claude Code and run the five commands in order
claude
> /atw.init
> /atw.brief
> /atw.schema
> /atw.api
> /atw.plan
```

Under 30 minutes end-to-end on the reference Aurelia fixture (SC-002). The
full Feature 001 walkthrough lives at
[`specs/001-setup-flow/quickstart.md`](specs/001-setup-flow/quickstart.md).

---

## Cross-platform support

All three first-party platforms are tested on every push via GitHub Actions:

- macOS (latest)
- Linux (Ubuntu latest)
- Windows (latest)

Node 20 LTS is the minimum supported runtime. Developers on Windows should
use PowerShell 7 or WSL2; no POSIX-only tooling is required.

---

## What's in this repository

| Directory | Contents |
|---|---|
| `packages/installer/` | `create-atw` — the one-command scaffolder |
| `packages/scripts/` | `@atw/scripts` — the six deterministic CLIs (parse-schema, parse-openapi, write-artifact, load-artifact, validate-artifacts, hash-inputs) |
| `commands/` | The five Claude Code slash commands (`/atw.init`, `/atw.brief`, `/atw.schema`, `/atw.api`, `/atw.plan`) |
| `templates/` | Files the installer copies into a fresh project (docker-compose, README-atw, `.atw/` tree) |
| `examples/` | Reference `.atw/` artifacts from the Aurelia fixture |
| `tests/fixtures/aurelia/` | The reference e-commerce fixture (PostgreSQL schema + OpenAPI spec) |
| `specs/001-setup-flow/` | Feature 001 spec, plan, research, tasks, data model, contracts |

---

## Design principles

Every decision in this project defers to ten written principles. The
red-line principles (I, V, VIII) must hold unconditionally.

- [`constitution.md`](constitution.md) — the binding source for all
  non-trivial decisions
- [`PRD.md`](PRD.md) — the product requirements document
- [`specs/001-setup-flow/`](specs/001-setup-flow/) — the feature spec that
  covers everything in this repository today

Features 002 (build pipeline) and 003 (runtime widget) are separate
workstreams tracked under `002-build-pipeline.md` and `003-runtime.md`.

---

## License

MIT — see [`LICENSE`](LICENSE) if present, otherwise the license field in
the root `package.json`.

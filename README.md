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
The Feature 002 build-pipeline walkthrough — `/atw.build`, pgvector,
Opus-driven enrichment, backend image, manifest — lives at
[`specs/002-build-pipeline/quickstart.md`](specs/002-build-pipeline/quickstart.md)
and is the reproducibility contract for the build phase (Principle VIII).

### Run the demo (Feature 003)

```bash
cp .env.example .env          # set ANTHROPIC_API_KEY
make demo                     # docker compose up the Aurelia storefront + ATW runtime
# open http://localhost:8000, click the launcher, ask a catalog question
```

The only required env var is `ANTHROPIC_API_KEY`. As of Feature 007
(widget-driven tool loop) the backend no longer talks to the host shop
API, so `HOST_API_BASE_URL` and `HOST_API_KEY` are retired — every
shop-side call runs in the widget with the shopper's bearer JWT, and
`atw_backend` never reaches the shop (Principle I).

Full reviewer and fresh-install paths:
[`specs/003-runtime/quickstart.md`](specs/003-runtime/quickstart.md). The
runtime layer ships the embedded widget, the `/v1/chat` backend with
structural Principle-I enforcement (no shopper credentials ever reach
the backend), and the `/atw.embed` slash command for integrating the
widget into any host app.

### Run the reference shop (Feature 007)

```bash
cd demo/shop
docker compose up -d
# open http://localhost:8080, log in as alice@example.com / alicepass
```

`demo/shop` is a self-contained reference ecommerce (Fastify + Prisma +
Vite/React) that replaces the retired Medusa testbed. End-to-end
validation steps live in [`TESTING.md`](TESTING.md) and
[`specs/007-widget-tool-loop/quickstart.md`](specs/007-widget-tool-loop/quickstart.md).

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

# Quickstart: Setup Flow (Feature 001)

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

This is the Builder-facing path from *"I just heard about AI to
Widget"* to *"I have a full `.atw/` set of artifacts ready for the
build phase."* It doubles as the reproducibility check required by
Constitution Principle VIII — the jury must be able to follow it on
macOS, Linux, or WSL2 and land on a working setup in under 30
minutes.

Everything here exercises **Feature 001 only**. Features 002 (build
pipeline) and 003 (runtime widget) are separate quickstarts.

---

## 1. Prerequisites

On the Builder's machine:

- Node.js 20 LTS (check: `node --version` prints `v20.x.x` or newer)
- Claude Code installed and authenticated
- An Anthropic API key, exported as `ANTHROPIC_API_KEY` in the shell
  that launches Claude Code
- Git (only needed if cloning the repo for development-mode
  installation)
- Docker Desktop or Docker Engine — **not used by Feature 001**, but
  Feature 002 will need it; the installer sanity-checks its presence

No Postgres, no Python, no extra language runtimes.

---

## 2. Install into an empty project

```bash
mkdir my-client-agent
cd my-client-agent
npx create-atw@latest .
```

On success (under 60 seconds on a reasonable connection per SC-001):

```text
✓ Created .atw/ structure
✓ Copied slash commands to .claude/commands/
✓ Wrote docker-compose.yml template
✓ Wrote README-atw.md
✓ Ensured .atw/inputs/ is in .gitignore

Next: open Claude Code in this directory and run /atw.init.
```

Expected tree immediately after install:

```text
my-client-agent/
├── .atw/
│   ├── config/         (empty, will hold project.md, brief.md)
│   ├── artifacts/      (empty, will hold schema-map.md, action-manifest.md, build-plan.md)
│   ├── state/          (empty, will hold input-hashes.json)
│   └── templates/      (staged for Feature 002)
├── .claude/
│   └── commands/
│       ├── atw.init.md
│       ├── atw.brief.md
│       ├── atw.schema.md
│       ├── atw.api.md
│       └── atw.plan.md
├── .gitignore          (with .atw/inputs/ line appended)
├── docker-compose.yml  (ATW services commented out)
├── package.json
└── README-atw.md
```

---

## 3. Run the five commands

Open Claude Code in the project directory (`claude`). Run the five
commands in order.

### 3.1 `/atw.init`

Answers three questions: project name, primary agent language(s),
deployment type. Writes `.atw/config/project.md`. Takes < 1 minute.

### 3.2 `/atw.brief`

A 10–15 minute guided conversation. Writes `.atw/config/brief.md` after
confirmation. The draft is anchored to the Builder's own statements
(FR-013).

### 3.3 `/atw.schema`

Provide a `pg_dump --schema-only` of the client database (file path,
paste, or a file staged under `.atw/inputs/`). Optionally provide a
`--data-only --inserts` dump for up-to-50-row samples. Claude Code
presents entity-by-entity classifications; the Builder confirms or
overrides. PII tables (customers, addresses, payments) are excluded
automatically. Writes `.atw/artifacts/schema-map.md`.

**Never paste a database connection string** — the command refuses by
design (Principle I).

### 3.4 `/atw.api`

Provide the OpenAPI specification (URL, file, or paste). Claude Code
classifies every operation into one of six buckets; admin-only
operations are excluded by default. Writes
`.atw/artifacts/action-manifest.md`.

### 3.5 `/atw.plan`

Read-only from the Builder's perspective. Presents a plain-English
summary plus a cost estimate. The Builder confirms. Writes
`.atw/artifacts/build-plan.md`.

At this point, Feature 001 is complete. The next command the Builder
sees suggested is `/atw.build` — but that belongs to Feature 002.

---

## 4. Verifying the result on the reference demo

To validate a Feature 001 implementation against SC-003:

1. Clone `ai-to-widget` from source.
2. Run the installer in a fresh directory.
3. Use the committed Aurelia fixtures:
   - `tests/fixtures/aurelia/schema.sql` for `/atw.schema`
   - `tests/fixtures/aurelia/openapi.json` for `/atw.api`
4. Compare the produced artifacts to `examples/sample-*.md`:
   - Same `## Headings` in the same order.
   - Same major classification decisions for ≥ 90 % of entities and
     endpoints.
   - All customer PII tables (customer, customer_address, payment)
     excluded.
   - All `/admin/*` endpoints excluded from the action manifest.

Prose may differ (the LLM is stochastic); structural decisions must
be stable.

---

## 5. Re-running commands

Any command can be re-run at any time.

- **Unchanged inputs** → the command enters refinement mode, loads the
  existing artifact, and asks what to change. No LLM call
  (FR-049 L1).
- **Changed inputs** → the command computes a structural diff, asks
  the LLM only about added / removed / modified items (FR-049 L2).
- **Closing Claude Code mid-command** (before the Builder has
  confirmed the proposal) → the proposal is discarded; re-run the
  command to re-synthesize. Committed upstream artifacts are
  untouched (FR-050).

Any Builder edit made directly to a `.atw/` markdown file in a text
editor is respected by subsequent commands (FR-040).

---

## 6. Failure modes the Builder might hit

| Symptom | Resolution |
|---|---|
| Installer halts complaining about an existing `.atw/`. | Re-run with `--force` or choose a different target directory. |
| `/atw.schema` says the SQL is malformed at line X. | Fix the dump (e.g., remove interactive `\c` meta-commands); retry. |
| `/atw.api` says the spec is Swagger 2.0. | Convert with `swagger2openapi`; pass the converted file. |
| Claude Code halts on an auth error. | `export ANTHROPIC_API_KEY=<key>` in the shell Claude Code was launched from; retry. |
| Rate-limit halt after 3 retries. | Wait a minute; re-run the command. |
| `.atw/` deleted accidentally. | Re-run the installer with `--force`; the `.atw/inputs/` staging area is preserved where possible. |

---

## 7. What to read next

- [spec.md](./spec.md) — the functional requirements and success
  criteria this quickstart exercises.
- [plan.md](./plan.md) — the implementation plan for delivering it.
- `examples/` (at repo root) — the structural contract for every
  artifact.
- `constitution.md` (at repo root) — the ten principles this feature
  upholds. Principles I, III, IV, VI are the ones the Builder sees in
  action during this quickstart.

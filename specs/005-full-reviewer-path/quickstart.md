# Quickstart — Full Reviewer Path

**Feature**: 005-full-reviewer-path
**Audience**: two distinct users, each with their own shortcut

---

## Path A — Reviewer (60 seconds from clone to working widget)

You're looking at the repository for the first time and want to see the
widget respond to a question. You don't want to learn the slash-command
flow.

**Prerequisites.** Docker Desktop (or Docker Engine + Compose plugin)
running. That's it. No Node.js install needed for this path.

**Steps.**

```bash
git clone <repo-url> ai-to-widget
cd ai-to-widget
cp .env.example .env                        # fills in ANTHROPIC_API_KEY placeholder
# Edit .env to add your Anthropic API key. (See principle I — the key is yours.)

docker compose up -d --wait
```

First run takes ~90 seconds because compose builds the
`atw_backend:latest` image from the committed files under
`demo/atw-aurelia/backend/`. Subsequent runs start in seconds.

**Verify.** Open http://localhost:8000 — the Aurelia coffee storefront
appears with a widget launcher in the bottom-right corner. Click it and
ask "I want a good coffee." A grounded answer (anchored in the
committed schema-map + action-manifest) streams back.

**Teardown.**

```bash
docker compose down
```

### What goes wrong and what to check

| Symptom | Likely cause | Fix |
|---|---|---|
| `docker compose up` fails at atw_backend build step | stale `atw_backend:latest` from a prior buggy run | `docker rmi atw_backend:latest` then retry |
| Widget says "Can't reach the assistant" | `ANTHROPIC_API_KEY` blank in `.env` | set it; `docker compose restart atw_backend` |
| Storefront loads but no launcher | browser cache from prior broken bundle | hard reload (Ctrl/Cmd+Shift+R) |
| `docker compose up -d --wait` hangs on `atw_backend` healthy | backend crashed at startup (check `docker compose logs atw_backend`) | inspect logs, see "what goes wrong" section of `specs/003-runtime/quickstart.md` |

---

## Path B — Builder (end-to-end pipeline)

You want to run the full pipeline and prove each step is reproducible.

**Prerequisites.** Node.js ≥ 20, Claude Code, Docker Desktop running,
`ANTHROPIC_API_KEY` in env.

**Steps.**

```bash
git clone <repo-url> ai-to-widget
cd ai-to-widget
npm install

# Upstream commands (existing features 001–003):
claude-code /atw.init demo/atw-aurelia
cd demo/atw-aurelia
claude-code /atw.brief
claude-code /atw.schema
claude-code /atw.api
claude-code /atw.plan

# This feature's surface:
claude-code /atw.build
# -> RENDER: rewrites backend/src/** including lib/, routes/, _shared/
# -> BUNDLE: emits dist/widget.{js,css}
# -> IMAGE: builds and tags atw_backend:latest
# -> COMPOSE ACTIVATE: updates the local compose state
# -> SCAN: PII leak check
# -> MANIFEST: writes .atw/state/build-manifest.json with result: "success"

claude-code /atw.embed            # emits .atw/artifacts/embed-guide.md
cd ../..
docker compose up -d --wait
```

Open http://localhost:8000 and verify the widget responds.

### Verifying the determinism contract (SC-004, SC-005)

```bash
# Re-run /atw.build with no source changes:
cd demo/atw-aurelia
claude-code /atw.build

# Expected:
# - all RENDER/BUNDLE/IMAGE/COMPOSE/SCAN steps report action: "unchanged"
# - no files under backend/ have modified mtimes
# - docker images atw_backend:latest shows the same IMAGE ID as before
# - run time < 10 seconds
```

### Verifying loud failure (SC-003)

```bash
# Inject a template error:
echo '{{#if' >> packages/backend/src/index.ts.hbs
cd demo/atw-aurelia
claude-code /atw.build          # exits non-zero
cat .atw/state/build-manifest.json | jq '.result, .failure_entries'
# -> "failed"
# -> [ { "step": "render", "code": "TEMPLATE_COMPILE", "message": "..." } ]

# Revert the injection:
cd ../..
git checkout packages/backend/src/index.ts.hbs
cd demo/atw-aurelia
claude-code /atw.build          # success; image byte-identical to pre-injection
```

```bash
# Docker daemon failure:
# Stop Docker Desktop (or systemctl stop docker).
cd demo/atw-aurelia
claude-code /atw.build          # exits 3
grep DOCKER_UNREACHABLE .atw/state/build-manifest.json

# Restart Docker, re-run /atw.build — success; output matches last-good.
```

```bash
# Secret-shaped file refusal:
touch backend/.env
claude-code /atw.build          # exits 20
grep SECRET_IN_CONTEXT .atw/state/build-manifest.json
rm backend/.env
```

### Verifying the --skip-image flag (FR-013)

```bash
# Tests (and only tests) suppress the IMAGE step:
cd demo/atw-aurelia
claude-code /atw.build --skip-image
cat .atw/state/build-manifest.json | jq '.steps.image'
# -> { "action": "skipped", "reason": "suppressed by --skip-image flag" }
```

Asserted by `orchestrator.skip-image.contract.test.ts`.

---

## What the committed demo looks like (Entity 3)

After this feature ships, `git status` on a clean clone is empty. The
repository carries `demo/atw-aurelia/backend/` in its post-build state,
so Path A works without running any `/atw.*` command. A Builder who
runs `/atw.build` verifies the committed state is a fixed point: the
pipeline produces zero file changes.

If you edit `packages/backend/src/**/*.hbs` or
`packages/scripts/src/lib/runtime-*.ts`, the next `/atw.build` in
`demo/atw-aurelia` rewrites the matching files and records the change
in the manifest. Commit both the source edit and the committed demo
update in the same PR to keep Path A working.

---

## Acceptance tests (map spec → verification)

| Spec AC | Verified by |
|---|---|
| US1-AC1 (runnable backend after build) | Path B steps + `docker images atw_backend:latest` |
| US1-AC2 (manifest records image) | `jq '.backend_image'` non-null |
| US1-AC3 (compose up works) | Path B final `docker compose up` |
| US2-AC1/2/3 (loud failure modes) | "Verifying loud failure" snippets above |
| US2-AC4 (post-fix byte-identical) | determinism re-run after revert |
| US3-AC1 (no-op re-run) | "Verifying the determinism contract" above |
| US3-AC2 (cross-machine identical) | CI matrix, mac/linux/wsl2 (post-feature follow-up) |
| US4-AC1 (reviewer reaches widget) | Path A |
| US4-AC2 (committed demo is a fixed point) | Path B re-run on `demo/atw-aurelia` produces zero changes |

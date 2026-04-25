#!/usr/bin/env bash
# Feature 008 / T069 — quickstart structural validator (SC-001).
#
# A full end-to-end run of quickstart.md is interactive (Claude Code slash
# commands in Steps 1–7, browser interaction in Step 8). This validator
# exercises every NON-INTERACTIVE assertion the quickstart makes so CI can
# gate the claim "quickstart is reproducible from a clean checkout":
#
#   - Prerequisite binaries are present.
#   - Every slash command referenced in the quickstart exists.
#   - Every contract file referenced in the quickstart exists.
#   - The deterministic CLI halves (`@atw/scripts`) build and their
#     contract tests pass — these cover FR-004/006/007/008/009/012/013
#     without needing an LLM loop.
#   - The backend sovereignty probe passes (Principle I red line).
#   - The widget UX / embed / chat-endpoint unit tests pass — these
#     cover FR-014–020, FR-022–FR-027.
#
# The script prints a final checklist of the remaining interactive steps
# (1 per Builder-facing slash command) so SC-001 can be walked through
# manually after the automatable gates are green.
#
# Usage:  bash specs/008-atw-hardening/validate-quickstart.sh
# Exit:   0 if every automatable gate passes; non-zero on the first failure.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

pass() { printf '  \xE2\x9C\x93 %s\n' "$1"; }
fail() { printf '  \xE2\x9C\x97 %s\n' "$1" >&2; exit 1; }
step() { printf '\n[%s]\n' "$1"; }

step "Prerequisites (quickstart §Prerequisites)"
for bin in node docker; do
  command -v "$bin" >/dev/null 2>&1 || fail "missing binary: $bin"
  pass "$bin present"
done
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 20 ] || fail "node $NODE_MAJOR < 20"
pass "node >= 20"

step "Slash commands (quickstart Steps 1–7)"
for cmd in atw.init atw.api atw.schema atw.plan atw.classify atw.build atw.embed; do
  [ -f "commands/${cmd}.md" ] || fail "missing command: commands/${cmd}.md"
  pass "commands/${cmd}.md"
done

step "Contracts (Feature 008 bindings)"
for rel in \
  specs/008-atw-hardening/spec.md \
  specs/008-atw-hardening/plan.md \
  specs/008-atw-hardening/contracts/project-md-v2.md \
  specs/008-atw-hardening/contracts/host-requirements.md \
  specs/008-atw-hardening/contracts/builder-diagnostics.md \
  specs/008-atw-hardening/contracts/action-catalog-v3.md \
  specs/008-atw-hardening/contracts/chat-endpoint-v3.md \
  specs/008-atw-hardening/contracts/embed-snippet.md \
  specs/008-atw-hardening/quickstart.md ; do
  [ -f "$rel" ] || fail "missing: $rel"
  pass "$rel"
done

step "Reference shop scaffolding (quickstart §Step 0)"
[ -f "demo/shop/docker-compose.yml" ] || fail "missing demo/shop/docker-compose.yml"
pass "demo/shop/docker-compose.yml"
grep -q "@fastify/cors" demo/shop/backend/src/index.ts \
  || fail "@fastify/cors not registered in demo/shop/backend/src/index.ts (FR-021)"
pass "@fastify/cors registered (FR-021)"

step "@atw/scripts contract tests (FR-004/006/007/008/009/012/013)"
( cd packages/scripts && npx vitest run \
    test/sovereignty.contract.test.ts \
    test/schema-map-parser.zero-entity.unit.test.ts \
    test/hash-inputs.contract.test.ts \
    test/hash-inputs.cli.unit.test.ts \
    test/write-artifact.quoted-timestamps.unit.test.ts \
    test/classify-deployment-type.unit.test.ts \
    test/validate-artifacts.runtime-only.unit.test.ts \
    test/cross-validate.credential-backfill.unit.test.ts \
    test/cross-validate.singular-plural.unit.test.ts \
    test/embed.attributes.unit.test.ts \
    test/embed-text.contract.test.ts \
    test/atw-api.host-requirements.unit.test.ts \
    test/diagnostics.text.unit.test.ts \
    2>&1 ) || fail "scripts contract tests failed"
pass "scripts contract tests"

step "Widget UX unit tests (FR-014–FR-020, FR-022–FR-027)"
( cd packages/widget && npx vitest run \
    test/panel.unit.test.ts \
    test/panel.thinking-indicator.unit.test.tsx \
    test/panel.welcome-message.unit.test.tsx \
    test/chat-action-runner.no-executors.unit.test.ts \
    test/action-card.summary-template.unit.test.tsx \
    test/markdown.no-nav-pills.unit.test.ts \
    2>&1 ) || fail "widget UX tests failed"
pass "widget UX tests"

step "Interactive steps still to validate manually (quickstart Steps 1–8)"
cat <<'EOS'
  - Step 1  /atw.init      (re-run produces byte-identical frontmatter)
  - Step 2  /atw.api       (emits host-requirements.md)
  - Step 3  /atw.schema    (halts with D-SQLDUMP when dump missing)
  - Step 4  /atw.plan      (positional --inputs form)
  - Step 5  /atw.classify  (customer-facing-widget accepts bearer-JWT tools)
  - Step 6  /atw.build     (zero-entity / credSrc halts are loud)
  - Step 7  /atw.embed     (script snippet with data-* attributes in order)
  - Step 8  Storefront UX  (welcome, thinking, write-action confirm, CORS)

See specs/008-atw-hardening/quickstart.md for the exact assertions per step.
EOS

printf '\nAll automatable gates passed. Walk Steps 1–8 manually for SC-001.\n'

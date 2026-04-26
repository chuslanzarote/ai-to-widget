# Post-implementation notes — Feature 001 (Setup Flow)

**Completion date.** 2026-04-22
**Spec.** [spec.md](./spec.md) | **Tasks.** [tasks.md](./tasks.md)

This document records the spec-compliance sweep required by T106. For each
functional requirement FR-001 … FR-050 it names the covering implementation
surface (command, script, helper, or test) so reviewers can audit coverage
without reading every source file.

Gaps are recorded at the bottom. On first completion, the gap list is
intentionally empty — any deferred work is tracked as its own task rather
than carried as a footnote here.

---

## Coverage matrix

### Installer (FR-001 – FR-007)

| FR | Covered by |
|---|---|
| FR-001 | `packages/installer/src/scaffold.ts` + `templates/atw-tree/` + `tests/integration/installer-fresh.test.ts` |
| FR-002 | `packages/installer/src/scaffold.ts` (copies `commands/atw.*.md`) + `tests/integration/installer-fresh.test.ts` |
| FR-003 | `templates/docker-compose.yml.tmpl` + `tests/integration/installer-fresh.test.ts` |
| FR-004 | `templates/README-atw.md.tmpl`, `templates/package.json.tmpl` + `tests/integration/installer-fresh.test.ts` |
| FR-005 | `packages/installer/src/conflicts.ts` + `tests/integration/installer-conflict.test.ts` |
| FR-006 | `packages/installer/src/messages.ts` + `tests/integration/installer-fresh.test.ts` |
| FR-007 | `tests/integration/quickstart-smoke.test.ts` (< 60 s budget asserted) |

### `/atw.init` (FR-008 – FR-010)

| FR | Covered by |
|---|---|
| FR-008 | `commands/atw.init.md` + `packages/scripts/src/init-project.ts` + `tests/integration/atw-init.test.ts` |
| FR-009 | `packages/scripts/src/lib/write-artifact.ts` + `commands/atw.init.md` |
| FR-010 | `commands/atw.init.md` (re-run branch) + `packages/scripts/src/load-artifact.ts` |

### `/atw.brief` (FR-011 – FR-015)

| FR | Covered by |
|---|---|
| FR-011 | `commands/atw.brief.md` (eight-question interview) |
| FR-012 | `commands/atw.brief.md` (confirmation gate) |
| FR-013 | `packages/scripts/src/lib/brief-synthesis.ts` + `packages/scripts/test/brief-contradiction.unit.test.ts` |
| FR-014 | `packages/scripts/src/lib/contradiction-check.ts` + `packages/scripts/test/brief-contradiction.unit.test.ts` |
| FR-015 | `commands/atw.brief.md` (Level 1 refinement mode) + `tests/integration/idempotency-full-flow.test.ts` |

### `/atw.schema` (FR-016 – FR-025)

| FR | Covered by |
|---|---|
| FR-016 | `commands/atw.schema.md` + `packages/scripts/src/parse-schema.ts` |
| FR-017 | `packages/scripts/src/parse-schema.ts` (pgsql-ast-parser) + `packages/scripts/test/parse-schema.contract.test.ts` |
| FR-018 | `packages/scripts/src/lib/credential-rejection.ts` + `packages/scripts/test/credential-rejection.unit.test.ts` |
| FR-019 | `commands/atw.schema.md` (classification prompt) |
| FR-020 | `commands/atw.schema.md` (anchored prompt) + Principle V language |
| FR-021 | `packages/scripts/src/lib/pii-detection.ts` + `packages/scripts/test/pii-detection.unit.test.ts` |
| FR-022 | `packages/scripts/src/lib/pii-detection.ts` (table-level exclusion) |
| FR-023 | `commands/atw.schema.md` (classification loop) |
| FR-024 | `packages/scripts/src/lib/fk-clusters.ts` + `packages/scripts/test/fk-clusters.unit.test.ts` |
| FR-025 | `commands/atw.schema.md` (Level 2 delta) + `tests/integration/structural-diff-delta.test.ts` |

### `/atw.api` (FR-026 – FR-033)

| FR | Covered by |
|---|---|
| FR-026 | `commands/atw.api.md` + `packages/scripts/src/parse-openapi.ts` |
| FR-027 | `packages/scripts/src/parse-openapi.ts` (swagger-parser) + `packages/scripts/test/parse-openapi.contract.test.ts` |
| FR-028 | `commands/atw.api.md` (classification buckets) |
| FR-029 | `commands/atw.api.md` (admin exclusion) |
| FR-030 | `commands/atw.api.md` (manifest shape) |
| FR-031 | `commands/atw.api.md` (destructive ⇒ `requires_confirmation: true`) |
| FR-032 | `commands/atw.api.md` (entity grouping) |
| FR-033 | `tests/integration/atw-api-url-fallback.test.ts` + `tests/integration/atw-api-swagger2.test.ts` |

### `/atw.plan` (FR-034 – FR-038)

| FR | Covered by |
|---|---|
| FR-034 | `packages/scripts/src/validate-artifacts.ts` + `packages/scripts/test/validate-artifacts.contract.test.ts` |
| FR-035 | `packages/scripts/src/lib/cost-estimator.ts` + `packages/scripts/test/cost-estimator.unit.test.ts` |
| FR-036 | `commands/atw.plan.md` (confirmation gate) |
| FR-037 | `tests/integration/atw-plan-missing-upstream.test.ts` |
| FR-038 | `packages/scripts/src/validate-artifacts.ts` (four consistency kinds) + `tests/integration/atw-plan-inconsistent.test.ts` |

### Cross-cutting (FR-039 – FR-050)

| FR | Covered by |
|---|---|
| FR-039 | All five commands' re-run branches + `tests/integration/idempotency-full-flow.test.ts` |
| FR-040 | `tests/integration/builder-edit-respected.test.ts` |
| FR-041 | Every command's confirmation gate (Principle IV) |
| FR-042 | No network code paths outside `parse-openapi` URL fetch; enforced by review |
| FR-043 | `commands/atw.*.md` Failure handling sections + `packages/scripts/src/lib/llm-errors.ts` |
| FR-044 | Exponential backoff pattern documented in every command's Failure handling |
| FR-045 | `packages/scripts/bin/atw-*.js` — six CLIs shipped |
| FR-046 | `packages/scripts/src/lib/atomic.ts` (`write-file-atomic` + `.bak`) + `tests/integration/mid-command-atomicity.test.ts` |
| FR-047 | `packages/scripts/src/hash-inputs.ts` + `packages/scripts/test/hash-inputs.contract.test.ts` |
| FR-048 | `templates/atw-tree/.gitignore` + `tests/integration/inputs-lifecycle.test.ts` |
| FR-049 | L1: `hash-inputs` + L2: `packages/scripts/src/lib/structural-diff.ts` + `tests/integration/structural-diff-delta.test.ts` |
| FR-050 | `tests/integration/mid-command-atomicity.test.ts` + every command's "discarded on interruption" wording |

---

## Success-criteria sweep

- **SC-001** (< 60 s scaffold) — `tests/integration/quickstart-smoke.test.ts`.
- **SC-002** (< 30 min end-to-end) — covered by manual quickstart walkthrough
  plus the CI matrix running the scaffold portion; end-to-end LLM timings
  are reported in the Builder's terminal, not asserted in CI (depends on
  Anthropic latency).
- **SC-003** (Aurelia fixture parity) — `examples/aurelia-completed/` +
  quickstart-smoke validate-artifacts pass.
- **SC-006** (L1 no-op on unchanged inputs) — `tests/integration/idempotency-full-flow.test.ts`.
- **SC-007** (Builder edits respected) — `tests/integration/builder-edit-respected.test.ts`.
- **SC-008** (cost estimate within 20 %) — `packages/scripts/test/cost-estimator.unit.test.ts`.
- **SC-010** (PII tables never indexed) — `packages/scripts/test/pii-detection.unit.test.ts`.
- **SC-011** (admin endpoints excluded) — `examples/aurelia-completed/artifacts/action-manifest.md` + action-manifest fixtures.

---

## Constitution red-line check

- **Principle I (User Data Sovereignty).** `credential-rejection.ts` refuses
  DSNs. No command accepts a DB connection string. PII exclusion happens
  before any LLM call touches a table.
- **Principle V (Anchored Generation).** `brief-synthesis.verifyBriefAnchoring`
  + evidence-per-classification in `/atw.schema` and `/atw.api`.
- **Principle VIII (Reproducibility).** CI matrix on Linux / macOS / Windows,
  Node 20, full vitest pass. `examples/aurelia-completed/` ships so
  reviewers see the output without running the flow.

---

## Deferred items / known gaps

*(none on first completion)*

Any follow-up work discovered after this sweep should be tracked as a new
task in `tasks.md` or a new spec, not as an append to this section.

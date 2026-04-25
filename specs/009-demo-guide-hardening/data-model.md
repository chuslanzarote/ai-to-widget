# Phase 1 — Data Model: Demo-Guide Hardening

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Research**: [research.md](research.md)

This document captures the entities introduced or materially reshaped
by Feature 009. Entities unchanged from Features 001/002/003/008 are
not repeated here; consult those features' artifacts.

---

## E1 — Action Manifest (LLM-emitted, schema-validated)

**Locus**: `.atw/artifacts/action-manifest.md` (per Builder project).
**Producer**: `/atw.api` → `classify-actions.ts` → LLM tool-use call
→ `write-manifest.ts`.
**Consumer**: `/atw.build` (`render-backend`, `compile-widget`),
runtime backend (chat route templates), runtime widget (ActionCard).

**Storage shape (Constitution II)**: Markdown file with YAML
frontmatter for machine-readable fields and prose body for
human-readable rationale. **No regex-extractable bold-bracketed
inline fields** (FR-007).

### YAML frontmatter (machine-readable)

```yaml
---
schema_version: "1.0"               # bumps on breaking changes
generated_at: "2026-04-25T14:32:01Z"
model_snapshot: "claude-opus-4-7"   # pinned per Constitution VIII
input_hashes:
  openapi_sha256: "<hex>"
  project_md_sha256: "<hex>"
operation_count_total: 247           # in source OpenAPI
operation_count_in_scope: 38         # LLM's selection
source_openapi_path: ".atw/artifacts/openapi.json"
operations:
  - tool_name: "add_cart_item"
    description: "Add a product to the shopper's cart."
    summary_template: "Add {{ quantity }}× {{ product_name }} to your cart"
    requires_confirmation: true       # write/destructive operations
    http:
      method: "POST"
      path_template: "/cart/items"
    input_schema:                      # full resolved JSON schema
      type: "object"
      required: ["product_id", "quantity"]
      properties:
        product_id:
          type: "string"
        quantity:
          type: "integer"
          minimum: 1
    citation:                          # FR-002 anchored to source
      operation_id: "addCartItem"
      schema_ref: "#/components/schemas/CartItem"
    rationale_excerpt: "Shopper-owned write per project.md scope §3."
  # ...one entry per in-scope operation
---
```

### Prose body (human-readable)

Per-operation prose blocks. The LLM may write extended rationale,
edge-case notes, and links to the source operation. **No regex
extraction touches this region.** The Builder edits this freely
without breaking the build.

### Field semantics

| Field | Required | Notes |
|-------|----------|-------|
| `schema_version` | yes | Breaks the build if an older `write-manifest.ts` reads a newer manifest version. |
| `model_snapshot` | yes | Per Constitution VIII; used to validate idempotency on re-runs. |
| `input_hashes.openapi_sha256` | yes | Computed over the bundled OpenAPI document. Used for cache-skip per FR-008b. |
| `input_hashes.project_md_sha256` | yes | Same purpose; if `project.md` changes the manifest is regenerated. |
| `operation_count_total` | yes | Surfaced to the integrator pre-call (FR-006a countdown). |
| `operations[].tool_name` | yes | Globally unique within this manifest; used by widget + backend. |
| `operations[].description` | yes | Human-readable, one sentence. |
| `operations[].summary_template` | yes | Mustache-style placeholders; used by ActionCard (FR-022). |
| `operations[].requires_confirmation` | yes | True for non-idempotent operations; the widget gates these behind ActionCard confirm. |
| `operations[].http.method` | yes | Must be a recognized verb (`GET`/`POST`/`PUT`/`PATCH`/`DELETE`). The PUT gap from project memory is closed at the template layer. |
| `operations[].http.path_template` | yes | OpenAPI path template, e.g. `/cart/items/{id}`. |
| `operations[].input_schema` | yes | JSON Schema. Empty `properties: {}` is a validation failure for write operations (the bug Q1 wave fixes). |
| `operations[].citation.operation_id` | yes | Source operation ID — Constitution V anchor. |
| `operations[].citation.schema_ref` | yes when input_schema non-empty | Source schema `$ref` path; absent for path/query-only operations. |
| `operations[].rationale_excerpt` | optional | One-sentence "why included" snippet. |

### Validation rules (enforced at write time)

- All required fields present.
- `tool_name` matches `/^[a-z][a-z0-9_]*$/` and is unique.
- `http.method` ∈ allowed verbs.
- `input_schema` is structurally valid JSON Schema (passed through
  zod).
- `summary_template` placeholders all resolve to keys in
  `input_schema.properties`. Schema-validation failure on this rule
  surfaces with the offending placeholder name (FR-008's "exact
  field" guarantee).
- `citation.operation_id` exists in the source OpenAPI document
  (cross-checked at validation time, not at LLM time).
- For write operations (`POST`/`PUT`/`PATCH`/`DELETE`),
  `input_schema.properties` MUST be non-empty when the source
  operation declares a request body. (Catches the empty-properties
  bug at the source.)

---

## E2 — Project Brief (`project.md`) — extended

**Locus**: `.atw/config/project.md` (per Builder project).
**Producer**: `/atw.init`.
**Consumer**: `/atw.api`, `/atw.build`, `/atw.embed`, runtime config.

**Change vs. Feature 008**: Five new YAML frontmatter fields
(FR-009, FR-010, FR-011, FR-006).

### YAML frontmatter (extended)

```yaml
---
project_name: "Decaf Cart"
deployment: "customer-facing-widget"   # existing
brief_summary: "..."

# NEW in Feature 009 — separated origins (FR-009)
atw_backend_origin: "http://localhost:3100"     # the ATW backend
host_api_origin: "http://localhost:3200"        # the Builder's API
host_page_origin: "http://localhost:8080"       # where the widget mounts
login_url: "https://example.com/login"          # optional, FR-009(d)

# NEW in Feature 009 — model selection (FR-006)
model_snapshot: "claude-opus-4-7"               # default; configurable
---
```

### Validation rules

- `atw_backend_origin`, `host_api_origin`, `host_page_origin` MUST
  parse as absolute URLs (`new URL(value)` succeeds).
- A typo like `http//localhost:3200` MUST fail validation at
  `/atw.init` time (FR-010), not at first widget render.
- `host_api_origin` MUST NOT equal `atw_backend_origin` unless the
  Builder explicitly confirms (the same-origin edge case in spec).
- `model_snapshot` MUST appear in the supported set in
  `lib/pricing.ts`. Unknown snapshots fail with a clear "supported
  snapshots: …" message.
- All required fields present before `/atw.init` writes the file
  (FR-011).

---

## E3 — Build Provenance Log

**Locus**: `.atw/artifacts/build-provenance.json` (appended per
`/atw.build` invocation; never overwritten — append-only history).
**Producer**: `orchestrator.ts` (each phase appends an entry).
**Consumer**: integrator audit, CI assertions, Constitution VIII
verification.

### Entry shape (one per phase per build run)

```json
{
  "build_id": "<ulid>",
  "phase": "CLASSIFY",
  "started_at": "2026-04-25T14:30:00Z",
  "finished_at": "2026-04-25T14:32:01Z",
  "status": "success",
  "input_hashes": {
    "openapi_sha256": "<hex>",
    "project_md_sha256": "<hex>"
  },
  "model_snapshot": "claude-opus-4-7",
  "llm_call": {
    "attempts": 1,
    "retry_delays_ms": [],
    "input_tokens": 14823,
    "output_tokens": 4012,
    "estimated_cost_usd": 0.52,
    "actual_cost_usd": 0.52,
    "cost_variance_pct": 0
  },
  "outputs": {
    "manifest_path": ".atw/artifacts/action-manifest.md",
    "operation_count_in_scope": 38
  },
  "warnings": [],
  "skipped_reason": null
}
```

### Status enum

- `success` — phase ran cleanly.
- `success_cached` — phase skipped due to input-hash match (FR-008b).
- `warning` — phase ran but produced unusual output (e.g., zero rows
  in IMPORT). Surfaces as `⚠` in the build summary (FR-028).
- `skipped` — phase declined to run (e.g., COMPOSE markers missing
  and the integrator answered "no" to the `[y/N]` prompt). Surfaces
  as `⚠` in the build summary.
- `failed` — phase errored. Build aborts; downstream phases marked
  `not_run` and surfaced in summary.
- `not_run` — a downstream phase that didn't execute because an
  upstream phase failed.

### Reproducibility guarantee (Constitution VIII)

Two builds against the same `(input_hashes, model_snapshot)` MUST
produce byte-identical manifest outputs (cached path) OR identical
LLM outputs (uncached path, given Anthropic's deterministic-mode
guarantees with `temperature: 0`). The provenance log records both
hashes and the cached/uncached status so any drift is detectable.

---

## E4 — Embed Guide

**Locus**: `<host-project>/atw/embed-guide.md` after `/atw.embed`.
**Producer**: `embed.ts` rendering one of the templates in
`packages/scripts/src/embed-templates/`.
**Consumer**: human integrator following the steps; nothing parses
this file programmatically.

**Change vs. Feature 008**: Single document (no prepended summary
on top of legacy body — FR-012). All values inlined from
`project.md` (FR-013). New required sections:

| Section | Required content | FR |
|---------|------------------|----|
| Title + summary | One sentence + bulleted "what you'll do". | FR-012 |
| Embed snippet | `<script>` + `<link>` tags, fully inlined values. **No** `data-allowed-tools`. **MUST** include `data-api-base-url`. | FR-013, FR-014, FR-015 |
| CORS configuration | Host page origin, exact headers list, framework-specific snippet OR checklist. | FR-016 |
| Run the backend | Container startup, env var list, pgvector wiring, link to emitted `.env.example`. | FR-017 |
| Static assets | Where to copy assets for the detected stack; rebuild warning. | FR-018 |
| Cross-platform commands | Bash + PowerShell pairs for any shell-specific snippet. | FR-019 |

**Validation post-emit**: a CI grep asserts no occurrences of
`<your storefront origin>`, `[NEEDS CLARIFICATION]`, `localhost`
without "REPLACE THIS" annotations, or `specs/…` paths leaking into
the integrator-visible doc (SC-006).

---

## E5 — `.env.example` (NEW emitted artifact, FR-017)

**Locus**: `<host-project>/atw/.env.example`.
**Producer**: `embed.ts`.
**Consumer**: human integrator copying to `.env`.

```env
ANTHROPIC_API_KEY=
DATABASE_URL=postgresql://atw:atw@localhost:5432/atw
ALLOWED_ORIGINS=http://localhost:8080
# ALLOWED_ORIGINS comma-separates multiple origins. Add production URLs here
# before deploying. The widget's host page origin MUST appear in this list.
```

Pre-filled values come from `project.md` where known (`ALLOWED_ORIGINS`
from `host_page_origin`, `DATABASE_URL` from the demo defaults).
`ANTHROPIC_API_KEY` is empty — the integrator's secret to fill.

---

## E6 — `tools/dev/` (NEW directory, FR-033)

**Layout** after the relocation in R10:

```text
tools/
└── dev/
    ├── docker-compose.yml         # was repo-root docker-compose.yml
    └── README.md                  # NEW — "ATW maintainers only"
```

**Content of `tools/dev/README.md`** (≤30 lines):
- "This directory contains tooling used by ATW maintainers during
  development. Integrators following the embed guide do NOT need to
  touch anything here."
- "The `docker-compose.yml` here spins up Postgres + a dev backend
  for local ATW development. It is not the host compose."
- A short pointer to the embed guide for integrators.

---

## State transitions

The pipeline state machine across `/atw.*` commands is unchanged
from Feature 002; this feature only changes what each phase emits
and how failures surface.

```
/atw.init    → project.md (E2)                  ─┐
/atw.brief   → brief.md                          ─┤
/atw.schema  → schema-map.md                     ─┼→ /atw.build phases:
/atw.api     → action-manifest.md (E1)           ─┤   IMPORT, ENRICH, EMBED,
/atw.plan    → build-plan.md                     ─┘   RENDER, COMPOSE
                                                       ↓
                                          build-provenance.json (E3)
/atw.embed   → embed-guide.md (E4) + .env.example (E5)
```

Each phase reads upstream artifacts, validates them, and writes to
its own outputs. Re-running a phase against unchanged inputs hits
the `success_cached` path (E3) per FR-008b.

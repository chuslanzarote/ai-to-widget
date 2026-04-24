# Specification Quality Checklist: Widget-driven tool loop over a self-contained reference ecommerce

**Purpose**: Validate specification completeness and quality before proceeding to planning
**Created**: 2026-04-23
**Revised**: 2026-04-23 (v2 — rescoped to include reference ecommerce testbed and retire Medusa)
**Feature**: [spec.md](../spec.md)

## Content Quality

- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

## Requirement Completeness

- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous
- [x] Success criteria are measurable
- [x] Success criteria are technology-agnostic (no implementation details)
- [x] All acceptance scenarios are defined
- [x] Edge cases are identified
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

## Feature Readiness

- [x] All functional requirements have clear acceptance criteria
- [x] User scenarios cover primary flows
- [x] Feature meets measurable outcomes defined in Success Criteria
- [x] No implementation details leak into specification

## Validation Notes (v2)

The spec was rescoped after the v1 attempt to drive ATW against Medusa v2 revealed that a third-party testbed is the wrong substrate: the manifest builder cannot reason about capabilities the OpenAPI does not declare (cart identifiers that live in storefront-managed client state, non-standard authentication headers). Rather than build scaffolding around a hostile testbed, the feature now ships the testbed itself — a minimal, purpose-built reference ecommerce under `demo/shop` — and then performs the tool-loop collapse on top of an API surface the Builder Owner fully controls.

Judgement calls recorded for auditors:

- **Reference testbed is part of the feature, not a separate feature.** The testbed and the tool-loop collapse are inseparable: the tool-loop redesign is only credible on a testbed that declares every capability it uses. Separating them would produce two features neither of which is demonstrable alone.

- **Implementation details in spec**: The spec uses two categories of technical references that deserve explicit defence:
  1. **Red-line primitives** — the spec mentions `eval`, `new Function`, dynamic `import`, and bearer-token/`Authorization` header semantics. These are named because FR-021 (no runtime code evaluation) and FR-009 (no shopper credentials reach the ATW backend) are verifiable invariants and their precision depends on naming the primitives they rule in/out. A technology-agnostic paraphrase would lose the invariants' teeth.
  2. **Contract anchors inherited from prior features** — references to Feature 003, 006, and the constitution's principles (I, V, VIII) are scope anchors, not implementation details. They tell the planner which prior artefacts this feature inherits vs. amends.

- **"Bearer JWT" and "browser-standard same-origin storage"** are named in FR-002, FR-006, and Assumptions. They are named because the widget has to read the token from somewhere the SPA wrote it, and FR-006 is the contract between the two. A technology-agnostic paraphrase would push the decision to the planner without giving them the constraint that makes FR-009 verifiable.

- **Progress-UX string literals** (`"Obteniendo datos…"`, `"Datos obtenidos, interpretando…"`): pinned verbatim in FR-010 because the acceptance tests reference them literally. Localisation is carved out to a follow-up.

- **Timeout value (8 s)** is pinned in SC-010 because it is a shopper-visible contract (maximum hang time before degradation). The per-turn tool-call cap is intentionally left as "configurable" in FR-016 because the reasonable value depends on the turn shape — this is a planning decision.

- **Retirement of the Medusa demo** is recorded as an explicit functional requirement (FR-007) rather than left as a cleanup task, because artefacts and seed dumps that linger in the repository would confuse the planner about which testbed is authoritative.

- **Cart-indicator sync mechanism** (FR-013) deliberately leaves the signalling mechanism to planners. Bounding it to "must not require a shared bundled runtime" rules out the heaviest solution (monorepo-shared state store) without prescribing the specific lightweight mechanism.

- **Clarification markers**: Zero `[NEEDS CLARIFICATION]` markers. The user's directive in this session fully specified the pivot (build own testbed, delete Medusa, bearer JWT in standard storage, four screens plus login, cart indicator visible everywhere, simple schema, seed from handwritten data). Remaining uncertain axes (exact schema, exact routes, exact SPA state-management choice, exact per-turn cap) are planning-phase decisions.

## Changes from v1 → v2

- **Added US1** — the reference ecommerce testbed is now an explicit user story with acceptance criteria, rather than an implicit dependency.
- **Reframed US2–US4** — now target `demo/shop` instead of `demo/atw-shop-host`; account-scoped reads use the shopper's bearer token rather than a session cookie.
- **Merged prior US4+US5** (credential removal + auditor verification) into a single US5. They had the same rationale; splitting them doubled the spec surface without adding clarity.
- **Added FRs 001–007** covering the reference ecommerce (compose-up, OpenAPI publication, capability set, SPA screens, seed, bearer-token storage contract, Medusa retirement).
- **Added FR-013** (storefront cart-indicator sync after widget action) — this is new behaviour the Medusa testbed did not exercise.
- **Removed** Medusa-specific language from Assumptions and acceptance scenarios.
- **Added SC-001** (10-minute cold-start to full journey on the testbed) and **SC-006** (cart-indicator refresh within 2 s after confirmed action).
- **Manifest-builder extension** (bearer-token header source) captured as an Assumption: scoped to the reference ecommerce, general-purpose credential-source declaration for arbitrary third-party APIs remains out of scope.

## Notes

- Items marked incomplete would require spec updates before `/speckit.clarify` or `/speckit.plan`. None remain.
- This feature collapses the safe-read/action split inherited from Feature 003 and retires the Medusa testbed. The spec preserves Principle I (User Data Sovereignty), Principle V (Anchored Generation), and Principle VIII (Reproducibility) explicitly as functional requirements (FR-008/009, FR-014, FR-022) so planners cannot accidentally regress them while executing the pivot.

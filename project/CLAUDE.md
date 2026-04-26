<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:

- Active plan: [`specs/009-demo-guide-hardening/plan.md`](specs/009-demo-guide-hardening/plan.md)
- Spec: [`specs/009-demo-guide-hardening/spec.md`](specs/009-demo-guide-hardening/spec.md)
- Research: [`specs/009-demo-guide-hardening/research.md`](specs/009-demo-guide-hardening/research.md)
- Data model: [`specs/009-demo-guide-hardening/data-model.md`](specs/009-demo-guide-hardening/data-model.md)
- Contracts: [`specs/009-demo-guide-hardening/contracts/`](specs/009-demo-guide-hardening/contracts/)
- Quickstart: [`specs/009-demo-guide-hardening/quickstart.md`](specs/009-demo-guide-hardening/quickstart.md)

Features 001 (setup flow), 002 (build pipeline), 003 (runtime), 004 (widget
bundle), 005 (reviewer path), 006 (openapi action catalog), 007 (widget
tool loop), and 008 (atw hardening) artifacts remain authoritative for the
upstream halves of the system and can be read at
[`specs/001-setup-flow/`](specs/001-setup-flow/),
[`specs/002-build-pipeline/`](specs/002-build-pipeline/),
[`specs/003-runtime/`](specs/003-runtime/),
[`specs/004-ship-widget-bundle/`](specs/004-ship-widget-bundle/),
[`specs/005-full-reviewer-path/`](specs/005-full-reviewer-path/),
[`specs/006-openapi-action-catalog/`](specs/006-openapi-action-catalog/),
[`specs/007-widget-tool-loop/`](specs/007-widget-tool-loop/), and
[`specs/008-atw-hardening/`](specs/008-atw-hardening/).

Feature 008 closes every residual gap between the `/atw.*` setup flow, the
generated runtime, and the widget that the Feature 007 demo surfaced on
2026-04-24 against `demo/atw-shop-host`. Scope is bounded to the 22 items in
[`FEATURE-008-atw-hardening.md`](FEATURE-008-atw-hardening.md) — no new ATW
skills, no `ConversationTurn.content` shape migration, no re-introduction of
navigation pills. Three cross-cutting threads knit the fixes together: the
`deploymentType: customer-facing-widget` project-level flag, the new
`host-requirements.md` artefact, and the chat-endpoint `tool_result` payload
extension (`tool_name` + `tool_input`) that lets the backend reconstruct
Opus's message sequence statelessly.

Feature 009 extends 008 with the **rector principle: LLM-Native API
Understanding**. ATW MUST NOT re-derive OpenAPI semantics inside its own
scripts (no regex parsers for shopper-ownership, no token allowlists, no
$ref-following code, no markdown parameter-extraction passes). The LLM
reads the OpenAPI document directly with the Builder's stated intent
(`project.md`) as guidance and emits per-operation manifests with the
structural shape ATW's runtime needs. 009 also hardens the demo guide so a
fresh integrator following `quickstart.md` against `demo/shop` survives end
to end without agent intervention.

The constitution at [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
is the binding source for non-trivial decisions. Red-line principles
(I. User Data Sovereignty, V. Anchored Generation, VIII. Reproducibility)
must pass unconditionally on every plan and task.
<!-- SPECKIT END -->

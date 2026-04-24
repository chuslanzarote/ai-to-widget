<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:

- Active plan: [`specs/008-atw-hardening/plan.md`](specs/008-atw-hardening/plan.md)
- Spec: [`specs/008-atw-hardening/spec.md`](specs/008-atw-hardening/spec.md)
- Research: [`specs/008-atw-hardening/research.md`](specs/008-atw-hardening/research.md)
- Data model: [`specs/008-atw-hardening/data-model.md`](specs/008-atw-hardening/data-model.md)
- Contracts: [`specs/008-atw-hardening/contracts/`](specs/008-atw-hardening/contracts/)
- Quickstart: [`specs/008-atw-hardening/quickstart.md`](specs/008-atw-hardening/quickstart.md)

Features 001 (setup flow), 002 (build pipeline), 003 (runtime), 004 (widget
bundle), 005 (reviewer path), 006 (openapi action catalog), and 007 (widget
tool loop) artifacts remain authoritative for the upstream halves of the system
and can be read at
[`specs/001-setup-flow/`](specs/001-setup-flow/),
[`specs/002-build-pipeline/`](specs/002-build-pipeline/),
[`specs/003-runtime/`](specs/003-runtime/),
[`specs/004-ship-widget-bundle/`](specs/004-ship-widget-bundle/),
[`specs/005-full-reviewer-path/`](specs/005-full-reviewer-path/),
[`specs/006-openapi-action-catalog/`](specs/006-openapi-action-catalog/), and
[`specs/007-widget-tool-loop/`](specs/007-widget-tool-loop/).

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

The constitution at [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
is the binding source for non-trivial decisions. Red-line principles
(I. User Data Sovereignty, V. Anchored Generation, VIII. Reproducibility)
must pass unconditionally on every plan and task.
<!-- SPECKIT END -->

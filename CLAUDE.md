<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan:

- Active plan: [`specs/007-widget-tool-loop/plan.md`](specs/007-widget-tool-loop/plan.md)
- Spec: [`specs/007-widget-tool-loop/spec.md`](specs/007-widget-tool-loop/spec.md)
- Research: [`specs/007-widget-tool-loop/research.md`](specs/007-widget-tool-loop/research.md)
- Data model: [`specs/007-widget-tool-loop/data-model.md`](specs/007-widget-tool-loop/data-model.md)
- Contracts: [`specs/007-widget-tool-loop/contracts/`](specs/007-widget-tool-loop/contracts/)
- Quickstart: [`specs/007-widget-tool-loop/quickstart.md`](specs/007-widget-tool-loop/quickstart.md)

Features 001 (setup flow), 002 (build pipeline), 003 (runtime), 004 (widget
bundle), 005 (reviewer path), and 006 (openapi action catalog) artifacts remain
authoritative for the upstream halves of the system and can be read at
[`specs/001-setup-flow/`](specs/001-setup-flow/),
[`specs/002-build-pipeline/`](specs/002-build-pipeline/),
[`specs/003-runtime/`](specs/003-runtime/),
[`specs/004-ship-widget-bundle/`](specs/004-ship-widget-bundle/),
[`specs/005-full-reviewer-path/`](specs/005-full-reviewer-path/), and
[`specs/006-openapi-action-catalog/`](specs/006-openapi-action-catalog/).

Feature 007 retires the Medusa testbed (`demo/medusa`, gone) in favour of a
self-contained reference ecommerce at `demo/shop` (Fastify + Prisma + Vite +
React) and collapses the Feature 003 safe-read / action split so every shop-API
call executes in the widget with the shopper's bearer token; `atw_backend` never
reaches the shop.

The constitution at [`.specify/memory/constitution.md`](.specify/memory/constitution.md)
is the binding source for non-trivial decisions. Red-line principles
(I. User Data Sovereignty, V. Anchored Generation, VIII. Reproducibility)
must pass unconditionally on every plan and task.
<!-- SPECKIT END -->

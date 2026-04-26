# Feature Specification: Full Reviewer Path

**Feature Branch**: `005-full-reviewer-path`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Complete the /atw.build → docker compose up reviewer path so that after a Builder runs /atw.init, /atw.brief, /atw.schema, /atw.api, /atw.plan, /atw.build and /atw.embed, they can bring the full stack up with `docker compose up -d --wait` and interact with a working widget that talks to a real backend, without manual scaffolding steps or hidden gaps."

## Clarifications

### Session 2026-04-23

- Q: How should the backend image resolve its dependency on the shared runtime library code currently imported via `@atw/scripts/dist/lib/*`? → A: Vendor the required shared lib files into the Builder's project at render time and rewrite the generated imports to use relative paths. The project becomes fully self-contained; no private registry, no monorepo-rooted Docker build context.
- Q: How is the backend image made available to a reviewer who runs only `docker compose up -d --wait` on a fresh clone? → A: The compose file gains a `build:` directive pointing at the committed backend directory, so compose builds the image on demand the first time. A Builder's `/atw.build` still pre-builds and tags the image, making repeat runs cache hits. Reviewer shortcut (clone + `docker compose up`) coexists with the full Builder flow.
- Q: What is the public mechanism for scoping out the image step in tests? → A: An explicit CLI flag on the orchestrator (e.g., `--skip-image`). Tests pass it; Builder invocations never do. Image step is mandatory unless the flag is present. Environment-variable and separate-entrypoint approaches rejected as too implicit / too duplicative.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Builder ends `/atw.build` with a runnable backend (Priority: P1)

A Builder has just completed the upstream commands (`/atw.init` through `/atw.plan`) for their project. They run `/atw.build`. When the command finishes, the project directory contains every artefact a runnable backend needs: all generated source files (no broken imports), the configuration metadata required to compile and package the backend, and a tagged backend image registered with the local container runtime. Nothing is missing; nothing needs to be copied or patched by hand.

**Why this priority**: This is the MVP. Without it, the output of `/atw.build` is not deployable and every downstream command (`/atw.embed`, `docker compose up`, the widget itself) inherits the gap. Closing it is the single change that turns the pipeline from "appears to work" into "actually works".

**Independent Test**: From a freshly scaffolded project whose upstream commands have completed, run `/atw.build`. Verify that (a) every import in the generated backend source resolves to an existing file, (b) the backend can be compiled without errors, and (c) a tagged backend image is present in the local container runtime after the command returns. No other step of the pipeline needs to run.

**Acceptance Scenarios**:

1. **Given** a scaffolded project whose upstream commands (`/atw.init`, `/atw.brief`, `/atw.schema`, `/atw.api`, `/atw.plan`) have completed, **When** the Builder runs `/atw.build` and it reports success, **Then** the backend directory contains every source file referenced by the generated entrypoint, every meta file needed for compilation and packaging, and a tagged backend image is registered locally.

2. **Given** a successful `/atw.build` as in scenario 1, **When** the Builder inspects the build manifest, **Then** the record for the backend image is populated with its identifier, tag reference, and size, and the input-hash set covers every file whose change would alter the image.

3. **Given** a successful `/atw.build` as in scenario 1, **When** the Builder runs `docker compose up -d --wait` from the repository root, **Then** every service defined in the compose file reaches a healthy state without any "image not found" error for the backend service.

---

### User Story 2 — Build fails loudly when the image cannot be produced (Priority: P2)

A Builder runs `/atw.build` in a situation where the backend image cannot be produced — because the container runtime is not reachable, a template contains a syntax error, the generated source fails to compile, or a secret-shaped file is present in the build context. The command exits non-zero, prints a single-line diagnostic that names the failing step and the underlying cause, and records the failure in the build manifest. No stale or partially-built image is left tagged as the latest.

**Why this priority**: Today the image step is wrapped in a try/catch that swallows the error, so the overall command reports green while producing a project that cannot be deployed. This hides regressions from Builders and Reviewers alike, and erodes trust in the build manifest as a source of truth. Making failure loud is a prerequisite for relying on the pipeline.

**Independent Test**: Force one of the failure modes (stop the container runtime, corrupt a template, plant an `.env` in the backend build context) and run `/atw.build`. Verify the command exits non-zero, the stderr diagnostic names the failing step and cause in one line, and the build manifest records a `failed` result with a matching failure entry.

**Acceptance Scenarios**:

1. **Given** the container runtime is not reachable, **When** the Builder runs `/atw.build`, **Then** the command exits non-zero with a diagnostic that explicitly names the image step as the failing step and identifies the runtime as unreachable, and the build manifest records `result: "failed"` with a matching failure entry.

2. **Given** one of the backend templates contains a rendering or compilation error, **When** `/atw.build` runs, **Then** the command exits non-zero, the diagnostic names the offending template file, no backend image is tagged as the current release, and the manifest records `result: "failed"`.

3. **Given** the backend build context contains a secret-shaped file (for example an `.env` file), **When** `/atw.build` runs, **Then** the command refuses to build the image, the diagnostic names the offending file path, no image is produced, and the manifest records `result: "failed"`.

4. **Given** any of the failure modes above, **When** the Builder fixes the underlying cause and re-runs `/atw.build`, **Then** the build completes successfully and the resulting image is identical, byte-for-byte, to the image that a clean first-time build on the same inputs would produce.

---

### User Story 3 — Re-running `/atw.build` with no changes is a byte-identical no-op (Priority: P3)

A Builder re-runs `/atw.build` without changing any upstream artefact. The command quickly returns success, no files in the backend directory are rewritten, no image is rebuilt, no widget bundle is re-emitted, and the build manifest reflects that every output step was a cache hit. The second run is observationally indistinguishable from "nothing happened" except for timing metadata.

**Why this priority**: Reproducibility is a red-line principle of the project constitution (principle VIII). The existing build pipeline already guarantees deterministic source rendering and deterministic widget bundles; this feature extends the same guarantee to the backend image and the newly-seeded meta files. Without this, every rerun invalidates the image layer cache and the determinism contract silently regresses.

**Independent Test**: Run `/atw.build` to success on a stable input set. Capture the hashes of every output under the backend directory and the tagged image. Re-run `/atw.build`. Verify all hashes match and the manifest reports every output step as unchanged.

**Acceptance Scenarios**:

1. **Given** a project whose `/atw.build` has just completed successfully with no subsequent changes to any upstream artefact, **When** the Builder runs `/atw.build` again, **Then** the command completes without rewriting any file in the backend directory, without rebuilding the backend image, and the manifest records every output step as "unchanged".

2. **Given** a successful build on one machine, **When** another contributor runs `/atw.build` on the same revision on a different machine whose container runtime is available, **Then** the resulting backend image has the same content identifier (independent of non-semantic timestamps) as the first, and the generated source files have byte-identical contents.

---

### User Story 4 — Reviewer opens the demo and the widget just works (Priority: P2)

A reviewer clones the repository, installs dependencies, and follows the documented quickstart for the canonical demo. They run the upstream commands, `/atw.build`, `/atw.embed`, and then `docker compose up -d --wait`. They open the storefront URL in a browser. The widget launcher appears; clicking it opens the chat; sending a message receives an answer from the backend grounded in the enriched artefacts. No step outside those explicitly called out by the quickstart is needed.

**Why this priority**: The demo is the product's only living proof-of-life for the end-to-end reviewer path. The constitution's reproducibility principle is only truly satisfied if an outside reviewer can reproduce the happy path from a clean clone. This story is how P1, P2, and P3 prove themselves in combination.

**Independent Test**: On a clean clone of the repository on a machine with the required tooling, follow the documented quickstart commands verbatim. Verify that at the final step the widget loads in the browser and returns an answer to a real user query without any error.

**Acceptance Scenarios**:

1. **Given** a clean clone of the repository on a machine with the required tooling available, **When** a reviewer follows the quickstart commands verbatim, **Then** at the final step the widget responds to a sample user query without any "cannot reach the assistant" error and without the reviewer needing to copy files, edit generated sources, or rebuild anything outside the documented commands.

2. **Given** the reviewer flow above, **When** the reviewer compares the state of the repository after the final step against the committed canonical demo, **Then** the committed demo is in the same "ready to run" state (all generated backend sources present, meta files present, widget bundle present), so a reviewer who only runs `docker compose up -d --wait` on a fresh clone also reaches a working widget.

---

### Edge Cases

- The container runtime becomes reachable mid-way through `/atw.build` (e.g., runtime daemon is started after template rendering but before image build). The image step succeeds; the partially-new, partially-cached state remains internally consistent.
- A prior `/atw.build` failed in the middle of the image step, leaving a dangling untagged image layer. The next run succeeds without leaking the dangling layer into the tagged output and without treating the half-finished state as a valid cache hit.
- The generated entrypoint imports a symbol that no rendered template provides (caused, for example, by a drift between entrypoint template and library templates). This is caught at compile time inside the image build and surfaces as a P2-style loud failure, not a green build with a runtime crash.
- A meta file (`Dockerfile`, `package.json`, or `tsconfig.json`) has been hand-edited in the project directory since the last run. `/atw.build` overwrites it with the canonical rendered version but records the overwrite (and the prior content, if backup is configured) so the Builder can recover their edit.
- The backend build context contains a file that is not secret-shaped but is unusually large (e.g., a stray sample dataset). The build may slow down but must not silently include it in the image; the manifest's input-hash set makes the inclusion discoverable on inspection.
- The Builder invokes `/atw.build` with the explicit test-mode flag that scopes the IMAGE step out. The command succeeds and records image step as "skipped" with the scoping reason; production-mode callers never see this state.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `/atw.build` MUST render every backend template — including templates in subdirectories such as `lib/` and `routes/` — into the Builder's project so that the generated entrypoint resolves every import to an existing file.

- **FR-002**: `/atw.build` MUST seed every meta file required to compile and package the backend (at minimum a container build descriptor, a dependency manifest, and a compile-configuration file) into the Builder's project backend directory. The set of seeded meta files MUST be self-consistent: a fresh project that only contains what `/atw.build` produced MUST be packageable without adding any additional meta file by hand.

- **FR-002a**: `/atw.build` MUST vendor every shared runtime library file the generated backend source imports into the Builder's project backend directory, and MUST rewrite the corresponding imports in the generated source to use relative paths into the vendored location. After rendering, the backend project MUST NOT depend on any package outside its own dependency manifest for its own source to compile.

- **FR-003**: After a successful `/atw.build`, the backend image MUST be present in the local container runtime under the project's canonical tag, and the build manifest MUST record its identifier, tag reference, and size.

- **FR-004**: The build manifest MUST track input hashes for every file whose contents affect the backend image, so that any change to a template, meta file, shared runtime library, or project configuration invalidates the image cache.

- **FR-005**: `/atw.build` MUST exit non-zero and record `result: "failed"` in the build manifest whenever the image step cannot produce a valid tagged image for a real reason (runtime unreachable, template error, compile error inside the image build, secret-shaped file in the build context, or generic build engine failure). Silent fallthrough to `result: "success"` with an empty image record is forbidden outside explicitly-scoped test modes.

- **FR-006**: The failure diagnostic for any image-step failure MUST, in a single line emitted to stderr, name the failing step and the primary cause in terms a Builder can act on without reading source code.

- **FR-007**: When `/atw.build` fails at the image step, no previously-tagged backend image MUST be overwritten or untagged. The prior successful image (if any) remains the canonical tagged release until a subsequent successful build replaces it.

- **FR-008**: `/atw.build` MUST detect and refuse to include secret-shaped files (credentials, private keys, `.env` files, and similar) in the backend image's build context. This check runs before any container runtime call and its failure produces a diagnostic that names the offending file path.

- **FR-009**: Re-running `/atw.build` with no upstream changes MUST NOT rewrite any rendered file, MUST NOT rebuild the backend image, and MUST report every output step as "unchanged" in the build manifest. The determinism contract established by the prior build pipeline feature applies identically to meta files and the backend image.

- **FR-010**: Two successful `/atw.build` runs on the same revision of the repository, on different machines, MUST produce backend images whose content identifiers match (ignoring non-semantic timestamps permitted by the container runtime), and MUST produce byte-identical generated source and meta files.

- **FR-011**: The canonical demo committed to the repository MUST remain in the state that `/atw.build` produces for its inputs — i.e., a reviewer who clones the repository and runs only `docker compose up -d --wait` MUST reach the same working-widget outcome as a reviewer who re-runs the full upstream command sequence.

- **FR-011a**: The repository's compose configuration MUST declare a build directive for the backend service pointing at the committed backend directory of the canonical demo, so that `docker compose up -d --wait` on a fresh clone can construct the image from committed sources without requiring the reviewer to run any upstream command first. A Builder who runs `/atw.build` still pre-builds and tags the image, making subsequent compose invocations cache hits rather than fresh builds.

- **FR-012**: The documented quickstart for the canonical demo MUST, when followed verbatim, take a clean clone to a working widget with no undocumented steps, no manual file copies, and no edits to generated files.

- **FR-013**: `/atw.build` MUST accept an explicit command-line flag that suppresses the IMAGE step, intended for contract tests that do not need a running container runtime. The flag MUST be visible in the command's help output and MUST NOT be activatable by any other means (environment variable, implicit runtime detection, or silent fallback). When the flag is absent, the IMAGE step is mandatory and its failure mode is loud (FR-005); when the flag is present, the build manifest records the IMAGE step as "skipped" with the reason "suppressed by --skip-image flag".

- **FR-014**: The existing pipeline step order (render backend source, compile checks, build image, activate compose) MUST be preserved. Changes to internal rendering behaviour (recursion into subdirectories, seeding of meta files) MUST NOT reorder these steps or introduce new ones that earlier pipeline tests would not tolerate.

### Key Entities

- **Rendered backend project**: The populated `backend/` directory inside a Builder's project after `/atw.build` has run. Attributes include the generated source file tree (entrypoint, configuration, routes, library modules), the vendored shared runtime library files the generated source imports via relative paths, the meta files needed to compile and package it, and a relationship to the templates under the shared backend package that produced it.

- **Backend image record**: The entry in the build manifest describing the backend image produced by a successful build. Attributes include the image's content identifier, its canonical tag, its on-disk size, and the full input-hash set that determines cache validity.

- **Build manifest**: The durable record of a `/atw.build` run. Attributes include a result ("success" or "failed"), per-step status (including "unchanged" for no-op reruns), a failure-entry list describing any failed step and its cause, and input-hash coverage that makes reruns reproducible.

- **Canonical demo**: The committed reviewer walkthrough under the repository's demo directory. Attributes include a fully populated backend project (i.e., the "post-build" state), a working storefront configuration, and the widget bundle staged for serving.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From a clean clone of the repository on a machine with the required tooling, a reviewer can follow the documented quickstart and reach a widget that responds to a sample query in under 15 minutes end-to-end, without running any step not listed in the quickstart.

- **SC-002**: 100% of `/atw.build` runs that produce `result: "success"` in the build manifest are followed by a `docker compose up -d --wait` from the repository root that brings every service to a healthy state without an "image not found" error for the backend service.

- **SC-003**: 0% of image-step failures (runtime unreachable, template error, compile error, secret-shaped file, engine failure) produce a `result: "success"` manifest. Every such failure exits non-zero and records `result: "failed"` with a matching failure entry.

- **SC-004**: Re-running `/atw.build` with no upstream changes completes in under 10 seconds (on a machine where the prior run's image is cached) and rewrites zero files. The second-run manifest reports every output step as "unchanged".

- **SC-005**: On two different machines running the same revision, the generated source files under the backend directory have identical content hashes, and the backend images have matching content identifiers (modulo permitted non-semantic timestamps).

- **SC-006**: The committed canonical demo is in a state where a reviewer who runs only `docker compose up -d --wait` on a fresh clone reaches the same working-widget outcome as a reviewer who runs the full upstream command sequence.

- **SC-007**: No contract test under the existing `packages/scripts/test/` or `tests/` trees regresses (baseline: every test green on the merge commit).

- **SC-008**: Every file that ends up inside the backend image has an entry in the manifest's input-hash set or is produced deterministically from an entry in that set, so the manifest is a complete map of "what changes trigger a rebuild".

---

## Assumptions

- The Builder's machine has a working local container runtime reachable by the pipeline. The build pipeline is not expected to provision the runtime itself; it is expected to detect the runtime's absence and fail loudly (FR-005).

- The shared backend package continues to be the single source of truth for backend templates and meta-file sources. Projects are rendered from it; they do not carry their own copies of the templates. Shared runtime library files that the generated source depends on are vendored out of the shared package into each project at render time, so the project's backend directory becomes a complete, self-contained build context for the image.

- The canonical demo under the repository's demo directory is the single reviewer walkthrough. Per prior scoping, the demo remains a throwaway testbed in spirit — this feature makes it work reliably, but does not turn it into a product.

- The existing determinism contract from the prior build pipeline feature remains the authority for what "byte-identical" means. This feature extends that contract to the backend image and meta files without redefining it.

- The existing pipeline step order (render backend source, compile checks, build image, activate compose) is the correct order. This feature closes gaps inside steps and between steps; it does not re-sequence the pipeline.

- Widget runtime behaviour is out of scope. The widget already loads, calls the chat endpoint, and renders results. It is the observer that proved the gap; it is not the fix.

- Production-grade backend concerns (authentication secrets, observability beyond what the runtime feature already covers, multi-tenant deployment) are out of scope. The feature targets the reviewer path, not production readiness.

- Replacing the Medusa testbed with a different host application is out of scope. The Medusa demo stays; this feature makes it work end-to-end.

- The constitution's red-line principles — especially Reproducibility (principle VIII) — are binding. Every output that affects the backend image must be templated from the shared backend package or produced deterministically from an input the manifest tracks.

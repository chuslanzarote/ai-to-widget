# Feature Specification: OpenAPI-Driven Action Catalog and Client-Side Execution

**Feature Branch**: `006-openapi-action-catalog`
**Created**: 2026-04-23
**Status**: Draft
**Input**: User description: "Close the gap left by Feature 003 so that the host's OpenAPI document is the canonical source for what actions the widget can execute. Generate both the tool descriptors that Opus emits `tool_use` blocks against and the declarative execution recipes the widget uses to invoke those operations with same-origin credentials, such that any host publishing OpenAPI can plug in ATW and get an action-capable widget without bespoke glue code per action."

## Clarifications

### Session 2026-04-23

- Q: How is host-response content rendered in the confirmation card (product names, error messages, and other strings extracted from the host's HTTP response under the catalog's response-handling directives)? → A: Strict plain text — all host-response content is HTML-escaped at render time; no Markdown, no HTML, and no links are interpreted. The confirmation card's rendering path has no attack surface for a compromised or misconfigured host to inject executable or interpreted content.

- Q: What is the widget's retry behaviour when an action request fails transiently (network timeout, connection reset, host returns 5xx)? → A: No automatic retry in v1. Any non-2xx response or network failure surfaces immediately through the confirmation card, and the shopper decides whether to retry by asking again. This avoids double-submit on non-idempotent methods like POST without requiring the widget to reason about idempotency the OpenAPI does not reliably declare.

- Q: Is there a ceiling on how many actions the classifier may include, and what happens beyond it? → A: Soft warning threshold at 20 included actions. The classifier emits every eligible action but prints a build-time warning naming each action over the threshold and reminding the Builder that Opus's tool-selection accuracy degrades past this limit. No hard cap in v1. The UX context is that shoppers reach actions via natural-language chat requests (Opus picks the tool from the list), not by choosing from a visible menu, so tool-list size affects Opus's selection accuracy rather than screen real estate.

- Q: How does the pipeline handle OpenAPI drift — i.e., the host modifies their API after the document has been ingested? → A: Manual re-ingestion only. The stored OpenAPI document is a pinned snapshot and the canonical source of truth for every subsequent pipeline step. The Builder re-runs the ingestion step explicitly when they know the host has changed. No automatic drift detection, no automatic refresh from the source URL. This keeps reproducibility (Principle VIII) unconditional — a given committed document always produces the same manifest, tool catalog, and executor catalog across machines and across time — and keeps changes visible in version-control diffs (Principle II).

- Q: How long does the widget wait before declaring an action request timed out? → A: 15 seconds, fixed in v1 and not configurable per action. Generous enough for most hosts and for occasional cold-start latency; short enough that a hung request surfaces a clear failure in the confirmation card rather than leaving the shopper watching an abandoned spinner. A future feature can make this per-action-configurable via the catalog if a specific host shows a real need.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Builder ingests the host's OpenAPI as a first-class input (Priority: P1)

A Builder preparing a project for a host that publishes an OpenAPI 3.0 document provides that document to the Builder flow as an explicit input (local file path or URL). The Builder validates the document, records it as a first-class artefact alongside the brief and the schema map, and treats it as the single source of truth for what operations exist on the host. If the document is syntactically broken, references unreachable external schemas, or is a version outside the supported range, the command fails loudly and names the failing document. Re-running with the same input produces a byte-identical stored artefact.

**Why this priority**: Nothing else in this feature can exist without a recorded, validated OpenAPI artefact. The classifier, the tool-descriptor renderer, and the executor-catalog renderer all consume it. Without this step the project has no machine-readable answer to "what can the widget do on this host?", and the widget inherits an empty action surface — the exact gap Feature 003 left open.

**Independent Test**: Start a project whose upstream artefacts (brief, schema map) are already committed. Provide an OpenAPI 3.0 document. Run the Builder's API-ingestion step. Verify that (a) the document is stored as a first-class artefact under the project's artefact directory, (b) the command refuses a Swagger 2.0 document or a malformed OpenAPI 3.0 document with a diagnostic that names the offending file, and (c) re-running with the same input produces byte-identical stored content.

**Acceptance Scenarios**:

1. **Given** a project with a brief and a schema map already committed, **When** the Builder runs the API-ingestion step against a valid OpenAPI 3.0 document, **Then** the document is stored as a first-class project artefact, the command reports success, and the artefact is listed alongside `brief.md` and `schema-map.md` as an input to downstream steps.

2. **Given** the same project, **When** the Builder provides a Swagger 2.0 document or an OpenAPI 3.0 document that fails validation (unresolved `$ref`, missing required `info.version`, or a syntax error), **Then** the command exits non-zero with a diagnostic that names the offending file and the specific failure mode, and no artefact is written.

3. **Given** a successful ingestion as in scenario 1, **When** the Builder re-runs the API-ingestion step with the same input document, **Then** the stored artefact is byte-identical to the prior run and the command records the step as unchanged.

---

### User Story 2 — Classification yields a reviewable action manifest (Priority: P1)

Given the ingested OpenAPI document, the system classifies each operation as either a shopper-facing action (safe to expose to the widget) or excluded (admin, internal, or otherwise out of scope). The classification is produced by a deterministic heuristic pass followed by an Opus review that can only narrow the heuristic's selection — never invent an action that the OpenAPI does not define. The output is an `action-manifest.md` that lists, for every included action, its HTTP shape, input schema, human-readable description, confirmation requirement, and a mapping to the entities named in `schema-map.md`. The manifest also carries an explicit "excluded operations" list so the Builder owner can audit what was filtered out and why. Every included action traces back to a specific OpenAPI operation by `operationId`, `path`, and `method`; any descriptor that fails to cite a real OpenAPI operation is rejected before the manifest is written.

**Why this priority**: Classification is the human-in-the-loop checkpoint (Principle IV) that turns a raw OpenAPI document into a curated, shopper-safe catalog. Without a reviewable artefact the Builder cannot audit what the widget will be allowed to do, and Anchored Generation (Principle V) has no enforcement point. The excluded-operations list is what makes the manifest auditable rather than a black box.

**Independent Test**: Given an ingested OpenAPI document, run the classification step. Verify that (a) every included action names a `(operationId, path, method)` triple that exists in the document, (b) the excluded list is non-empty and each entry carries a short reason, (c) the manifest is reviewable by hand and editable (the Builder owner can flip `confirmation_required` or remove an action, and the next run honors the edit), and (d) an attempt to inject a fabricated action (one whose `operationId` is not in the OpenAPI) is rejected at validate time.

**Acceptance Scenarios**:

1. **Given** a project with an ingested OpenAPI document, **When** the Builder runs the classification step, **Then** `action-manifest.md` is written with an included list and an excluded list, every included action cites an OpenAPI operation that exists in the ingested document, and the manifest is re-generated deterministically from the same inputs.

2. **Given** an OpenAPI document that defines shopper operations (e.g., `POST /store/carts/{id}/line-items`) alongside admin operations (e.g., `POST /admin/users`), **When** classification runs, **Then** shopper-facing write operations land in the included list with `confirmation_required: true` as the default and admin operations land in the excluded list with a short textual reason.

3. **Given** a completed classification, **When** a hypothetical classifier output contains an action whose `operationId` does not appear in the ingested OpenAPI, **Then** the system rejects the manifest before writing it, exits non-zero, and names the offending fabricated action in the diagnostic.

4. **Given** a completed classification, **When** the Builder owner edits `action-manifest.md` (for example to flip `confirmation_required` to `false` on a specific action or to remove an action from the included list) and re-runs the pipeline, **Then** the edit is preserved and propagates into downstream generated artefacts.

---

### User Story 3 — Build populates the backend tool catalog from the manifest (Priority: P1)

Running the build step reads `action-manifest.md`, transforms each included action into the runtime tool-descriptor shape Opus expects, and threads that list into the backend render context. The committed backend's `tools.ts` file ends populated — not an empty array — and the functions the backend uses to present tools to Opus return the generated descriptors. Tool descriptors that correspond to host actions are correctly marked so that the backend can split them from any non-action informational tools. Re-running the build with no upstream changes produces a byte-identical `tools.ts`.

**Why this priority**: This is the wire between the manifest and Opus. Today `tools.ts` renders with an empty array because the render context does not carry tool data; this story closes that gap. Without it, Opus has no tools to emit `tool_use` blocks against and the widget receives an empty `actions[]` no matter how well-curated the manifest is.

**Independent Test**: With an ingested OpenAPI and a classified action manifest that lists at least one shopper-facing action, run the build step. Verify that (a) the committed backend's `tools.ts` is non-empty, (b) the function that prepares tools for Opus returns a list whose length equals the included-actions count, (c) the subset marked as actions matches the manifest's included list exactly, and (d) a re-run with no upstream changes leaves `tools.ts` byte-identical.

**Acceptance Scenarios**:

1. **Given** a project with a non-empty included-actions list in `action-manifest.md`, **When** the Builder runs the build step, **Then** the committed backend's tool-catalog source file is populated with one runtime tool descriptor per included action, each descriptor carries the fields Opus needs (name, description, input schema) and a flag indicating it corresponds to a host action.

2. **Given** a successful build as in scenario 1, **When** the backend is started and a chat request flows through, **Then** the function that returns the Opus tool list returns the generated descriptors, and the split that separates action tools from any non-action informational tools reflects the manifest's `is_action` assignment.

3. **Given** a successful build, **When** the Builder re-runs the build step without changing any upstream artefact, **Then** `tools.ts` is not rewritten and the build manifest records the step as unchanged.

4. **Given** an `action-manifest.md` with zero included actions (because the host published no shopper-safe operations or because every operation was filtered out), **When** the build step runs, **Then** `tools.ts` is still generated with an empty but well-formed catalog, the build exits zero with a visible warning that the widget will be chat-only, and subsequent widget builds reflect this.

---

### User Story 4 — Widget executes actions with same-origin credentials and never through the backend (Priority: P1)

The build step also emits an `action-executors` artefact — a declarative JSON catalog of how to invoke each included action as an HTTP request: method, URL template with named variable substitution from the `tool_use` arguments, headers the host expects (content-type, non-credential metadata only), and response-handling directives (success criteria, error-shape, idempotency semantics). The widget loads this catalog at initialisation time. When Opus emits a `tool_use` for an action, the backend returns an `ActionIntent` the widget executes client-side. The widget's action executor resolves the intent against the local catalog and issues a browser `fetch` with the shopper's same-origin credentials attached. The shopper's session cookies, tokens, and identifying headers never reach the chat backend; the backend never mints credentials on the shopper's behalf; the catalog, because it is data not code, is executed by a fixed audited engine in the widget rather than `eval`'d or dynamically imported. Success and error states are surfaced to the shopper through the existing confirmation card.

**Why this priority**: This is the red-line guarantee. Principle I (User Data Sovereignty) and the project constitution forbid the chat backend from touching shopper credentials. If actions were executed backend-side, every request would leak the shopper's authentication material through the chat path. Declaring the catalog as data (not code) is what keeps the widget's execution engine auditable and keeps the XSS surface bounded to a fixed interpreter — no dynamic code loading, no `eval`, no `new Function`.

**Independent Test**: With a committed build that includes at least one action executor, load the widget in a browser tab on the host domain where the shopper has an active session. Trigger a tool-use cycle end to end. Verify that (a) the `fetch` call the widget makes carries the shopper's same-origin cookies, (b) no request the chat backend receives ever carries the shopper's session material, (c) the executor's URL, method, and body are derived from the declarative catalog with no code execution step, and (d) a success response and an error response each render through the confirmation card with distinct states.

**Acceptance Scenarios**:

1. **Given** a widget initialised on a host domain where the shopper has an active session, **When** Opus emits a `tool_use` that resolves to an included action and the shopper confirms, **Then** the widget issues a single `fetch` to the host domain with the credentials mode that attaches same-origin cookies, the request body is constructed from the `tool_use` arguments via the catalog's declarative substitution rules, and no part of that request is visible on the chat backend's request log.

2. **Given** the same setup, **When** the shopper's request completes with a success response from the host, **Then** the confirmation card reflects the success state with a human-readable summary derived from the catalog's response-handling directives, and the `tool_result` block the backend receives contains no shopper-identifying material.

3. **Given** the same setup, **When** the host returns an error (e.g., out-of-stock, not-authenticated, validation failure), **Then** the confirmation card reflects the error state with a message shaped by the catalog, the shopper sees that the action did not succeed, and the backend's next chat turn can continue without having seen the shopper's credentials.

4. **Given** a published widget bundle, **When** a security reviewer inspects the execution path the widget uses to invoke actions, **Then** the path is a fixed audited interpreter over declarative catalog entries — no `eval`, no `new Function`, no dynamic `import` of generated code, no string-concatenation of URL templates into HTML, and no mechanism by which the chat backend could cause the widget to issue a request to a URL not declared in the catalog.

---

### User Story 5 — Reviewer demo walks through an action end to end (Priority: P2)

A reviewer clones the repository, brings the demo stack up with the documented quickstart, opens the storefront URL in the browser, and asks the widget in natural language to add a specific product to their cart. The widget renders the chat reply, presents a confirmation card describing the proposed action, the reviewer confirms, the cart updates in the host's data (visible on the host's own `/cart` page), and no step outside the documented quickstart is needed. The round-trip is observable without developer tools; the success path is obvious.

**Why this priority**: The demo is the reviewer's only living proof that the feature works end to end. It is the concrete instance of every P1 story operating in combination. It comes after the P1 stories because each P1 must work in isolation first; this story is where they prove themselves together.

**Independent Test**: On a clean clone, follow the quickstart verbatim. Log in to the demo storefront as a shopper. Open the widget, ask "add the coffee product to my cart" (or the canonical demo phrase), confirm the action, and verify the host's `/cart` page reflects the change without any error visible to the reviewer and without the reviewer needing to inspect devtools.

**Acceptance Scenarios**:

1. **Given** a clean clone with the required tooling available, **When** the reviewer follows the documented quickstart and opens the storefront in a logged-in shopper session, **Then** the widget loads, an initial natural-language request for an action produces a confirmation card, and confirming the card updates the cart visibly on the host's own `/cart` page within the same browsing session.

2. **Given** the flow above, **When** the reviewer opens their browser's network inspector to audit requests, **Then** the action-invocation request is visible as a direct `fetch` from the widget to the host domain with same-origin credentials, and no request to the chat backend carries the shopper's session cookies.

---

### User Story 6 — Graceful degradation when no safe actions exist (Priority: P3)

The host has no OpenAPI document, or has one that contains no shopper-safe operations, or classification filtered every operation out. The build succeeds anyway: the backend tool catalog is well-formed but empty, the action-executors artefact is well-formed but empty, the widget boots and operates as chat-only, and a single clearly worded warning tells the Builder what happened and how to restore action capability. The Builder can open `action-manifest.md` and see the excluded list to decide whether to override any exclusion by editing the manifest.

**Why this priority**: Every feature earns its resilience by surviving the degenerate input. Without this story, a host with no OpenAPI would silently produce a broken build or a widget that errors at load time; with it, the Builder gets a chat-only widget, a clear diagnostic, and a curation path. The excluded list is the Builder's lever.

**Independent Test**: Run the pipeline with a host whose OpenAPI contains only admin operations (so classification produces an empty included list). Verify that (a) the build exits zero, (b) the warning appears in the build output, (c) the widget at runtime renders and replies to chat but does not attempt to surface actions, and (d) the excluded list in the manifest is complete and reviewable.

**Acceptance Scenarios**:

1. **Given** a project whose classifier produces an empty included-actions list, **When** the Builder runs the build step, **Then** the build completes successfully, a warning is emitted naming the empty catalog and the location of the excluded list, and the widget bundle produced is the chat-only variant with an empty action catalog.

2. **Given** the empty-catalog state above, **When** the Builder edits `action-manifest.md` to move a specific operation from the excluded list to the included list and re-runs the pipeline, **Then** the next build produces a populated tool catalog and a populated action-executors artefact without any other intervention.

---

### Edge Cases

- The OpenAPI document declares an operation whose `requestBody` schema references a `$ref` pointing into an external file. Ingestion either resolves the reference against the bundled document or fails loudly — it MUST NOT produce a descriptor whose input schema silently omits required fields.

- Two OpenAPI operations share the same `operationId` (invalid per spec but observed in the wild). Ingestion refuses the document with a diagnostic that names both occurrences; classification never runs on an ambiguous input.

- The OpenAPI document declares an operation whose request body has no schema (free-form JSON). The classifier excludes the operation by default with a reason citing the missing schema; the Builder owner can override by editing the manifest if they know the host accepts a specific shape.

- The OpenAPI document declares an operation whose `security` requirement names a scheme that is not cookie-based (e.g., `oauth2: [write:cart]`). The classifier excludes the operation by default because v1 only supports same-origin cookie auth. The excluded-operations entry names the security scheme as the reason.

- The host's OpenAPI server URL differs from the origin the widget is embedded on (e.g., `api.host.com` vs `host.com`). The widget's executor refuses to attach credentials on a cross-origin call because `credentials: 'include'` would not send the shopper's cookies anyway; the executor surfaces a "configuration mismatch" error in the confirmation card and the build-time diagnostic flags this at build time, not only at runtime.

- An included action's input schema declares a required field that the `tool_use` arguments from Opus do not provide. The executor refuses to issue the request, the confirmation card shows a validation error describing the missing field, and the backend's next chat turn can continue.

- The manifest includes an action whose HTTP method is `DELETE` and whose URL template points at a resource identifier the shopper does not own. The host's API is the authority for permission; the widget's executor faithfully issues the request; the host returns 403; the confirmation card surfaces the host's error message. The widget does not attempt to pre-authorise or enrich the request with credentials the shopper did not already hold.

- The classifier selects more than 20 shopper-facing actions from a large host OpenAPI (e.g., a storefront with many distinct resource types). The build completes, the warning is emitted naming each action over the threshold, and the Builder owner can open `action-manifest.md` to move low-value actions to the excluded list and re-run. Opus's tool-selection accuracy at runtime is the Builder owner's responsibility; the pipeline surfaces the risk but does not enforce the curation.

- The Builder re-runs the build on a machine whose Opus snapshot has changed since the last run. The classification step MAY produce a different `action-manifest.md`, but the byte-identical guarantee for `tools.ts` and the executors catalog only holds for identical manifest inputs — the determinism contract applies to the render step, not to the upstream Opus step, and the manifest surfaces the model snapshot used.

- The widget is embedded on a page that has a strict Content Security Policy denying `fetch` to the API origin. The executor's request fails at the CSP layer; the confirmation card surfaces the CSP denial distinctly from other errors so the Builder can diagnose it.

- The host returns a response whose field values contain HTML, Markdown, or raw `<script>` tags (because the host echoes user-supplied content, or because the host itself is compromised). The widget's confirmation card renders the field as literal text — the markup characters appear as-is rather than being interpreted — and no browser-side execution occurs. The widget's rendering sandbox is the same whether the host is trusted, misconfigured, or hostile.

- An action request times out mid-flight (the host has not responded within the widget's 15-second timeout) or returns a 5xx. The widget aborts the request, does not retry, and the confirmation card shows a single failure state naming the underlying cause (timeout vs. server error). The shopper's next natural-language message to the widget can produce a fresh `tool_use` and a fresh confirmation card if they want to try again; the widget never issues a second HTTP request on behalf of the original `tool_use`.

- The host's live API has changed since the Builder last ingested its OpenAPI document (new operation added, field renamed, endpoint removed). Pipeline runs continue to consume the committed snapshot and are unaware of the drift. Symptoms surface as host-side 404s or schema-validation errors on calls the manifest still lists; the Builder resolves by re-running the ingestion step against the updated source and then re-running downstream steps. The pipeline neither detects drift automatically nor refreshes the snapshot in the background.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Builder pipeline MUST accept an OpenAPI 3.0.x document as explicit input, either as a local file path or as a URL, and MUST record it as a first-class input artefact in the project's artefact directory alongside the brief and the schema map.

- **FR-002**: The ingestion step MUST validate the document (including resolving local `$ref`s and rejecting documents with duplicate `operationId`s) and MUST exit non-zero with a diagnostic naming the offending file and failure mode if validation fails. Swagger 2.0 and OpenAPI versions outside 3.0.x are rejected at this step with an explicit out-of-scope diagnostic.

- **FR-003**: Classification MUST produce `action-manifest.md` listing every included shopper-facing action and every excluded operation. Each included entry MUST carry: an HTTP method and path, the source `operationId`, a human-readable description, the input schema, a `confirmation_required` flag (default `true`), a binding reference to one or more entities named in `schema-map.md` where applicable, and an `is_action` flag set to `true`. Each excluded entry MUST carry at minimum the source `operationId`, the HTTP method and path, and a short textual reason.

- **FR-004**: Classification MUST reject any descriptor whose `(operationId, path, method)` triple does not resolve to an operation present in the ingested OpenAPI document. The manifest is not written when rejection occurs; the command exits non-zero and names the fabricated descriptor.

- **FR-005**: Classification MUST default to excluding operations that are under an administrative path prefix, that declare a non-cookie-based security requirement, that mutate resources the documentation describes as inventory or user-management, or that have no request-body schema. The Builder owner MAY override any default by editing `action-manifest.md` directly; subsequent runs MUST honour the edit.

- **FR-006**: The build step MUST read `action-manifest.md`, derive a runtime tool descriptor for each included action, pass the list into the backend render context, and render the backend's tool-catalog source file so that it is non-empty whenever the manifest's included list is non-empty. The descriptor fields MUST match the shape the chat-endpoint contract (Feature 003 §5) defines.

- **FR-007**: The function that exposes the tool list to Opus MUST return the generated descriptors after a successful build. The subset of descriptors used as host-action tools MUST equal the manifest's included list exactly — neither a superset nor a subset.

- **FR-008**: The build step MUST produce an `action-executors` artefact committed to the project: a declarative JSON catalog that describes, for each included action, the HTTP method, the URL template with named substitution points matching the `tool_use` argument names, the non-credential request headers, the credential mode (fixed to "same-origin-cookies" in v1), and response-handling directives for success and error states.

- **FR-009**: The widget bundle MUST load the `action-executors` catalog at initialisation and MUST interpret it with a fixed, audited engine. The widget MUST NOT `eval` the catalog, MUST NOT construct `new Function` from any catalog field, and MUST NOT dynamically `import` code referenced by the catalog. The interpreter is a single code path that accepts declarative catalog entries and produces HTTP requests.

- **FR-009a**: Every string the widget renders inside the confirmation card that was extracted from a host HTTP response (product names, status messages, error descriptions, any field the catalog's response-handling directives project into the card) MUST be rendered as plain text with HTML-escaping applied at render time. The confirmation card MUST NOT interpret Markdown, HTML, or autolinking on host-response content. This invariant holds regardless of the shape of the host's response body and regardless of any formatting hint the response contains.

- **FR-010**: When the widget issues an action request, the `fetch` call MUST attach the shopper's same-origin credentials via `credentials: 'include'` (or the equivalent idiomatic setting) and MUST NOT include any header whose value was minted by the chat backend. The chat backend MUST NOT see, log, or otherwise receive the shopper's session cookies, authorization headers, or identifying tokens at any point during an action round-trip.

- **FR-011**: Every confirmation card rendered by the widget for an action MUST surface a success state or an error state derived from the catalog's response-handling directives. The default for every included action is `confirmation_required: true`; this default MAY only be relaxed by a Builder owner editing `action-manifest.md` and cannot be overridden by the host or by Opus.

- **FR-012**: Re-running the build step on the same ingested OpenAPI document, the same `action-manifest.md`, and the same shared runtime library snapshot MUST produce byte-identical generated backend tool-catalog source and a byte-identical `action-executors` artefact. On a different machine with the same inputs and the same snapshot, the output MUST also be byte-identical.

- **FR-013**: The ingested OpenAPI document, `action-manifest.md` (with both included and excluded lists), and the `action-executors` artefact MUST each be human-readable markdown or JSON committed to the project so the Builder can audit, diff in version control, and edit. No action-catalog state MAY live only in a binary or hidden store.

- **FR-014**: If the ingested OpenAPI document is missing or if classification yields an empty included list, the build step MUST still complete successfully, emit a single clear warning to the Builder explaining that the widget will be chat-only, produce a well-formed but empty backend tool catalog, and produce a well-formed but empty `action-executors` artefact. Widget initialisation on an empty catalog MUST render a chat-only widget without errors.

- **FR-015**: The widget's executor MUST refuse to issue a request when the request body fails to satisfy the included action's input schema (missing required field, type mismatch), and the confirmation card MUST surface the validation error. The executor MUST NOT forward malformed requests to the host.

- **FR-015a**: The widget MUST NOT automatically retry an action request for any reason — not on network timeout, not on connection reset, not on a 5xx response, not on a 4xx response. Every non-2xx outcome and every network-level failure MUST surface to the shopper through the confirmation card's error state exactly once. Retrying an action is a new shopper-initiated request: the shopper asks the chat again, Opus emits a new `tool_use`, a new confirmation card appears. The widget never issues two HTTP requests to the host on behalf of a single `tool_use`.

- **FR-016**: The build step MUST detect when an included action's URL template resolves to an origin different from the origin the widget is configured to embed on (cross-origin) and MUST emit a build-time warning that names the offending action and explains that same-origin credential attachment will not apply. The widget's executor MUST also surface a distinct configuration-mismatch error at runtime if such an action is invoked.

- **FR-017**: The Builder owner MUST be able to curate the manifest by hand: removing an included action, moving an excluded action to included (with responsibility for ensuring the override does not violate Principle I), or flipping `confirmation_required`. Subsequent pipeline runs MUST honour those edits and propagate them into the generated backend tool catalog and the `action-executors` artefact.

- **FR-018**: `action-manifest.md` MUST record the model snapshot used for the classification step (model id and effective date) and the content hash of the ingested OpenAPI document, so that a Builder or reviewer can determine whether a manifest change was driven by an OpenAPI change, a model change, or a manual edit.

- **FR-019**: The build step MUST emit a build-time warning whenever the classifier's included-actions list contains more than 20 entries. The warning MUST name each action over the threshold and MUST explain that Opus's tool-selection accuracy degrades as the tool list grows past this limit, so the Builder owner can decide whether to curate the included list down by editing `action-manifest.md`. There is no hard cap in v1; the warning does not block the build and does not move entries to the excluded list automatically.

- **FR-020**: The ingested OpenAPI document is a pinned snapshot. The pipeline MUST NOT re-fetch the source URL automatically on subsequent runs and MUST NOT detect or reconcile drift between the committed document and a remote source. Re-ingestion happens only when the Builder re-runs the ingestion step explicitly. Downstream steps (classification, render, build) always consume the committed document as the single source of truth; they never reach back to the original URL or file path at execution time.

- **FR-021**: The widget's action executor MUST apply a 15-second timeout to every host `fetch`. If the host has not responded within 15 seconds of the request being sent, the executor aborts the request and surfaces a timeout error state through the confirmation card. The timeout is a fixed v1 constant — it is not configurable via the catalog, via widget init options, via the host response, or via any runtime input. Consistent with FR-015a, no retry follows a timeout.

### Key Entities

- **Ingested OpenAPI document**: The host's API description, committed to the project's artefact directory as a first-class input. Attributes include the document's source (file path or URL captured at ingestion), the content hash used for determinism checks, and the version string. Relationships: every included action in `action-manifest.md` cites one operation in this document.

- **Action manifest**: A reviewable markdown artefact that lists every shopper-facing action the Builder intends to expose and every operation that was excluded. Attributes include an included list (with HTTP shape, description, input schema, confirmation flag, entity bindings, and source operation id per entry) and an excluded list (with HTTP shape, source operation id, and short reason per entry), plus the model-snapshot record used to produce the file.

- **Runtime tool descriptor**: The shape the backend presents to Opus for each included action. Attributes include name, human-readable description, input schema, and a flag that marks it as corresponding to a host action. Relationships: each descriptor is produced from one entry in the included list of `action-manifest.md`.

- **Action-executors catalog**: A declarative JSON artefact the widget loads at initialisation. Attributes include per-action entries with method, URL template, substitution mapping from `tool_use` arguments to URL/body fields, non-credential headers, credential mode (fixed to same-origin-cookies in v1), and response-handling directives. Relationships: each entry corresponds to one entry in the included list of `action-manifest.md` and one runtime tool descriptor.

- **Widget action-execution engine**: The fixed, audited interpreter inside the widget that reads the catalog and issues requests. Attributes are behavioural rather than structural: it never evaluates catalog fields as code, it never attaches a header the chat backend produced, it always surfaces success and error states through the confirmation card.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On a clean clone with the documented quickstart, a reviewer can add a product to their cart through the widget and observe the change on the host's own cart page in under 3 minutes, without opening developer tools and without following any step not listed in the quickstart.

- **SC-002**: 100% of committed host-action tool descriptors trace back to a real OpenAPI operation (operationId, path, method) in the ingested document. Any attempt to land a fabricated action in the manifest is rejected by the pipeline before generated artefacts are written.

- **SC-003**: 0% of observed chat-backend request logs, across all demo test runs, contain a shopper session cookie, bearer token, or other identifying authentication material. The chat backend's access to shopper credentials is structurally impossible, not merely unused.

- **SC-004**: Re-running the build step on unchanged inputs produces a byte-identical backend tool-catalog source file and a byte-identical `action-executors` artefact. The build manifest records the step as unchanged. This holds across different machines with the same inputs and the same model snapshot.

- **SC-005**: When the host publishes no OpenAPI document or classification yields zero included actions, the build completes successfully, the warning is emitted, and the resulting widget loads and replies to chat without raising a client-side error. Failure mode is graceful; Builder action is clearly signposted.

- **SC-006**: The widget's action-execution engine is a single code path with zero uses of dynamic code execution (no `eval`, no `new Function`, no dynamic `import` of catalog-referenced code), and every host-response string projected into the confirmation card is HTML-escaped at render time. Both invariants are verifiable by static inspection of the committed widget source and by an automated test that injects a response body containing `<script>` and HTML markup and asserts that the rendered DOM contains the literal characters rather than executed or interpreted markup.

- **SC-007**: Every included action in `action-manifest.md` defaults to `confirmation_required: true`, and every success or error outcome renders through the confirmation card with a distinct visual state. No action is executed on the host without an explicit shopper confirmation, measured across every action round-trip in the demo.

- **SC-008**: Builder owner edits to `action-manifest.md` (removing an action, promoting an excluded one, flipping confirmation) are preserved across pipeline re-runs with no manual reconciliation step, measured by re-running the full pipeline after each edit.

---

## Assumptions

- The Builder provides the OpenAPI document explicitly (file path or URL). Discovery from the host (probing `/swagger.json`, following `.well-known` pointers) is out of scope for v1.

- Swagger 2.0 is out of scope for v1. Only OpenAPI 3.0.x documents are accepted. A host on Swagger 2.0 must convert to OpenAPI 3.0 out-of-band before running the Builder.

- The authentication model for shopper actions is same-origin cookies on the host domain. OAuth 2.0 flows where the widget would need to mint a token, bearer tokens issued by the chat backend, and any other non-cookie scheme are out of scope for v1. Actions declared under non-cookie security schemes are excluded by default.

- Response bodies from the host are synchronous JSON. Streaming responses (SSE, chunked), multi-part responses, and binary payloads are out of scope for v1.

- Each action round-trip is atomic and independent. Bulk actions (a single request that mutates multiple resources atomically) and action chaining (a single shopper utterance that triggers a sequence of actions linked server-side) are out of scope for v1; each `ActionIntent` stands alone.

- The shopper interacts with the widget in natural language. Opus, given the runtime tool list built from the included actions, selects the appropriate tool in response to the shopper's message. The widget does not render a visible menu of available actions to the shopper. Tool-list size therefore affects Opus's tool-selection accuracy rather than the shopper's screen real estate or decision load.

- The widget is embedded on the same origin as the host's API, so `credentials: 'include'` attaches the shopper's cookies. A cross-origin deployment is detected at build time and flagged; supporting it would require a CORS-aware catalog extension that is out of scope for v1.

- The shared tool-use contract from Feature 003 (chat-endpoint §5) defines the `ActionIntent` shape and the confirmation-card flow. This feature populates that contract rather than redefining it. The Feature 003 contract is authoritative; when the two conflict, Feature 003 wins and this feature updates to match.

- Auto-generated integration tests that execute live calls against the host API are out of scope for v1. Contract tests use fixtures; live-host validation is manual reviewer walkthrough.

- The canonical demo host (Medusa) and its `/store/*` OpenAPI surface are the concrete instance of this feature's end-to-end proof. Support for hosts whose OpenAPI breaks the assumptions above is out of scope; they can land in later features.

- The constitution's red-line principles are binding. Principle I (User Data Sovereignty) forbids shopper credentials in the chat backend and is enforced structurally by the same-origin cookie model. Principle V (Anchored Generation) forbids actions whose source is not a real OpenAPI operation. Principle VIII (Reproducibility) requires byte-identical generated artefacts across machines for identical inputs. Any plan for this feature that appears to trade one of these principles for convenience is wrong.

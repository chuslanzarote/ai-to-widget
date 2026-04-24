# Feature Specification: ATW Hardening

**Feature Branch**: `008-atw-hardening`
**Created**: 2026-04-24
**Status**: Draft
**Input**: User description: `@FEATURE-008-atw-hardening.md` — close all remaining gaps between the `/atw.*` setup flow, the generated runtime, and the widget so that a fresh `/atw.init … /atw.embed` sequence against a clean host reaches a working tool loop without hand-editing artifacts, without undocumented conventions, and without silent failures. Scope was surfaced by the Feature 007 demo run against the coffee reference shop on 2026-04-24.

## Clarifications

### Session 2026-04-24

- Q: Where does the explicit configuration signal that unlocks bearer-JWT for shopper-facing widgets live — a single project-level flag, a per-operation flag, or both? → A: Single project-level flag in `project.md` (e.g. `deploymentType: customer-facing-widget`). Per-operation gating can be layered later without schema change.
- Q: Is the widget's thinking indicator shown immediately on request send, only after a delay, or only after 1 s? → A: Immediate — appears the moment the request is sent and is removed as soon as the first streamed delta or final response arrives.
- Q: When an authed tool is missing a credential source, what does the system do — build halt, warning-with-fallback, or halt with actionable diagnostic? → A: Halt during cross-validation with an actionable diagnostic that lists the affected operations and the exact OpenAPI patch required (e.g. add `security: [{ bearerAuth: [] }]`).
- Q: If the re-invoked model call fails (timeout / provider error / rate-limit) after the host write action already succeeded, what does the shopper see? → A: Backend retries the model call 1–2 times with backoff; on continued failure, the widget renders a hardcoded confirmation-fallback ("Action completed successfully. (Response generation failed — please refresh.)") so the shopper knows the action succeeded, rather than a generic "something went wrong" that implies the write failed.
- Q: When `/atw.init` is re-run against an existing `project.md`, is the "offer previous values as defaults" behavior in scope, a soft abort, or deferred? → A: In scope — `/atw.init` reads existing values and presents them as pre-filled defaults for every prompt so the Builder can keep them by pressing Enter. Applies to storefront origin, welcome message, and `deploymentType` fields.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fresh setup produces a clean, halt-free run (Priority: P1)

A Builder runs the `/atw.*` slash commands from scratch against a previously-unprepared host. Each stage completes without schema-validation errors, argument-shape errors, silent zero-parse outcomes, or over-eager exclusions. When a stage needs an input the Builder has not produced yet (for example, a database dump), the flow walks them through producing it instead of halting with a one-liner.

**Why this priority**: this is the foundational journey. Until the setup flow can reach completion on a fresh host without hand-editing intermediate artifacts, every downstream story is blocked. Every gap in this slice was hit by a real Builder in the Feature 007 demo.

**Independent Test**: from a clean checkout of the reference shop, run `/atw.init` through `/atw.build` end-to-end with no manual file edits between stages. The run completes to a `dist/widget.{js,css}` bundle with no schema errors, no "unexpected argument" errors, no silent zero-entity parses, and no over-exclusion of shopper-facing endpoints.

**Acceptance Scenarios**:

1. **Given** a fresh project directory and an OpenAPI spec that uses bearer-JWT auth for shopper-owned endpoints, **When** the Builder runs `/atw.classify`, **Then** shopper-scoped operations are accepted into the widget tool catalog rather than excluded as `non-cookie-security`.
2. **Given** a freshly-initialised `project.md` with ISO timestamps, **When** any downstream stage parses it, **Then** schema validation accepts the timestamps without error.
3. **Given** a `schema-map.md` hand-authored from the documented sample, **When** the parser reads it, **Then** entities are extracted (never silently zero) and a mismatched-heading-convention file fails loudly with a diagnostic.
4. **Given** `atw-api` has just written its hash index, **When** `atw-hash-inputs` validates it, **Then** the schema shapes match and the validator succeeds.
5. **Given** the skill documentation for `/atw.plan` instructs `--inputs a.md b.md c.md`, **When** the Builder runs the exact documented invocation, **Then** the CLI accepts it.
6. **Given** an action manifest group whose endpoints legitimately target per-shopper tables excluded from indexing, **When** the validator runs, **Then** the group is accepted (via an explicit "runtime-only" classification signal) rather than failing on `action-references-excluded-entity`.
7. **Given** a classifier tag name in plural form and a schema-map entity name in singular form referring to the same entity, **When** cross-validation runs, **Then** normalization tolerates singular/plural and the names match.
8. **Given** an OpenAPI operation that declares bearer security, **When** the catalog is rendered, **Then** every authed tool ships with a populated `credentialSource` so the widget attaches `Authorization` at call time.
9. **Given** `/atw.build` halts because `.atw/inputs/<name>.sql` is missing, **When** the Builder first reaches that stage, **Then** an earlier stage has already walked them through the exact `pg_dump` invocation and saved it for them.

---

### User Story 2 - Write-action tool loop works end-to-end (Priority: P1)

An end shopper asks the widget to take a write action against the host (e.g. "add an espresso to my cart"). The widget presents a confirmation, the shopper approves, the action executes against the host API with the shopper's credentials, and the assistant replies in natural language referencing what happened. Neither the first nor the tenth write action fails with "Something went wrong on our side."

**Why this priority**: write actions are the defining capability of the widget. A silent failure on the first such interaction destroys shopper trust and makes the whole feature appear broken. The failure mode observed in Feature 007's demo was a contract drift between the documented chat-endpoint request shape and the request the widget actually sends, causing the model provider to reject the follow-up turn.

**Independent Test**: against a running reference shop with CORS correctly configured, an end shopper performs a write action through the widget. The action executes, the HTTP response indicates success, and the assistant produces a natural-language reply that references the action's outcome. A browser console trace shows no provider-side rejection of the follow-up turn.

**Acceptance Scenarios**:

1. **Given** a widget-initiated write action that succeeds against the host, **When** the widget forwards the tool result to the chat backend, **Then** the backend reconstructs a valid provider message sequence from the widget's payload (without needing server-side session state) and the provider accepts the follow-up turn.
2. **Given** a successful write action, **When** the follow-up turn completes, **Then** the assistant's reply is model-generated prose referencing the outcome (not a templated "action succeeded" blob).
3. **Given** the browser-executed shop API call, **When** the browser sends its preflight `OPTIONS` with the `Authorization` header, **Then** the host responds with CORS headers that permit the storefront origin and the `Authorization` header.
4. **Given** the documented request-shape contract for the chat endpoint, **When** compared to the request the widget actually sends, **Then** the two match (the contract is rewritten to match the code, not vice versa).

---

### User Story 3 - Host contract is captured upfront and the embed just works (Priority: P2)

Before a single line of code is generated, the `/atw.init` flow asks the Builder where the widget will be hosted and what storefront origins it will run on. The `/atw.api` stage produces an explicit host-requirements artifact enumerating every contract the host must satisfy. When the Builder runs `/atw.embed`, the output is a complete, copy-pasteable integration package: the right script tag attributes, the right allow-list of tools, the right files to copy, and the right host-side configuration checklist. No hand-patching of any generated artifact is required for a fresh integration to work.

**Why this priority**: the "cross-origin" warnings, the `data-bearer-storage-key` / `data-auth-token-key` mismatch, the missing `data-allowed-tools`, and the missing copy instruction for `action-executors.json` are the class of papercuts that turn "ATW generated my widget" into "ATW generated my widget and I then hand-edited four files." Fixing them removes a major category of post-setup Builder support load.

**Independent Test**: a Builder who has never integrated this widget before follows only the output of `/atw.embed`, copies exactly the files listed in the emitted checklist to the host's public assets, pastes exactly the script tag into the host HTML, applies the host requirements as listed in the emitted host-requirements artifact, and loads the storefront. The widget launcher appears, a conversation starts, and a tool call executes without console errors or silent disables.

**Acceptance Scenarios**:

1. **Given** a Builder starting `/atw.init`, **When** they reach the setup questions, **Then** they are asked for the storefront origin(s) the widget will run on and the answer is persisted in project config.
2. **Given** `/atw.api` has completed, **When** the Builder inspects the artifacts directory, **Then** a `host-requirements.md` file enumerates the CORS origins, allowed preflight headers and verbs, the bearer-token localStorage key, the login-redirect URL, and any tool-specific host prerequisites.
3. **Given** `/atw.embed` has run, **When** the Builder inspects the emitted snippet, **Then** the script tag uses `data-auth-token-key` (matching the widget config field) and includes a `data-allowed-tools` attribute derived from the action catalog.
4. **Given** the emitted embed output, **When** the Builder reads it, **Then** a visible checklist enumerates every file that must be copied to the host's public assets, including the action executors catalog — not only the widget bundle and CSS.
5. **Given** `/atw.build` has just finished, **When** the Builder sees the DONE banner, **Then** the banner includes a Next Steps section that tells them to run `/atw.embed`, what files to copy, and where to paste the snippet.
6. **Given** the reference shop repository, **When** it is cloned and started fresh, **Then** its server already ships with CORS middleware configured for the documented default storefront origin (no in-session patch required).

---

### User Story 4 - Failures become loud instead of silent (Priority: P2)

Every failure mode the Feature 007 demo surfaced as a silent one — a tool not in the allow-list, a missing action-executors catalog, a missing credential source on an authed tool, a schema-validation rejection, a zero-entity parse, a missing required config file — now produces an immediately-actionable diagnostic. The Builder or end shopper sees the real reason for the failure at the point of failure, not three layers downstream as a generic "something went wrong".

**Why this priority**: silent failures force trial-and-error debugging against Claude and turn ATW into an expert-only tool. Loud failures let a Builder self-serve. None of the changes here require new features — just replacing `console.warn` / silent no-op paths with visible diagnostics, and replacing one-line halts with diagnostics that tell the Builder exactly what to do next.

**Independent Test**: intentionally misconfigure each known failure mode one at a time (e.g. strip `data-allowed-tools` from the embed, omit `action-executors.json` from the host's public assets, delete the SQL dump). In each case, the Builder sees a diagnostic that identifies the failure and states the corrective action, without having to open developer tools or read source code.

**Acceptance Scenarios**:

1. **Given** the backend has emitted a tool-use intent, **When** the widget's allow-list does not contain that tool, **Then** a visible in-widget error surfaces the rejection (not a silent synthetic `is_error` that derails the next turn).
2. **Given** an action intent is emitted, **When** the widget's action-executors catalog is unreachable or empty, **Then** the widget surfaces a visible error attributing the failure to the missing catalog (not only a `console.warn`).
3. **Given** `/atw.build` cannot proceed because the SQL dump is missing, **When** it halts, **Then** the diagnostic includes the exact `pg_dump` command the Builder should run (or the flow has already captured it earlier — see Story 1).
4. **Given** a post-setup Builder asks "why doesn't my widget work?", **When** Claude is asked to diagnose, **Then** the `host-requirements.md` artifact is the first thing compared against the real host (each requirement checked in turn).
5. **Given** a schema-map parse, **When** zero entities are extracted, **Then** the parser emits a loud error pointing at the heading-level convention, not a silent success.

---

### User Story 5 - Widget UX is polished for end shoppers (Priority: P3)

End shoppers experience the widget as a finished product. While the assistant is thinking, the widget shows activity. The assistant's first message greets them with a Builder-configured, brand-appropriate line rather than a generic default. Pending-action confirmation cards describe what they are about to do in plain language, not raw parameter dumps. Link-shaped outputs that would break the widget's in-page state are not surfaced until a proper client-routing integration exists.

**Why this priority**: none of these are blockers for the tool loop, but each one surfaced as an unpleasant moment while operating the widget manually on 2026-04-24. Without them the widget reads as a prototype rather than a shippable component.

**Independent Test**: load the widget on the reference shop, initiate a conversation that includes at least one write action. Observe: (a) a thinking indicator during any reply longer than ~1 second; (b) a welcome message configured in `/atw.init`; (c) a confirmation card that reads as a sentence ("Add 1× Espresso to your cart") rather than raw JSON; (d) no navigation-pill links that, when clicked, destroy the conversation.

**Acceptance Scenarios**:

1. **Given** the Builder is running `/atw.init`, **When** they are prompted, **Then** they can set a welcome message (with a sane default) that is later surfaced by the widget on first render.
2. **Given** a reply takes longer than a second, **When** the shopper is waiting, **Then** a thinking/typing indicator is visible in the transcript and disappears the moment the first streamed delta or final response arrives.
3. **Given** the action catalog defines a human-readable template for an action, **When** the widget renders the pending-action confirmation card, **Then** the card shows a sentence derived from the template; raw parameter view is only used as a fallback when no template is available.
4. **Given** the widget renders an assistant reply containing links of the navigation-pill shape, **When** the reply is surfaced to the shopper, **Then** those links are not rendered as clickable pills (they remain in markdown only).

---

### Edge Cases

- The same host requirement conflicts with a host-specific default (e.g., the host already ships CORS but for a different origin). The host-requirements artifact must treat each requirement as a checklist item to verify, not a configuration to overwrite.
- The Builder re-runs `/atw.init` after project config already exists. Covered by FR-005a: `/atw.init` pre-fills every prompt with the previously-captured value so the Builder keeps it by pressing Enter.
- A Builder's OpenAPI uses a non-JWT bearer format (opaque token). The classifier exception for shopper-bearer auth must be scoped to operations that are legitimately shopper-owned, not a blanket allow-list.
- The widget tool loop succeeds against one host but is then copied to a different host with a different CORS policy. The host-requirements artifact is the canonical reference point for diagnosis — it must list each requirement so the Builder can re-verify without guessing.
- An `action-executors.json` contains tools not in the embed's `data-allowed-tools`, or vice versa. The generator must keep the two in lockstep at emission time so drift is impossible.
- A tool call produces an error response from the host (not a network failure). The assistant's follow-up turn must still produce a natural-language reply describing the failure — not a generic "something went wrong" and not a templated error blob.
- The host write action succeeds but the re-invoked model call fails on all retries (covered by FR-020a). The shopper must see a confirmation-fallback that makes clear the action succeeded; the widget must not imply the write failed.

## Requirements *(mandatory)*

### Functional Requirements

**Setup flow — upfront capture (Theme A)**

- **FR-001**: The setup flow MUST interactively capture the storefront origin(s) the widget will run on during `/atw.init` and persist them in project configuration. Downstream render-backend generation MUST consume this value so the generated backend's allowed-origins list and widget/host URL defaults match without manual editing.
- **FR-002**: The setup flow MUST interactively capture a Builder-configurable welcome message during `/atw.init` (with a sensible default) and persist it in project configuration. The generated widget MUST render this message in place of any hard-coded greeting.
- **FR-003**: The `/atw.api` stage MUST emit a `host-requirements.md` artifact that enumerates every contract the host must satisfy for the generated widget to function. The artifact MUST at minimum list: the CORS origin(s), the preflight `Authorization` header and verb allow-list, the bearer-token localStorage key (see FR-013), the login-redirect URL, and any tool-specific prerequisites surfaced from the action catalog. The Builder MUST be shown a short in-flow summary of this file at the point it is emitted.
- **FR-004**: The setup flow MUST guide the Builder to produce the required SQL dump before they reach the stage that needs it — either by prompting during `/atw.schema` or `/atw.plan` and capturing the exact `pg_dump` command, or (failing that) by ensuring any "dump missing" halt includes the exact `pg_dump` invocation derived from the Builder's connection info.
- **FR-005**: The `/atw.build` DONE banner MUST include an explicit Next Steps section that tells the Builder to run `/atw.embed`, what files to copy to the host's public assets, and where to paste the snippet.
- **FR-005a**: When `/atw.init` is invoked against a project directory whose `project.md` already exists, it MUST read the previously-captured values for every field it prompts for (including storefront origin, welcome message, and `deploymentType`), present those values as pre-filled defaults at each prompt, and accept the previous value when the Builder confirms without change. Previously-captured values MUST NOT be silently overwritten.

**Setup flow — correctness (Theme B)**

- **FR-006**: The hash-index artifact written by `/atw.api` MUST use a schema shape that the `atw-hash-inputs` validator accepts without error. A regression check MUST exist to prevent drift between writer and validator.
- **FR-007**: The `atw-hash-inputs` CLI argument shape MUST match the form documented in the skill (e.g. accepting whitespace-separated positional arguments after `--inputs`).
- **FR-008**: Any stage that writes YAML frontmatter (including `/atw.init`) MUST emit ISO timestamps as quoted strings so downstream schema validation accepts them.
- **FR-009**: The `schema-map.md` parser and the sample/documentation MUST agree on a single heading-level convention. If a file produces zero parsed entities, the parser MUST fail loudly with a diagnostic naming the convention mismatch.
- **FR-010**: The classifier MUST NOT reject bearer-JWT shopper-facing operations as `non-cookie-security`. The allowance MUST be gated by a single project-level configuration flag in `project.md` (working name `deploymentType: customer-facing-widget`) captured during `/atw.init`. When this flag is set, all shopper-scoped operations in the OpenAPI document are eligible for bearer-JWT acceptance without further per-operation annotation. When this flag is unset, the classifier's original bearer-JWT rejection rule applies unchanged.
- **FR-011**: Cross-artifact name matching (e.g., classifier tag names vs schema-map entity names) MUST tolerate singular/plural variants.
- **FR-012**: The `action-references-excluded-entity` validation rule MUST accept tool groups explicitly classified as runtime-only (i.e. those that legitimately target entities that are not indexed by the safe-read backend).
- **FR-013**: The OpenAPI cross-validation stage MUST copy each operation's `security` list from the OpenAPI document into the catalog entry. The renderer MUST use that list to populate each authed tool's credential-source block. When cross-validation detects one or more authed tools that would ship without a credential source, the stage MUST halt with an actionable diagnostic that (a) lists every affected operation by HTTP verb, path, and tool name, and (b) states the exact OpenAPI patch required to fix each one (e.g. "add `security: [{ bearerAuth: [] }]` to this operation, or set a global `security` field"). A warning-with-fallback path is explicitly rejected. The widget MUST NOT be reachable with an authed tool lacking a credential source.

**Embed outputs (Theme C)**

- **FR-014**: The `/atw.embed` output MUST use the attribute name that the widget actually reads for the bearer-token localStorage key (a single canonical name — currently `data-auth-token-key` — used consistently across the embed template, widget config, and host-requirements artifact).
- **FR-015**: The `/atw.embed` output MUST emit a `data-allowed-tools` attribute whose value is derived from the generated action executors catalog (one entry per tool). A tool missing from this attribute MUST NOT reach the widget as a silent rejection.
- **FR-016**: The `/atw.embed` output MUST instruct the Builder to copy the action executors catalog alongside the widget bundle and CSS into the host's public assets. The instruction MUST be rendered as an explicit visible checklist, not prose only.
- **FR-017**: The `/atw.embed` output MUST include a short, visible files-to-copy checklist and the exact snippet to paste in the host HTML.

**Runtime (Theme D)**

- **FR-018**: The chat-endpoint request contract and the widget's actual request MUST match. The contract specification MUST be rewritten so the documented request shape is the one the code sends. The widget is not required to carry a typed assistant turn for tool use.
- **FR-019**: When the widget sends a tool result, the payload MUST include enough information for the backend to reconstruct the corresponding provider message sequence without server-side session state. At minimum this includes the tool name, the tool input (arguments actually executed against the host), the tool-use identifier, and the tool result content (or error flag).
- **FR-020**: The backend MUST own the provider-message-shape assembly: on receipt of a tool-result payload it reconstructs the `[user, assistant:tool_use, user:tool_result]` sequence, re-invokes the model, and streams the natural-language reply back to the widget. Templated post-action replies are explicitly rejected.
- **FR-020a**: If the re-invoked model call fails (network error, timeout, provider rejection, rate-limit) *after* the host write action has already succeeded, the backend MUST retry the model call up to 2 additional times with exponential backoff. If all retries fail, the backend MUST signal a "response-generation-failed-but-action-succeeded" state to the widget, and the widget MUST render a fixed confirmation-fallback message making clear that the action succeeded even though the natural-language reply could not be produced. The widget MUST NOT surface this case as a generic failure (no "Something went wrong on our side"), because doing so would imply the write failed when it did not.
- **FR-021**: The reference shop MUST ship with CORS middleware configured to permit the documented default storefront origin and to allow the `Authorization` header on preflight — permanently, in the repository, not as an in-session patch.

**Loud failures (cross-cutting)**

- **FR-022**: When the widget rejects a tool call because it is not in the allow-list, the rejection MUST surface as a visible in-widget error, not only as a synthetic error content block that propagates to the next turn.
- **FR-023**: When the backend emits an action intent while the widget's action-executors catalog is unavailable or reports no capability, a visible in-widget error MUST attribute the failure to the missing catalog (not only `console.warn`).

**Widget UX (Theme E)**

- **FR-024**: The widget MUST render a thinking/typing indicator in the transcript the moment a chat request is sent (no delay threshold) and MUST remove it the moment the first streamed delta or final response arrives. SC-009's 1-second mark is an observable guarantee, not a delay threshold — for sub-second responses the indicator is still shown and then immediately removed.
- **FR-025**: The widget MUST read the welcome message from its configuration (populated per FR-002) and MUST NOT ship a hard-coded greeting when a configured value is present. A sane default applies when unset.
- **FR-026**: The pending-action confirmation card MUST render a human-readable summary derived from the action catalog's description/summary template. The raw parameter view MUST only be used as a fallback when no template is available.
- **FR-027**: The widget MUST NOT render navigation-shape links as clickable pills until a proper client-routing integration is designed. The underlying markdown representation may remain.

### Key Entities *(include if feature involves data)*

- **Project config (`project.md`)**: source of truth for Builder-provided setup answers. Gains three new fields in this feature: storefront origin(s), welcome message, and the project-level `deploymentType` flag (working value `customer-facing-widget`) that unlocks bearer-JWT acceptance for shopper-scoped operations (FR-010).
- **Host-requirements artifact (`host-requirements.md`)**: new artifact emitted by `/atw.api`. Enumerates every contract the host must satisfy for the generated widget to function. Serves both as Builder-facing guidance and as the canonical checklist Claude uses when diagnosing post-setup failures.
- **Action executors catalog (`action-executors.json`)**: existing artifact. Must be copied to the host's public assets; its entries drive the `data-allowed-tools` allow-list; its credential-source entries drive the widget's `Authorization` attachment.
- **Embed snippet / embed-guide**: emitted by `/atw.embed`. Must be internally consistent (attribute names match widget config) and externally actionable (visible checklist of files to copy, exact script tag to paste).
- **Chat-endpoint tool-result payload**: the widget-to-backend message carrying tool outcomes. Gains tool name and tool input alongside existing tool-use identifier and content, so the backend can reconstruct the provider message sequence without server-side session state.
- **Action catalog entry**: each entry gains (from OpenAPI backfill) a populated security/credential-source field, and (optionally) a human-readable summary/description template used by the widget's confirmation card.
- **Tool group classification flag**: action-manifest tool groups gain an explicit runtime-only marker so the validator can permit references to entities absent from the indexed schema-map.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A Builder can run `/atw.init` through `/atw.embed` on a fresh reference-shop checkout and reach a working widget (launcher visible, conversation starts, at least one write action executes successfully) with zero hand-edits of generated artifacts.
- **SC-002**: The Feature 007 demo failure signature — "unexpected tool_use_id found in tool_result blocks" on the first write action — does not reproduce on a fresh run. 100% of write-action first attempts complete with a model-generated natural-language follow-up, assuming the underlying host call itself succeeds.
- **SC-003**: The number of cross-origin warnings printed during a fresh `/atw.build` RENDER step on a correctly-configured project drops from the 8 observed in the 2026-04-24 demo to 0.
- **SC-004**: Every failure mode enumerated in Theme B and in the "loud failures" requirements produces a diagnostic that names the root cause at the point of failure. A Builder encountering each failure mode in turn can identify the corrective action from the diagnostic alone — without opening developer tools or reading source code.
- **SC-005**: The `/atw.embed` output is complete: following only its instructions (files-to-copy checklist, host-requirements checklist, pasted snippet), a Builder who has never integrated this widget before achieves a working integration on the first attempt.
- **SC-006**: The chat-endpoint request-shape contract documented in `specs/007-widget-tool-loop/contracts/` matches, byte-for-byte on the documented fields, the request shape the widget actually sends.
- **SC-007**: The reference shop repository, cloned fresh and started with default configuration, serves correct CORS headers (allowed origin + allowed `Authorization` header) without any in-session code change.
- **SC-008**: An end shopper using the widget on the reference shop never sees a raw JSON parameter dump on a pending-action confirmation card when the action catalog provides a summary template for that action.
- **SC-009**: An end shopper waiting more than 1 second for a reply sees a thinking indicator 100% of the time; the indicator disappears within one render frame of the first streamed delta or final response arriving.

## Assumptions

- The Builder persona is the Feature 007 persona: a developer integrating ATW into a storefront, comfortable with slash commands and copying files, not expected to read generated TypeScript or patch intermediate artifacts.
- The end-shopper persona is a non-technical customer of the Builder's store.
- The reference shop at `demo/shop` remains the canonical integration testbed for this feature. Per existing memory, it is a throwaway testbed and is kept minimal.
- `ConversationTurn.content` remains string-only. The D1 fix uses the backend-reconstruction approach (Approach A in the source feature document), deliberately avoiding a broader migration of the turn-content shape.
- The "runtime-only" classification flag on action-manifest tool groups is a new field; its introduction is in-scope for this feature.
- Client-routing integration for navigation-pill-shaped links is out of scope; navigation pills are removed until that integration is designed.
- All numeric cross-references to gaps `#1`–`#16` in the source feature document map to the memory entry `project_atw_skill_gaps_f007.md`; this feature closes all of them.
- "Fresh run" in the success criteria means: no artifacts carried over from a prior `/atw.*` session, but with the Builder's OpenAPI spec, SQL dump, and host connection info available in the same form as the Feature 007 demo.

# Feature Specification: Runtime — Chat Backend, Embedded Widget, and Aurelia Demo

**Feature Branch**: `003-runtime`
**Created**: 2026-04-22
**Status**: Draft
**Input**: User description: "003-runtime.md — the runtime surface of AI to Widget: Fastify backend at `/v1/chat`, embedded widget in the host app, `/atw.embed` integration command, and the full Aurelia Medusa demo. This is the feature the demo video shows live."

## User Scenarios & Testing *(mandatory)*

> Feature 003 delivers the surface an end user sees: the backend that answers questions
> against the indexed catalog, the widget embedded in the host storefront, the slash
> command that guides integration, and the Aurelia Medusa demo environment that proves
> the full loop works. Priorities are ordered so a P1-only build is still a credible
> live demo; each P2/P3 story extends trust and breadth without blocking the headline.

### User Story 1 — Grounded answer from the catalog (Priority: P1) 🎯 MVP

A shopper opens the storefront, clicks the chat launcher, types a flavour-profile
question in natural language (e.g., "cafés chocolatosos para filtro"), and receives
a reply that cites two or three real products that actually exist in the catalog,
with the real tasting notes and origin that were indexed at build time. No invented
products. No generic copy.

**Why this priority**: Without grounded answers, the demo is a toy chatbot.
Grounded answers are the point — they are what Principle V (Anchored Generation)
exists to guarantee and what the hackathon video's first wow moment depends on.
Everything else is scaffolding around this story.

**Independent Test**: Start the full stack against the Aurelia demo. Open the
storefront, open the widget, ask a flavour-profile question. Verify the answer
mentions products that exist in the seeded catalog, with notes that match the
indexed metadata, and that the response is returned in under 4 seconds.

**Acceptance Scenarios**:

1. **Given** the Aurelia stack is running with a seeded catalog and populated
   index, **When** a shopper asks a catalog question, **Then** the widget returns
   an answer that mentions only products present in the catalog, each with at
   least one fact whose source is the indexed entity data.
2. **Given** no catalog entity matches the query above the similarity threshold,
   **When** the shopper asks the question, **Then** the agent replies politely
   that the catalog does not cover that topic rather than fabricating a product.
3. **Given** the shopper clicks a cited product name in the reply, **When** the
   link is followed, **Then** the browser navigates to the product's real
   storefront URL.

---

### User Story 2 — Action with confirmation (Priority: P1)

Mid-conversation the shopper asks the agent to do something that changes state
in the host app ("add two of the Colombia Huila to my cart"). The agent replies
with a confirmation card that summarises the requested action in plain language
(product name, quantity, price, total). Nothing changes in the host app until
the shopper clicks the primary action button on the card. Cancelling dismisses
the card; confirming executes the action using the shopper's own session
credentials against the host's API. The agent then acknowledges success in the
next assistant turn.

**Why this priority**: The confirmation-gated action is the second wow moment of
the demo and the structural proof of Principle IV (Human-in-the-Loop). Without
it, the runtime is read-only. With it, the runtime crosses from "chatbot" to
"assistant that actually does things" — the narrative hinge of the video.

**Independent Test**: Continue the Story 1 conversation. Ask to add one of the
recommended products to the cart. Verify that (a) a confirmation card with
product, quantity, and price is rendered inline in the widget, (b) the host
cart does not change until the primary button is clicked, (c) after the click
the host cart reflects the new item and the agent acknowledges success.

**Acceptance Scenarios**:

1. **Given** the agent has proposed an action, **When** no interactive click has
   been made on the confirmation card, **Then** no state-changing HTTP call has
   been issued to the host API.
2. **Given** the shopper clicks the primary button on a confirmation card,
   **When** the host API responds with success, **Then** the widget shows a
   success state and the host's UI (e.g., cart icon count) reflects the change.
3. **Given** the shopper clicks cancel, **When** they send the next message,
   **Then** the agent understands the prior action was not taken and behaves
   accordingly (offers alternatives, confirms the cancellation, etc.).

---

### User Story 3 — Multi-turn memory within a session (Priority: P1)

The shopper asks about a specific product, then sends a follow-up that uses a
pronoun or an implicit reference ("what's the price?", "show me the bigger
one"). The agent answers as if it remembers the prior turn. No separate log-in
or account is required for this memory; it lives for the duration of the open
widget session.

**Why this priority**: Single-turn chatbots feel broken. The entire demo video
is a multi-turn interaction; if turn two is not aware of turn one, the
narrative collapses. Implementation is straightforward (the widget forwards
the running history), but the behaviour is user-visible and critical.

**Independent Test**: In the open widget, ask about a product, then send a
pronoun-bearing follow-up. Verify that the second reply resolves the pronoun
to the same product without the shopper repeating its name.

**Acceptance Scenarios**:

1. **Given** a conversation with at least one prior assistant reply about a
   named entity, **When** the shopper sends a message containing only a pronoun
   or implicit reference to that entity, **Then** the next assistant reply
   resolves the reference to the same entity.
2. **Given** a conversation exceeds the session turn cap, **When** a new
   message is sent, **Then** the oldest turns are dropped and the agent is
   told (via its context) that the conversation was trimmed, without crashing
   or losing coherence on the remaining history.

---

### User Story 4 — Reproducible demo from a fresh clone (Priority: P1)

A hackathon judge clones the repository on a clean machine with Docker, runs
one start command, waits a few minutes for services to boot, and sees the
Aurelia storefront with the working widget at a local URL. Asking a catalog
question returns a grounded answer. Adding something to the cart works.

**Why this priority**: If the judge can't reproduce the demo, the rest of the
project does not exist to them. This is Principle VIII (Reproducibility)
applied to the runtime.

**Independent Test**: On a fresh machine with Docker installed and an API key
available, clone the repository, run the documented start command, open the
storefront URL in a browser within three minutes, send a first message, and
receive a grounded response.

**Acceptance Scenarios**:

1. **Given** a fresh clone on a machine with Docker and an API key available,
   **When** the documented start command is run, **Then** the Aurelia storefront
   and the widget are both reachable in under three minutes.
2. **Given** the demo environment is up, **When** a first-time visitor asks a
   catalog question in the widget, **Then** they receive a grounded reply
   without any manual data-loading or configuration steps.

---

### User Story 5 — Comparison across catalog entities (Priority: P2)

The shopper asks the agent to compare two named products on a specific axis
("Colombia Huila vs Ethiopia Guji — which for V60?"). The agent retrieves both
entities from the catalog and replies with a side-by-side comparison that
cites facts about each.

**Why this priority**: Comparison is the single richest demonstration that
retrieval actually works — pulling two distinct entities and synthesising a
grounded reply over both is harder than answering about one. It strengthens
the demo's credibility but is not blocking: Story 1 already proves grounding
on a single entity.

**Independent Test**: Ask a "A vs B" question where A and B are both named
products in the catalog. Verify the reply references both by name with at
least one grounded fact per product.

**Acceptance Scenarios**:

1. **Given** two catalog entities are named in the message, **When** the agent
   replies, **Then** the reply references both entities with facts drawn from
   the indexed data and links back to each entity's storefront page.

---

### User Story 6 — Authentication inheritance (Priority: P2)

A shopper who is already logged into the host storefront does not have to log
in to the agent separately. They ask "what did I order last time?" and the
agent returns a summary built from their real order history.

**Why this priority**: This is the visible payoff of Principle I (User Data
Sovereignty): the agent answers personalised questions without the runtime
backend ever seeing the shopper's credentials. It deepens the demo story but
is not required for Story 1 or Story 2.

**Independent Test**: Log into the Aurelia storefront. Open the widget. Ask
about your own order history. Verify the response is built from the logged-in
user's real orders and that no credentials ever left the browser except in
direct calls to the host API.

**Acceptance Scenarios**:

1. **Given** a shopper is logged into the host storefront, **When** they ask
   the agent a personalised question that requires host-API data, **Then** the
   agent returns a reply derived from their own data, fetched by the widget
   directly against the host API with the shopper's session.
2. **Given** the runtime backend logs a request for a personalised question,
   **When** the logs are inspected, **Then** no host-user credential (cookie,
   token, or equivalent) is present.

---

### User Story 7 — Graceful degradation for anonymous shoppers (Priority: P2)

An anonymous shopper asks the same personalised question ("what did I order
last time?"). The agent cannot answer from host data and replies with a
helpful message explaining that the shopper needs to log in first, and offers
to keep helping with catalog questions in the meantime.

**Why this priority**: Half the demo audience will be anonymous. A rude
failure here is a memorable negative. The fix is cheap but the value is high.

**Independent Test**: In a private browsing window with no session, open the
widget and ask a personalised question. Verify the reply is helpful and
includes a path forward (log in) rather than an error state.

**Acceptance Scenarios**:

1. **Given** no host-app session is present, **When** the agent attempts a
   personalised tool call via the widget, **Then** the host API responds with
   an unauthenticated error that the agent translates into a friendly
   "please log in first" reply.

---

### User Story 8 — Guided integration with `/atw.embed` (Priority: P2)

A Builder (not the Aurelia team) runs `/atw.embed` after Feature 002 to
integrate the widget into their own host application. The command asks them
what framework they use, where the backend will run, how their host
authenticates users, and optional theming preferences, and writes a tailored
integration guide with ready-to-paste snippets.

**Why this priority**: The product does not ship to the world as "only works
on Aurelia". The Builder's integration story must be documented, but it is
out of the demo video's critical path, which is why it's below the core
runtime stories.

**Independent Test**: On a project with a completed Feature 002, run
`/atw.embed`, answer the prompts for a given framework, and verify the
generated guide contains the correct script/link tags, CORS notes, theming
example, and troubleshooting section for that framework.

**Acceptance Scenarios**:

1. **Given** the Builder runs `/atw.embed` in a project where Feature 002
   has produced a widget bundle, **When** they answer the guided questions,
   **Then** a written integration guide is produced that a third developer
   could follow end-to-end to get the widget loading on their host.

---

### User Story 9 — Host-matching theming without rebuilds (Priority: P3)

The Builder sets a handful of theme variables in their host site's CSS
(primary colour, radius, font). The widget's appearance updates to match on
the next page load. No rebuild of the widget bundle is needed.

**Why this priority**: Visual fit with the host is a credibility signal but
not the headline. Theming is deferred behind functional correctness.

**Independent Test**: On a running demo, edit a theme variable on the host
page and reload. Verify the widget's primary colour (or radius, or font)
reflects the change without rebuilding the bundle.

**Acceptance Scenarios**:

1. **Given** the widget is loaded on a host page that defines theming
   variables, **When** those variables change, **Then** the next page load
   shows the widget using the new values, with no change to the widget's
   compiled bundle.

---

### User Story 10 — Runtime safety rails hold under hostile input (Priority: P3)

A security-aware reviewer tampers with the backend's response (via a
debugging proxy or browser dev tool) to add an action that references a
tool name not present in the published manifest. The widget refuses to
execute the action, surfaces an error, and the host app's state is
unchanged. Separately, rapid-fire requests to the backend from one session
are rate-limited rather than causing runaway cost.

**Why this priority**: These rails are the difference between a demo and a
product. They are not on the demo's happy path but must exist before any
real deployment. Low priority because they primarily defend against
conditions that will not appear in the filmed demo.

**Independent Test**: Use a dev tool to inject a fabricated action with an
unknown tool name into a real response and observe widget behaviour.
Separately, send more than the per-session request limit and verify the
backend rate-limits the excess.

**Acceptance Scenarios**:

1. **Given** a response containing an action whose tool name is not in the
   runtime tool list, **When** the widget processes that response, **Then**
   the action is refused, the failure is visible (logged + error state),
   and no host-API call is made.
2. **Given** a session that exceeds the per-session request cap on the
   chat endpoint, **When** the next request is sent, **Then** the backend
   responds with a rate-limit response carrying a retry-after hint.

---

### Edge Cases

- **Backend unreachable from widget** — Widget shows a friendly error state and
  offers a retry action. No silent failure.
- **Index database unreachable from backend** — Backend's health endpoint
  reports unhealthy; chat endpoint returns an unavailable response;
  orchestrator signals can restart the container.
- **Model provider outage or transient failure** — Backend returns a generic
  friendly error to the widget; the next message retries. The Builder's
  operational problem is logged structurally but never leaked to the shopper.
- **Host API returns unauthorised mid-action** — Widget shows a "please log in
  first" message with a link to the host's login page if the Builder
  configured one.
- **Agent emits a tool call for a name outside the manifest** — Backend logs
  a warning and asks the model to redo; persistent mismatch falls back to a
  text-only reply.
- **No retrieval hits above similarity threshold** — Agent replies "I don't
  see that in the catalog, tell me more" rather than fabricating content.
- **Prompt injection attempt ("ignore your instructions")** — System prompt
  includes anti-injection guidance; the tool-name allowlist structurally
  blocks injected actions. Not a hard guarantee; documented as a known limit
  in project docs.
- **Message body longer than the accepted limit (e.g., >4000 chars)** —
  Agent politely asks the shopper to shorten the message.
- **Conversation exceeds the turn cap** — Oldest turns are dropped; a
  short system note signals the trim to the model.
- **Required model-provider credential missing at backend startup** — Backend
  logs a clear startup error; chat endpoint returns an unavailable response
  citing backend configuration.
- **CORS misconfiguration on the Builder's host** — Widget surfaces the
  failure visibly; the `/atw.embed` output covers required CORS settings.
- **Rapid-fire requests from one session** — Rate limit fires with
  retry-after; widget surfaces the wait time to the shopper.

## Requirements *(mandatory)*

### Functional Requirements — Backend chat service

- **FR-001**: The system MUST expose a chat endpoint that accepts a user
  message, the current session history, and a session context object, and
  returns an assistant reply, the set of catalog entities that were cited,
  and a (possibly empty) list of confirmation-required action intents.
- **FR-002**: The system MUST validate incoming chat requests against a
  published schema and reject malformed requests with a clear, user-safe
  error and an appropriate client-error status.
- **FR-003**: The system MUST embed the incoming user message with the same
  embedding model used at build time so that retrieval at query time is
  comparable to the index.
- **FR-004**: The system MUST retrieve candidate catalog entities from the
  index using vector similarity, using a configurable similarity threshold
  and top-K limit (defaults: threshold 0.55, top-K 8).
- **FR-005**: The system MUST compose a model call that includes the system
  prompt derived from the Feature 001 artefacts, the current session
  history (bounded), the current user message, the retrieved entity
  context, and the tool list from the action manifest.
- **FR-006**: The system MUST cap the session history retained per request
  at a configurable maximum (default 20 turns) and MUST signal to the
  model when a conversation has been trimmed.
- **FR-007**: The system MUST execute safe-read tool calls server-side
  against the host API using a server-side API key (or no credentials when
  none is configured) and feed the results back to the model, looping up
  to a bounded number of tool-call turns (default 5).
- **FR-008**: The system MUST NOT execute any tool call flagged as
  state-changing (action tool). Those MUST be returned to the widget as
  action intents with resolved HTTP method, path, arguments, a
  human-readable description, and `confirmation_required: true`.
- **FR-009**: The system MUST NEVER forward end-user credentials (cookies,
  bearer tokens, custom auth headers) from the widget to any third party,
  including the model provider and the host API. End-user credentials MUST
  travel only between the widget and the host API.
- **FR-010**: The system MUST expose a liveness endpoint that returns
  healthy only when the catalog index is reachable, so orchestration
  systems can signal on real readiness.
- **FR-011**: The system MUST return differentiated errors: input
  validation failures as client errors with details; retrieval failures as
  graceful empty-context (let the model say "not in catalog"); provider
  authentication failures as generic "service unavailable" responses that
  do not leak the Builder's configuration issue to the shopper; upstream
  host-API errors as tool results fed back to the model; unhandled errors
  as a generic server error with the stack retained in structured logs.
- **FR-012**: The system MUST emit structured logs for every request
  containing at minimum a request ID, a non-PII message preview, total
  latency, tool calls made, and final outcome. Logs MUST NOT contain
  shopper credentials or other PII.
- **FR-013**: The system MUST enforce a per-session request rate limit
  (default 60 requests per 10 minutes) and respond to overages with a
  rate-limit response that includes a retry-after hint.
- **FR-014**: The system MUST accept cross-origin requests only from
  origins on a configured allowlist, and MUST reject requests from other
  origins.

### Functional Requirements — Embedded widget

- **FR-015**: The widget MUST load via a single script tag and stylesheet
  added to the host page, without requiring a framework-specific runtime
  on the host.
- **FR-016**: The widget MUST read its configuration (backend URL,
  launcher position, auth mode, host API base URL, locale, theme) from
  declarative attributes on its loader, with documented defaults, so the
  Builder does not need to write JavaScript to configure it.
- **FR-017**: The widget MUST inject a floating launcher and, on
  activation, an expandable chat panel. On mobile viewports the panel
  MUST be full-screen; on desktop it MUST be a fixed-size overlay.
- **FR-018**: The widget MUST render assistant replies as sanitised
  markdown and MUST NOT execute arbitrary HTML. Citations MUST render as
  inline links to the cited entity's host page.
- **FR-019**: The widget MUST hold conversation state in memory for the
  session and MUST include the retained history with each backend
  request, trimming to the same turn cap the backend enforces.
- **FR-020**: The widget MUST render a confirmation card for each action
  intent received from the backend, showing the action's human-readable
  description and a summary of the action's key fields, and MUST NOT
  execute the action until the shopper clicks the primary button on the
  card.
- **FR-021**: The widget MUST validate that every action intent's tool
  name appears in the tool allowlist made available at initialisation.
  Action intents with unknown tool names MUST be refused, logged, and
  MUST NOT result in any host-API call.
- **FR-022**: The widget MUST support at least three authentication
  modes for host-API calls: cookie (session credentials attached
  automatically), bearer (token from a configured client-side storage
  key), and custom (a host-provided async function returning a header
  map). The mode MUST be selectable via configuration attributes.
- **FR-023**: The widget MUST, after a successful action execution, give
  the backend a structured follow-up signal so the next assistant turn
  can acknowledge what happened.
- **FR-024**: The widget MUST handle host-API unauthorised responses by
  surfacing a "please log in first" message with a link to the host's
  login page if one is configured.
- **FR-025**: The widget MUST expose theming via CSS custom properties
  (primary colour, surface colour, radius, font family, panel
  dimensions, shadow, and a small number of peers) so host CSS overrides
  take effect on the next page load without rebuilding the bundle.
- **FR-026**: The widget MUST meet WCAG 2.1 AA basics: keyboard focus
  management on interactive elements, visible focus rings, accessible
  names on icon-only buttons, minimum 4.5:1 contrast on default themes,
  focus-trap semantics on the open chat panel, and respect for
  `prefers-reduced-motion`.
- **FR-027**: The widget bundle MUST stay within a published size budget
  (default: script ≤ 80 KB gzipped, stylesheet ≤ 10 KB gzipped) so it
  does not noticeably slow the host page.
- **FR-028**: The widget MUST NOT issue network requests to any origin
  other than the configured backend URL and the configured host-API
  base URL.

### Functional Requirements — `/atw.embed` command

- **FR-029**: The `/atw.embed` slash command MUST run only after Feature
  002 has produced a compiled widget bundle, and MUST fail clearly if
  the bundle is absent.
- **FR-030**: The command MUST interview the Builder for: host framework
  (at minimum Next.js, plain HTML, and custom), runtime backend URL,
  authentication mode, and optional theming preferences.
- **FR-031**: The command MUST write a tailored integration guide to
  `.atw/artifacts/embed-guide.md` containing: paste-ready script and
  stylesheet tags for the identified framework, the file copy commands
  needed to put the bundle in place, the CORS configuration the host
  must permit, a theming example, and a troubleshooting section.
- **FR-032**: The generated guide MUST be idempotent on re-run with the
  same answers and MUST produce a diff when answers change.

### Functional Requirements — Aurelia Medusa demo

- **FR-033**: The repository MUST include a self-contained demo
  environment (a Medusa v2 backend, a Next.js storefront, the runtime
  backend, and the index database) that starts with a single
  orchestration command and becomes fully usable within a bounded time
  budget on a reference machine.
- **FR-034**: The demo MUST ship deterministic seed data for the Medusa
  catalog (target: 300 products, 25 categories, 12 collections, multiple
  regions) so consecutive runs produce the same database state.
- **FR-035**: The demo MUST include pre-generated Feature 001 and
  Feature 002 artefacts so that reviewers can reach the runtime without
  running the upstream features themselves.
- **FR-036**: The repository MUST also provide a documented path that
  clears the pre-generated artefacts and lets the reviewer run Features
  001 and 002 from scratch, so the filmed setup flow in the demo video
  is reproducible.
- **FR-037**: The Aurelia storefront MUST load the compiled widget via
  a single script/link addition and MUST pass the runtime traffic to
  the runtime backend defined in the orchestration.

### Functional Requirements — Runtime safety and non-functional rails

- **FR-038**: The system MUST treat all retrieval results as
  PII-excluded. If any retrieved row carries content matching well-known
  PII patterns (e-mail, phone, card-like number), the backend MUST scrub
  it before passing to the model as a defence-in-depth supplement to the
  build-time PII exclusion.
- **FR-039**: The system MUST surface an informative error to the
  Builder at backend startup when required configuration is missing
  (e.g., model API key, allowlisted origins, index connection string),
  rather than failing silently at first traffic.
- **FR-040**: The widget MUST NOT execute any action that is marked
  `confirmation_required` without an explicit interactive user action
  on the confirmation card. There MUST be no programmatic path that
  bypasses this gate.

### Key Entities *(business-level)*

- **Conversation.** The turn history kept in the widget for one open
  session, transmitted with each request to the backend. Bounded by the
  turn cap; expires when the page unloads. Contains user and assistant
  turns with timestamps; never contains credentials.
- **Chat exchange.** A single request/response pair between widget and
  backend, containing the user's message, the running conversation
  context, the agent's textual reply, the set of catalog entities cited,
  and any action intents the agent proposes.
- **Session context.** Non-credential host-app identifiers the widget
  passes to the backend (cart ID, customer ID, region, locale,
  page-level context) so the backend can resolve action-intent path
  templates without calling the host API.
- **Retrieved entity.** A row read at query time from the catalog index,
  containing the enriched document, the grounded facts, the category
  labels, and a similarity score. The basis for citations.
- **Citation.** A reference in an assistant reply pointing to a specific
  retrieved entity, with entity type, entity ID, and relevance score,
  rendered in the widget as an inline link to the host's entity page.
- **Action intent.** A structured description of a state-changing action
  the agent proposes: a tool name drawn from the action manifest, the
  fully-resolved HTTP method and path, the request arguments, a
  human-readable description, and the `confirmation_required` flag.
  Construction is the backend's job; execution is the widget's.
- **Tool allowlist.** The set of tool names declared in the action
  manifest, made available to the widget at initialisation time. Used
  to refuse any action intent whose name is not on the list.
- **Integration guide.** The markdown output of `/atw.embed`, one
  artefact per project, describing exactly how the Builder adds the
  widget to their host app.
- **Demo environment.** The orchestrated set of services (host backend,
  host storefront, runtime backend, index database) that together
  deliver a reproducible runtime against seeded data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001** — *Grounded end-to-end response.* On the Aurelia demo, a
  flavour-profile question returns a reply mentioning at least two real
  catalog products whose facts trace to the indexed data, within 4
  seconds at the median and 6 seconds at the 95th percentile.
- **SC-002** — *Action confirmation round trip.* A shopper can, in the
  Aurelia demo, ask the agent to add a recommended item to their cart
  and see the host cart reflect the change within 2 seconds of clicking
  confirm, with zero state change before that click.
- **SC-003** — *Multi-turn coherence.* In a scripted 5-turn session
  where only the first turn names the entity, at least 4 of the next 4
  turns resolve pronouns/references to that entity correctly.
- **SC-004** — *Anonymous fallback.* In a private-browsing session with
  no host login, a personalised question returns a "please log in
  first" reply rather than an error screen in 100% of attempts.
- **SC-005** — *Reproducibility on a fresh clone.* On a fresh machine
  with Docker and an API key, the documented start command brings the
  Aurelia demo to a state where the widget answers its first grounded
  question within 3 minutes.
- **SC-006** — *Credential sovereignty.* In full-conversation traffic
  captures (both request logs at the runtime backend and network traces
  at the browser), no host-user credential ever appears outside traffic
  between the widget and the host API. Zero leaks is the passing bar.
- **SC-007** — *Citation navigability.* For every citation surfaced in
  the widget UI during a 10-turn Aurelia session, clicking the citation
  navigates to the correct real product page on the storefront.
- **SC-008** — *Tool-name enforcement.* A fabricated response injecting
  an unknown tool name via the browser's developer tools or a proxy
  results in a refusal by the widget and zero calls to the host API in
  100% of attempts.
- **SC-009** — *Bundle budget.* The compiled widget fits within the
  published size budget (script ≤ 80 KB gzipped, stylesheet ≤ 10 KB
  gzipped), verified automatically during build.
- **SC-010** — *Rate-limit enforcement.* Sending more than the
  per-session request cap to the chat endpoint yields rate-limit
  responses on every request beyond the cap, with a valid retry-after
  hint, in 100% of tests.
- **SC-011** — *No surprising network traffic.* In a 10-turn Aurelia
  session monitored in the browser's network tab, every outbound
  request targets either the configured runtime backend or the
  configured host API; no third-party origin appears.
- **SC-012** — *Theming responsiveness.* Changing a documented theme
  variable on the host page and reloading updates the widget's visual
  rendering on 100% of supported evergreen browsers, with no widget
  rebuild.
- **SC-013** — *Accessibility basics.* On automated accessibility
  checks of the open widget panel, 0 WCAG 2.1 AA colour-contrast,
  focus-order, or label violations remain at release.
- **SC-014** — *`/atw.embed` completeness.* For each of the three
  supported host frameworks, the generated integration guide allows a
  fresh developer (unfamiliar with the project) to reach a working
  widget on a sample host in under 15 minutes, verified by at least
  one dry run per framework.
- **SC-015** — *Demo repeatability.* Running `docker compose down -v`
  followed by `docker compose up` twice back-to-back on the Aurelia
  demo yields identical observable storefront behaviour on the same
  scripted 5-turn conversation.

## Assumptions

- Features 001 and 002 are complete and have produced: the markdown
  artefacts under `.atw/`, the running indexed database, the compiled
  runtime backend image, and the compiled widget bundle. Feature 003
  runs these — it does not reproduce them.
- V1 is single-tenant and single-process. Horizontal scale,
  multi-tenant isolation, and zero-downtime rolling deploys are out of
  scope.
- Evergreen browsers only: Chrome, Safari, Firefox, and Edge at
  versions released in the last two years; iOS Safari 15+; Android
  Chrome 100+. Legacy browser support is out of scope.
- The only shipped demo host is the Aurelia Medusa storefront. The
  product is designed to work on any host, but only this one is
  integrated, seeded, and exercised.
- Cookie-based session authentication is the default for the Aurelia
  demo because Medusa's default storefront uses cookies. Bearer and
  custom modes are supported configurations but are not the demo's
  default path.
- The runtime backend does not stream responses in V1 — each exchange
  is a single response payload. Streaming is a future enhancement that
  requires widget rework.
- Conversation history is per-tab, in-memory only. Cross-tab sync,
  cross-device continuity, and browser-storage persistence are
  deferred.
- The `/atw.verify` command, admin/monitoring UIs, analytics
  telemetry, rich media output (image galleries, carousels),
  voice/file input, OAuth/SAML/OIDC flows, and Managed Agents
  integration are all explicitly out of scope for Feature 003 and may
  be revisited only if a Feature 004 is opened.
- The demo video is a downstream deliverable and is not a code
  artefact in this feature. The feature must deliver behaviour the
  video can film; the editing of the video itself is outside the
  software specification.
- Internal implementation choices (widget DOM framework — Preact or
  vanilla; whether markdown rendering uses a specific sanitiser
  library; whether the backend uses Fastify vs another small HTTP
  framework) are intentionally left to `/speckit.plan` so long as the
  non-functional budgets (bundle size, p50/p95 latency, accessibility)
  are met.
- Prompt-injection resistance is best-effort: the system prompt
  discourages it, and the tool-name allowlist structurally limits the
  blast radius, but the product documentation must be candid that this
  is not a hard guarantee.

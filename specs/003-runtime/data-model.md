# Data Model: Runtime (Feature 003)

**Feature**: Runtime
**Plan**: [plan.md](./plan.md)
**Date**: 2026-04-22

This document is the authoritative shape reference for every piece of
state the runtime layer produces, consumes, or carries across a turn.
Feature 003 introduces **no new database tables or migrations** — it
reads from `atw_documents` (defined in Feature 002's data-model §1.2)
and writes nothing persistent. All state in this document is:

1. **Wire shapes** exchanged between widget, backend, and host API.
2. **In-flight runtime state** held in memory for the life of one
   chat turn or one widget session.
3. **On-disk state** written by the new `/atw.embed` command.

Every type listed here has a matching `zod` schema in
`packages/scripts/src/lib/types.ts` (extending the schemas Feature 002
introduced) and is validated at the boundary where it first enters
a component.

---

## 1. Wire types — widget ↔ backend

### 1.1 `ChatRequest`

```ts
ChatRequest = {
  message: string;                  // 1..4000 chars; >4000 → backend rejects 400
  history: Array<ConversationTurn>; // bounded at 20 turns by widget; backend also trims
  context: SessionContext;
};

ConversationTurn = {
  role: 'user' | 'assistant';
  content: string;                  // rendered markdown for assistant; raw text for user
  timestamp: string;                // ISO 8601 UTC
};

SessionContext = {
  cart_id?: string | null;          // host-scoped identifier, e.g. Medusa cart ID
  customer_id?: string | null;      // present only when logged in; never credentials
  region_id?: string | null;
  locale: string;                   // BCP-47 (e.g., "es-ES")
  page_context?: {                  // optional; keys are host-app decided
    [key: string]: string | number | boolean | null;
  };
};
```

**Validation rules**

- `message.length ∈ [1, 4000]`; non-ASCII allowed.
- `history.length ≤ 20`; entries beyond the cap are dropped by the
  widget before sending.
- Each `ConversationTurn.timestamp` parses as a valid ISO 8601 string.
- `locale` defaults to `navigator.language` if the widget attribute is
  unset; fallback is `"en-US"`.
- `SessionContext` never contains `Authorization`, `Cookie`, or any
  token/credential field. The backend's credential-strip hook is the
  structural backstop.

**Lifecycle**

- Constructed by the widget on every user send.
- Read-only to the backend; the handler never mutates this object.
- Discarded at end of request; the conversation store on the widget
  side is the single source of truth for subsequent turns.

### 1.2 `ChatResponse`

```ts
ChatResponse = {
  message: string;                  // assistant reply as markdown source
  citations: Array<Citation>;       // cited catalog entities in rendering order
  actions: Array<ActionIntent>;     // confirmation-required intents (may be empty)
  suggestions?: Array<string>;      // optional follow-up prompts the widget may surface
  request_id: string;               // echo of X-Request-Id; used in widget error surfaces
};

Citation = {
  entity_id: string;                // matches atw_documents.entity_id
  entity_type: string;              // matches atw_documents.entity_type
  relevance: number;                // 0..1 cosine similarity at retrieval time
  href?: string;                    // storefront URL when the host provided a template
  title?: string;                   // display label from the retrieved document
};

ActionIntent = {
  id: string;                       // unique per response (UUIDv4)
  tool: string;                     // matches one of action-manifest's tool names
  arguments: Record<string, unknown>;
  description: string;              // human-readable; shown on the confirmation card
  confirmation_required: true;      // structurally true; the backend does not emit false
  http: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;                   // already substituted with values from SessionContext
  };
  summary?: Record<string, string>; // optional key-value pairs rendered on the card
};
```

**Validation rules**

- `message.length ≥ 1`. An empty reply never ships (backend falls back
  to "I don't know" if Opus returns empty text with no tool calls).
- `citations[i].entity_id` must be present in the retrieval result set
  used by the response. The tool-execution layer asserts this before
  the response is sent.
- `actions[i].tool` must appear in the rendered `tools.ts` allowlist.
  The widget enforces the same rule structurally on receipt (FR-021).
- `actions[i].http.path` must not contain unresolved template
  variables (`{...}`); the backend refuses to emit such an intent.
- `confirmation_required` is always `true` for emitted actions; the
  field exists on the wire so future opt-out actions can be added
  without a schema change, but the backend of V1 never emits `false`.

**Lifecycle**

- Produced by the chat route handler after the tool-use loop settles.
- Parsed by the widget via zod on receipt; structural parse failure
  shows a friendly "I'm having trouble right now" state and suppresses
  rendering.

### 1.3 `ActionFollowUp`

Optional second request shape that the widget sends after an action
has been executed against the host API, so the next assistant turn
can acknowledge it naturally.

```ts
ActionFollowUp = {
  action_id: string;                // the ActionIntent.id the widget just executed
  outcome: 'succeeded' | 'cancelled' | 'failed';
  host_response_summary?: string;   // widget-composed short string ("added 2 × Colombia Huila")
  error?: {
    status?: number;
    message: string;
  };
};
```

The widget folds an `ActionFollowUp` into its next outgoing message as
a hidden `system_trailer` field inside `ChatRequest.context`:

```ts
SessionContext.page_context.atw_action_follow_up = ActionFollowUp;
```

The backend reads it from there, formats a short trailer line ("Action
added_to_cart succeeded: added 2 × Colombia Huila"), and injects it as
an assistant-role synthetic turn when composing the Opus call. It is
never surfaced as a standalone wire shape.

---

## 2. Backend in-flight types

### 2.1 `ChatRequestEnvelope`

Internal Fastify request state after the credential-strip hook and
zod validation. Not serialised anywhere.

```ts
ChatRequestEnvelope = {
  req_id: string;                   // @fastify/request-id value
  received_at: Date;
  session_id: string;               // X-Atw-Session-Id header, generated by widget
  remote_ip: string;                // for rate-limit fallback
  body: ChatRequest;
  credential_stripped: boolean;     // true iff onRequest saw any stripped header
};
```

### 2.2 `RetrievalHit`

One row of the pgvector query, post-PII-scrub.

```ts
RetrievalHit = {
  entity_id: string;
  entity_type: string;
  document: string;                 // scrubbed
  facts: Array<{ claim: string; source: string }>;
  categories: Record<string, string[]>;
  similarity: number;               // 1 - cosine_distance ∈ [0, 1]
  opus_tokens: { input_tokens: number; output_tokens: number };
  pii_redactions: number;           // count from pii-scrub; 0 under normal operation
};
```

**Validation rules**

- `similarity ≥ threshold` (default 0.55, configurable).
- After scrub, `document.length ≥ 1`; if scrub wiped the document
  entirely, the hit is dropped (logged).

### 2.3 `OpusTurnState`

State carried through the tool-use loop.

```ts
OpusTurnState = {
  messages: Array<AnthropicMessage>; // accumulated conversation + tool_result blocks
  tool_calls_executed: number;       // capped at MAX_TOOL_CALLS_PER_TURN (default 5)
  input_tokens: number;              // running total across calls in this turn
  output_tokens: number;
  stop_reason?: string;              // last stop_reason from Anthropic
  action_intents: Array<ActionIntent>; // accumulated until returned
  safe_read_results: Array<SafeReadResult>; // what the server did on behalf of the model
};

SafeReadResult = {
  tool: string;
  http: { method: string; path: string };
  status: number;
  body_preview?: string;             // first 512 chars, never full body
  duration_ms: number;
};
```

**State transitions**

- Loop exits on `stop_reason === 'end_turn'` (model's text reply is
  the final answer) or when `tool_calls_executed === MAX_TOOL_CALLS_PER_TURN`.
- Loop short-circuits and returns a friendly fallback message if
  Anthropic returns an error that is not covered by the retry matrix
  (reused from Feature 002 T078: 400 / 401 / 403 / 408 / 409 / 429 /
  5xx).
- `action_intents` accumulate only from `input_schema`-matched tool
  calls whose tool name is in the action (state-changing) set from
  `action-manifest.md`. Safe-read tools are executed server-side and
  never populate `action_intents`.

### 2.4 `ChatHandlerResult`

Final composed result before serialisation.

```ts
ChatHandlerResult =
  | { kind: 'ok'; response: ChatResponse; latency_ms: number }
  | { kind: 'error'; status: number; message: string; error_code: string };
```

**Error code vocabulary**

| `error_code`              | HTTP | When it is used                                             |
|---------------------------|------|-------------------------------------------------------------|
| `validation_failed`       | 400  | zod parse failed on the incoming body.                      |
| `message_too_long`        | 400  | `message.length > 4000`.                                    |
| `rate_limited`            | 429  | `@fastify/rate-limit` fired; `Retry-After` header set.      |
| `retrieval_unavailable`   | 503  | Postgres unreachable for > 2 s.                             |
| `model_unavailable`       | 503  | Anthropic unreachable / auth failure / persistent 5xx.      |
| `host_api_unreachable`    | 503  | Safe-read tool failed against the host API repeatedly.      |
| `internal_error`          | 500  | Unhandled exception; response message never leaks internals. |

---

## 3. Widget in-memory state

### 3.1 `WidgetConfig`

Read once at bundle boot from `data-*` attributes.

```ts
WidgetConfig = {
  backendUrl: string;                // data-backend-url (required)
  apiBaseUrl: string;                // data-api-base-url, default window.location.origin
  theme: string;                     // data-theme, default "default"
  launcherPosition: 'bottom-right' | 'bottom-left' | 'bottom-center';
  authMode: 'cookie' | 'bearer' | 'custom';
  authTokenKey?: string;             // data-auth-token-key (required iff authMode === 'bearer')
  locale: string;                    // data-locale, default navigator.language
  loginUrl?: string;                 // data-login-url, used by the anonymous-fallback path
  introLine?: string;                // data-intro, shown on empty conversation
  allowedTools: Array<string>;       // injected at build time from action-manifest.md
};
```

**Validation rules**

- `backendUrl` and (when mode is `bearer`) `authTokenKey` are
  required; their absence puts the launcher into a disabled state
  with a clear console error so the Builder sees the misconfiguration
  on first load.
- `authMode === 'custom'` requires `window.AtwAuthProvider` to exist
  when the first action executes; its absence produces a runtime
  error surfaced in the widget UI (with a pointer to
  `embed-guide.md`).

### 3.2 `ConversationState`

The widget's reactive store (`@preact/signals`-backed).

```ts
ConversationState = {
  turns: Signal<Array<ConversationTurn>>; // bounded at 20; oldest dropped
  sessionId: string;                      // UUIDv4, persisted in sessionStorage
  isSending: Signal<boolean>;
  open: Signal<boolean>;                  // panel open/closed
  pendingAction: Signal<ActionIntent | null>; // at most one at a time on the card
  lastError: Signal<string | null>;
  lastRequestId: Signal<string | null>;   // populated from backend X-Request-Id
};
```

**State transitions**

- `turns` append on send / on receive; trim to 20 via FIFO.
- `pendingAction` is cleared when the shopper clicks Cancel or when a
  primary-button click resolves (success or failure).
- `open` persists for the tab's lifetime; not persisted across
  reloads.
- `sessionId` is generated on first mount and stored in
  `sessionStorage` so closing/reopening the panel within the same tab
  re-uses the same rate-limit bucket.

### 3.3 `ActionCardViewModel`

Props for the confirmation card component.

```ts
ActionCardViewModel = {
  intent: ActionIntent;
  status:
    | 'idle'
    | 'executing'
    | 'succeeded'
    | 'failed';
  error?: string;
};
```

**Transitions**

- `idle → executing` on primary click (after tool-name allowlist
  check).
- `executing → succeeded` on 2xx from the host API.
- `executing → failed` on 4xx/5xx; the error surface includes a
  retry affordance and, on 401/403, a login link built from
  `WidgetConfig.loginUrl` if configured.

### 3.4 `ToolAllowlistCheck`

Implemented in `widget/src/api-client.ts` and tested in
`widget/test/action-card.unit.test.ts`.

```ts
assertToolAllowed(tool: string, config: WidgetConfig): void
```

Throws `ATW_TOOL_NOT_ALLOWED` if `tool ∉ config.allowedTools`. No
`fetch` ever runs past this check for disallowed tools.

---

## 4. On-disk state

### 4.1 `.atw/state/embed-answers.md`

Persisted answers to the `/atw.embed` interview, committed by the
Builder into their repo. Human-readable markdown (Principle II).

Shape (simplified):

```markdown
---
framework: next-app-router
backend_url: https://atw.my-client.example.com
auth_mode: cookie
login_url: https://my-client.example.com/login
theme:
  primary: "#8B4513"
  radius: "4px"
  font: "Aurelia Sans"
---

# Embed answers

Captured on 2026-04-22 for `my-client-agent`.

Re-run `/atw.embed` to regenerate `embed-guide.md` after changing any
of the values above.
```

**Lifecycle**

- Written on the first `/atw.embed` run.
- Re-read on subsequent runs; if all answers match, the command is a
  no-op beyond touching a `Last-regenerated: <date>` footer on the
  guide.

### 4.2 `.atw/artifacts/embed-guide.md`

The generated integration guide. Structure defined in
[`contracts/embed-command.md`](./contracts/embed-command.md).
Deterministic byte output given identical `embed-answers.md`
(FR-032).

---

## 5. Relationships and flow summary

```
+-----------+        ChatRequest        +---------------+
|  widget   | -----------------------> |   backend     |
| (browser) |                           | (Fastify)     |
+-----------+        ChatResponse      +---------------+
     |                                       |
     | (on confirm click)                    |
     v                                       |
+-----------+    host-API HTTP call         |
|   host    | <----------------------------- |
|  backend  |    (widget + shopper creds)   |
+-----------+                                |
                                             |
                                             | pgvector SELECT
                                             v
                                   +-----------------+
                                   |   atw_documents |
                                   |  (Feature 002)  |
                                   +-----------------+
                                             |
                                             | (retrieval hits)
                                             v
                                    +----------------+
                                    | Anthropic API  |
                                    | (Opus 4.7)     |
                                    +----------------+
```

**Key invariants across all shapes**

1. **No credentials on the backend path.** `Authorization`, `Cookie`,
   and token-bearing custom headers are stripped by the credential-
   strip hook before any handler sees them.
2. **No host-API call on the backend path.** Safe-read tool
   executions use `HOST_API_KEY` (server-side, Builder-owned) or no
   auth at all; they never forward shopper credentials.
3. **Every citation traces to a RetrievalHit.** The chat handler only
   emits citations whose `entity_id` appears in the retrieved set
   for that turn.
4. **Every ActionIntent's tool is in the allowlist.** The backend
   refuses to emit otherwise; the widget refuses to execute otherwise.
5. **Conversation state is per-tab.** No server-side session store,
   no cross-tab sync, no persistence across reloads.

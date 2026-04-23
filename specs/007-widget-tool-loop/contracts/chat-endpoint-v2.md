# Contract: `POST /v1/chat` (v2 — tool-result post-back)

**Feature**: 007-widget-tool-loop
**Amends**: `specs/003-runtime/contracts/chat-endpoint.md` §5.
**Consumer**: the ATW widget (`packages/widget`).
**Status**: Breaking amendment — the `is_action: false → executeSafeRead` branch is removed. Existing Feature 003/006 consumers that never emit `tool_result` continue to work; the removal affects only the server's internal execution path, not the request shape they send.

## Motivation

Feature 003 split runtime tool execution: `is_action: false` tools ran server-side in `atw_backend` against `HOST_API_BASE_URL`; `is_action: true` tools ran client-side in the widget with the shopper's credentials. This feature collapses the split. All tools run in the widget. The backend stays in the conversation loop to drive Opus's tool-use decision, but the widget closes the loop by POSTing the fetched result back.

## Request shape (v2)

```jsonc
{
  // EXISTING fields — unchanged semantics.
  "messages": [                          // conversation history carried by the widget
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": [...]}
  ],
  "pending_turn_id": "string | null",    // backend-issued on the initial post of a turn;
                                         // carried by the widget on resume posts.
  "session": { ... },                    // optional; existing shape from Feature 003.

  // NEW field (optional) — present only on resume posts.
  "tool_result": {
    "tool_use_id": "toolu_xxx",          // the id Opus emitted in its tool_use block
    "content": "string",                 // JSON-stringified shop response body, truncated to BODY_LIMIT
    "is_error": false,                   // true when the widget was unable to fetch successfully
    "status": 200,                       // HTTP status from the shop; 0 for network/timeout errors
    "truncated": false                   // true if `content` was cut at BODY_LIMIT
  },

  // NEW field — budget carried by the widget across posts.
  "tool_call_budget_remaining": 4        // integer; decrements on each tool_use the backend emits
}
```

### Request-time invariants

- `messages` always carries the complete conversation state for the turn (FR-018, stateless backend across posts).
- When `tool_result` is present, `pending_turn_id` MUST also be present and MUST match the backend-issued handle from the intent that produced this result.
- When `tool_result` is absent, the request is the initial post of a turn (user message); retrieval and embedding run.
- When `tool_result` is present, retrieval and embedding MUST NOT run; the backend skips directly to `messages.create()`.

### Body limit

`BODY_LIMIT = 4096 bytes` on `tool_result.content`. The widget truncates before posting and sets `truncated: true`. Backends MUST treat the `content` string as opaque text for Anthropic consumption — it is passed verbatim into the Anthropic `tool_result` block.

## Response shape

Unchanged from Feature 003 when `stop_reason !== "tool_use"`:

```jsonc
{
  "text": "string",                      // the assistant's composed reply
  "citations": [...],                    // existing shape
  "pending_turn_id": null                // clears the handle when the turn is complete
}
```

When `stop_reason === "tool_use"`, the backend emits an `ActionIntent` response:

```jsonc
{
  "action_intent": {
    "tool_use_id": "toolu_xxx",
    "tool": "listMyOrders",              // operationId from the action catalog
    "arguments": { ... },                // what Opus produced
    "confirmation_required": false       // frozen at manifest-build time
  },
  "pending_turn_id": "string",           // backend issues a fresh handle if none was sent;
                                         // or echoes the existing one on resume posts
  "tool_call_budget_remaining": 3        // decremented by 1 from the request value
}
```

### Budget enforcement

The backend:
1. On an initial post, resets the budget to `MAX_TOOL_CALLS_PER_TURN` (default 5, configurable via env).
2. On a resume post, reads `tool_call_budget_remaining` from the request and treats values ≤ 0 as "budget exhausted".
3. When budget is exhausted and Opus still wants to call a tool, forces a composition pass by re-invoking `messages.create()` with `tool_choice: {type: "none"}` (or the equivalent) and returns the composed text + citations as the final reply.

The widget MUST NOT bypass the budget by forging a higher value on resume. The backend's independent derivation (from `messages` array length + turn start) is the enforcement.

## Execution flow (normative)

```text
Widget                         Backend
──────                         ───────
POST /v1/chat                  read messages → retrieval + embedding
  { messages: [user] }         → Opus.messages.create(tools=...)
                               stop_reason === "tool_use"?
                               ├─ yes: respond { action_intent, pending_turn_id: "T1",
                               │                 tool_call_budget_remaining: 4 }
                               └─ no:  respond { text, citations }

(auto-exec or confirmation)
fetch shop API                 (no backend activity)

POST /v1/chat                  read messages → detect tool_result → skip retrieval
  { messages: [user, assistant-with-tool_use],   → append tool_result block to messages
    pending_turn_id: "T1",                       → Opus.messages.create()
    tool_result: {...},                          stop_reason === "tool_use"?
    tool_call_budget_remaining: 4 }              ├─ yes: respond { action_intent,
                                                 │                 pending_turn_id: "T1",
                                                 │                 tool_call_budget_remaining: 3 }
                                                 └─ no:  respond { text, citations }
```

## Removed server-side paths

- The `executeSafeRead()` helper (`packages/backend/src/lib/tool-execution.ts.hbs`) is deleted.
- The `is_action: false` branch in the chat route is deleted; every `tool_use` from Opus emits an `ActionIntent`.
- `HOST_API_BASE_URL` and `HOST_API_KEY` are removed from `runtime-config.ts.hbs` and from `docker-compose.yml`.
- Startup-time env-var checks for the above are removed.

## Contract tests

1. **Request-shape test.** POSTing a v2 request with `tool_result` populated MUST cause the backend to skip retrieval. Asserted by stubbing the retrieval module and expecting zero calls.
2. **Budget-exhaustion test.** POSTing with `tool_call_budget_remaining: 0` when Opus emits a `tool_use` MUST force composition (no further `action_intent` emitted).
3. **Stateless test.** Two concurrent turns with different `pending_turn_id` values MUST NOT interfere; the backend holds no in-memory session store.
4. **Sovereignty test** (cross-reference: [sovereignty-probe.md](./sovereignty-probe.md)). Rendered backend source contains no `fetch(` against non-local hosts.

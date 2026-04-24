# Contract: `POST /v1/chat` — v3

**Feature**: 008-atw-hardening
**Amends**: Feature 007 `chat-endpoint-v2.md`.
**Consumer**: the ATW widget (`packages/widget`).
**Status**: Breaking amendment to `ToolResultPayload`. Response-shape amendment is additive (new discriminator).

## Motivation

Feature 007's v2 contract documented a typed `assistant`-role turn whose content is an array carrying the `tool_use` block — a shape the widget never sends (the widget's `ConversationTurn.content` is `string`-only). The backend consequently pushed a `tool_result` with no matching `tool_use`, and Anthropic rejected with *"unexpected tool_use_id found in tool_result blocks"*. v3 resolves the drift by documenting the shape the widget actually sends and extending `ToolResultPayload` with enough data for the backend to reconstruct the Anthropic message trio statelessly (R4 / FR-018 / FR-019 / FR-020).

## Request shape (v3)

```jsonc
{
  // EXISTING — unchanged
  "messages": [
    { "role": "user", "content": "string" },
    { "role": "assistant", "content": "string" }
  ],
  "pending_turn_id": "string | null",
  "session": { ... },

  // AMENDED — tool_result payload gains tool_name and tool_input
  "tool_result": {
    "tool_use_id": "toolu_xxx",    // existing
    "tool_name": "addToCart",      // NEW v3 — operationId the widget executed (FR-019)
    "tool_input": {                // NEW v3 — arguments the widget actually executed
      "product_id": "...",         //           against the host; reflects any shopper
      "quantity": 1                //           confirmation-card edits
    },
    "content": "string",           // existing — JSON-stringified shop response body
    "is_error": false,             // existing
    "status": 200,                 // existing
    "truncated": false             // existing
  },

  "tool_call_budget_remaining": 4  // existing
}
```

### `ToolResultPayloadSchema` (TypeScript)

```ts
const ToolResultPayloadSchema = z.object({
  tool_use_id: z.string().min(1),
  tool_name: z.string().min(1),                // NEW v3
  tool_input: z.record(z.unknown()),           // NEW v3
  content: z.string(),
  is_error: z.boolean(),
  status: z.number().int(),
  truncated: z.boolean().default(false),
});
```

### Request-time invariants (v3)

- `messages` remains string-content only. No typed `tool_use` block is carried by the widget.
- When `tool_result` is present, `tool_name` and `tool_input` MUST be populated. Backend rejects missing fields with HTTP 400 and diagnostic body.
- `tool_name` MUST resolve to a known operationId in the deployed manifest; unknown names are 400-rejected.
- Retrieval and embedding remain skipped on `tool_result`-bearing posts.

### Backend message-sequence reconstruction

On receipt of a valid v3 request with `tool_result`:

```ts
const messagesForAnthropic: AnthropicMessage[] = [
  // Carry prior user turns from the widget's messages array, verbatim.
  ...req.messages.filter(m => m.role === "user" || m.role === "assistant"),
  // Synthesize the assistant tool_use turn the widget never sent.
  {
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: req.tool_result.tool_use_id,
        name: req.tool_result.tool_name,
        input: req.tool_result.tool_input,
      },
    ],
  },
  // Append the tool_result as the next user turn.
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: req.tool_result.tool_use_id,
        content: req.tool_result.content,
        is_error: req.tool_result.is_error,
      },
    ],
  },
];
// anthropic.messages.create({ messages: messagesForAnthropic, tools, ... })
```

This construction is stateless across posts (FR-018) — no session store, no server-side turn state. The widget continues to hold the conversation history as `{role, content:string}` pairs.

## Response shape (v3)

Existing shapes from v2 remain valid (`text`+`citations` and `action_intent`). v3 adds one mutually-exclusive discriminator:

```jsonc
// NEW v3 — response-generation-failed-but-action-succeeded (FR-020a)
{
  "response_generation_failed": true,
  "action_succeeded": true,
  "pending_turn_id": null
}
```

### Response invariants (v3)

- `response_generation_failed: true` MUST NOT co-occur with `text` or `action_intent`.
- `response_generation_failed: true` MUST only be emitted after the backend has retried the second Opus call twice (total 3 attempts) on a request that carried a successful `tool_result` (`is_error === false`).
- On receipt of this response, the widget renders the pinned fallback string (see [R5](../research.md#r5-response-generation-failed-but-action-succeeded-handshake-fr-020a)): *"Action completed successfully. (Response generation failed — please refresh.)"*. The widget MUST NOT render the generic error toast.

### Retry policy (backend, FR-020a / R5)

- Initial attempt + 2 retries = 3 attempts maximum.
- Delays: 500 ms → 1 s → 2 s (exponential, factor 2).
- Only the post-`tool_result` second Opus call participates. Initial (pre-`tool_use`) call retains its Feature 003 error handling.
- Any non-`tool_result`-triggered failure (including first Opus call failure, retrieval failure, validation failure) is surfaced via the pre-existing error-response shape — not this new shape.

## Removed paths

- None. v2's `executeSafeRead` was already removed in Feature 007.

## Contract tests

1. **v3 request happy path.** POST with valid `tool_result` carrying `tool_name` + `tool_input` causes the backend to reconstruct the Anthropic trio and complete a second Opus call (stubbed) without a session store.
2. **v3 request 400s.** POST with `tool_result` missing `tool_name` or `tool_input` returns HTTP 400 with a descriptive body.
3. **Retry exhaustion.** Stub Anthropic to fail 3 consecutive times after a successful `tool_result`; backend emits `{response_generation_failed:true, action_succeeded:true, pending_turn_id:null}`.
4. **First-Opus-call failure.** Stub Anthropic to fail on initial (pre-`tool_use`) call; backend returns the pre-existing error-response shape, NOT the FR-020a fallback shape.
5. **Contract-code alignment (FR-018).** A widget-to-backend snapshot test captures the exact bytes of a live widget POST and asserts it parses against `ToolResultPayloadSchema`. Mirrors SC-006's byte-for-byte guarantee.
6. **Reproducibility.** Same inputs produce identical reconstructed message sequences across runs.

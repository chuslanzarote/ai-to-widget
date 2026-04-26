# Contract: `POST /v1/chat` endpoint

**Feature**: Runtime (003)
**Plan**: [../plan.md](../plan.md)
**Data types**: [../data-model.md §1, §2](../data-model.md)

This contract is the authoritative behavioural reference for the chat
endpoint. Every bullet below is testable; the contract tests under
`packages/backend/test/` and the integration tests under
`tests/integration/runtime-*.test.ts` enforce it.

---

## 1. Route and verb

- **Method**: `POST`
- **Path**: `/v1/chat`
- **Content-Type**: `application/json`
- **Response Content-Type**: `application/json; charset=utf-8`
- **Response headers**: `X-Request-Id: <uuid>` always echoed back so
  the widget can surface it in an error state and tests can correlate
  logs with assertions.

---

## 2. Request body (`ChatRequest`)

Shape defined in `data-model.md §1.1`. The backend validates with
`ChatRequestSchema` (zod) and rejects non-conforming bodies with
`400 validation_failed` carrying the zod issue summary.

**Enforced constraints**

- `message` length ∈ [1, 4000] characters. `400 message_too_long` if >
  4000; `400 validation_failed` if empty.
- `history.length ≤ 20`. Extra turns are silently trimmed to the
  20 most recent (backend is lenient; widget is authoritative).
- `context.locale` defaults to `"en-US"` if missing.
- `context.page_context.atw_action_follow_up`, when present, must
  match `ActionFollowUp` (`data-model.md §1.3`). Malformed follow-ups
  are discarded with a warning log; the request still processes.

---

## 3. Response body (`ChatResponse`)

Shape defined in `data-model.md §1.2`. The backend guarantees:

- `message.length ≥ 1`. If Opus returned an empty text block and no
  tool calls, the backend substitutes a canned "I'm not sure I can
  help with that — could you rephrase?" message.
- `citations[]` is ordered by descending `relevance` and deduplicated
  on `(entity_type, entity_id)`.
- `citations[i].entity_id` is present in the `RetrievalHit[]` that
  the handler used for this turn. Enforced by an in-handler
  assertion that fails the request (500) if violated — there is no
  silent fallback.
- `actions[]` may be empty. When non-empty, every element has
  `confirmation_required: true`, `http.path` fully resolved (no
  unresolved `{...}` template variables), and `tool` in the allowed
  set from `tools.ts`.
- `suggestions` is optional; omitted on error paths and on pure
  tool-call-loop completion.

---

## 4. Processing pipeline

On every request, in order:

1. `@fastify/request-id` assigns `req.id` (UUIDv4) and sets
   `X-Request-Id` response header.
2. `onRequest` hook (`lib/credential-strip.ts`) strips and counts any
   of: `Authorization`, `Cookie`, `Set-Cookie`, and headers matching
   `/^X-.*-(Token|Auth|Session)$/i`. A `credential_strip_total`
   counter is incremented in the request log if any were seen.
   This hook is **unconditional** — no route opts out.
3. `@fastify/cors` rejects the request with 403 if the Origin is not
   in `ALLOWED_ORIGINS`.
4. `@fastify/rate-limit` keys on `X-Atw-Session-Id` header (if
   present) falling back to `remote_ip`. Limit: 60 req / 10 min per
   key (configurable). Exceeding returns 429 with
   `Retry-After: <seconds>` and `error_code: rate_limited`.
5. zod parse of the body. Failure → 400.
6. `lib/embedding.ts` embeds `body.message` (same model as build time,
   cached pipeline).
7. `lib/retrieval.ts` queries `atw_documents` via pgvector:
   - SQL (parameterised):
     ```
     SELECT entity_id, entity_type, document, facts, categories,
            1 - (embedding <=> $1) AS similarity
     FROM atw_documents
     WHERE 1 - (embedding <=> $1) > $2
     ORDER BY embedding <=> $1
     LIMIT $3;
     ```
   - `$2` = `RETRIEVAL_SIMILARITY_THRESHOLD` (default 0.55).
   - `$3` = `RETRIEVAL_TOP_K` (default 8).
   - On Postgres timeout (> 2 s) → 503 `retrieval_unavailable`.
8. `lib/pii-scrub.ts` redacts e-mail / phone / card / IBAN patterns
   in each hit's `document` and `facts[*].claim`. Hits whose
   document becomes empty after scrub are dropped (logged).
9. `lib/opus-client.ts` assembles the Anthropic `messages.create`
   call:
   - System prompt: `prompts.ts.SYSTEM_PROMPT` (rendered at build
     time from `brief.md` + `action-manifest.md`).
   - Messages: prior `history` + a final user message containing the
     current `message` and an XML-tagged context block of retrieved
     hits (format below).
   - Tools: `tools.ts.TOOLS` (rendered at build time).
   - Loop on `stop_reason === 'tool_use'` up to `MAX_TOOL_CALLS_PER_TURN`
     (default 5). Safe-read tools (`get_product`, `list_regions`,
     etc.) are executed by `lib/tool-execution.ts` and their results
     fed back as `tool_result` blocks. Action tools
     (`add_to_cart`, etc.) accumulate into `state.action_intents`
     and break the loop.
10. Compose `ChatResponse`:
    - `message` = text blocks from the final assistant message
      concatenated with `\n`.
    - `citations` = `RetrievalHit[]` filtered to those whose
      `entity_id` appeared in the text (case-insensitive substring
      match of `title` or `entity_id`) OR the top 3 by similarity if
      nothing matched (so a vague reply still carries pointers).
    - `actions` = `state.action_intents`.
    - `suggestions` = optional; inferred from the last
      assistant turn's text via a small regex (questions ending with
      "?" followed by ≤ 3 words); populated only when present.
11. Serialise, log summary, respond 200.

**Retrieval context block** (step 9) is formatted as:

```
<context>
  <entity type="product" id="prod_123" similarity="0.81" title="Colombia Huila">
    <document>…scrubbed document text…</document>
    <facts>
      <fact source="origin">Origin: Colombia Huila</fact>
      <fact source="flavor_notes">Tastes of cocoa, cherry, panela</fact>
    </facts>
    <categories>
      <category axis="process">pulped natural</category>
    </categories>
  </entity>
  …
</context>
```

---

## 5. Tool-use semantics

> **Superseded by Feature 007.** The safe-read / action split described
> below is **historical**. As of Feature 007 every shop-API call —
> including the safe-reads previously executed server-side — runs in
> the widget with the shopper's bearer JWT, and `atw_backend` never
> contacts the shop. The current authoritative behavioural reference
> for the chat route is
> [`specs/007-widget-tool-loop/contracts/chat-endpoint-v2.md`](../../007-widget-tool-loop/contracts/chat-endpoint-v2.md).
> The rest of this section remains as the v1 record.

The runtime distinguishes **safe-read** tools and **action** tools by
a flag in `action-manifest.md` (Feature 001 output). The flag is
rendered into `tools.ts` at build time and split into two arrays:

```ts
export const SAFE_READ_TOOLS: string[] = [...];
export const ACTION_TOOLS: string[] = [...];
```

**Safe-read tools**

- Executed server-side by `lib/tool-execution.ts`.
- HTTP call made against `HOST_API_BASE_URL` using `HOST_API_KEY` if
  set (as `Authorization: Bearer <key>`), else no auth.
- Never forward shopper credentials (Principle I).
- Result body truncated to 4 KB before being fed back to Opus (prevents
  runaway token cost from chatty host APIs).
- Timeout: 8 s per call. Timeouts surface as tool_result with an
  error body that Opus can narrate around.

**Action tools**

- Never executed on the backend.
- Each call is transformed into an `ActionIntent`:
  - `tool = tool_call.name`
  - `arguments = tool_call.input`
  - `http.method` and `http.path` come from `action-manifest.md` with
    arguments substituted via `lib/action-intent.ts`. Path-template
    variables (`{cart_id}`) are resolved from `context`; unresolved
    variables → action dropped with a logged error (the handler
    continues; the model gets a synthetic tool_result saying the
    action was "not executable — missing context").
  - `description` is a human-readable string composed from the tool
    name and its key arguments (e.g., "Add 2 × Colombia Huila to
    cart"). Composition rules per tool live in
    `lib/action-intent.ts` and are templated per tool.
  - `confirmation_required` = `true` unconditionally for action tools
    in V1.
  - `id` = fresh UUIDv4.

---

## 6. Credential safety

The following are **structural invariants**:

- The credential-strip hook runs before any route handler; removal is
  logged (count only, no value).
- `lib/opus-client.ts` does not receive the raw Fastify request; it
  receives a whitelisted subset (`body.message`, `body.history`,
  `body.context`, `retrievalHits`). There is no code path by which a
  shopper's header reaches the Opus call.
- `lib/tool-execution.ts` builds its outgoing `Headers` object from
  scratch; it never copies request headers.
- Log serialisers redact any residual `authorization`, `cookie`,
  `set-cookie`, `x-*-token`, `x-*-auth`, `x-*-session` before stdout.

Contract tests (`runtime-credential-sovereignty.test.ts`) send a
request carrying every blocked header, capture backend logs and
outgoing tool-execution traffic, and assert that **zero** carry any
shopper credential.

---

## 7. Error responses

Every error follows:

```json
{
  "error_code": "<code>",
  "message": "<user-safe message>",
  "request_id": "<uuid>"
}
```

The `message` string is always safe to display to the shopper. No
stack traces, no internal identifiers, no DSNs. The backend retains
the full error in structured logs keyed by `request_id`.

| `error_code`            | HTTP | User message (example)                                       |
|-------------------------|------|--------------------------------------------------------------|
| `validation_failed`     | 400  | "Some of the fields you sent were malformed."                |
| `message_too_long`      | 400  | "That message is too long. Please shorten and try again."    |
| `rate_limited`          | 429  | "You're sending messages too quickly. Try again in a moment."|
| `retrieval_unavailable` | 503  | "Having trouble reaching the catalog. Please try again."     |
| `model_unavailable`     | 503  | "The assistant is offline for a moment. Please try again."   |
| `host_api_unreachable`  | 503  | "I can't reach the store right now to help with that."       |
| `internal_error`        | 500  | "Something went wrong on our side."                           |

---

## 8. Health endpoint

- **Method**: `GET`
- **Path**: `/health`
- **Success**: `200` with body `{ "status": "ok" }` **only** when the
  pgvector connection can execute `SELECT 1` in < 250 ms.
- **Failure**: `503` with body `{ "status": "degraded", "reason":
  "postgres_unreachable" }`. Docker's health check consumes this
  endpoint.
- Never hits Anthropic; health must be local-state-only so transient
  model outages do not fail liveness.

---

## 9. Configuration surface

All configuration is environment-variable driven. The backend logs the
resolved values (with secrets redacted) at startup.

| Variable                         | Default                               | Purpose                                    |
|----------------------------------|---------------------------------------|--------------------------------------------|
| `PORT`                           | `3100`                                | Listen port.                               |
| `DATABASE_URL`                   | (required)                            | pgvector connection.                       |
| `ANTHROPIC_API_KEY`              | (required)                            | Opus key.                                  |
| `ALLOWED_ORIGINS`                | (required, comma-separated)           | CORS allowlist.                            |
| `HOST_API_BASE_URL`              | (required for safe-read tools)        | Where `lib/tool-execution.ts` calls.       |
| `HOST_API_KEY`                   | unset                                 | Server-side key for safe-read tools.       |
| `RETRIEVAL_SIMILARITY_THRESHOLD` | `0.55`                                | pgvector filter.                           |
| `RETRIEVAL_TOP_K`                | `8`                                   | pgvector LIMIT.                            |
| `MAX_CONVERSATION_TURNS`         | `20`                                  | History cap.                               |
| `MAX_TOOL_CALLS_PER_TURN`        | `5`                                   | Opus loop cap.                             |
| `RATE_LIMIT_MAX`                 | `60`                                  | Requests per window.                       |
| `RATE_LIMIT_WINDOW_MS`           | `600000` (10 min)                     | Window length.                             |
| `LOG_LEVEL`                      | `info` (prod) / `debug` (dev)         | pino level.                                |
| `NODE_ENV`                       | (container sets `production`)         | Toggles pino-pretty.                       |

Missing required variables at startup → backend logs a clear error
and exits 3. `/v1/chat` never returns on a misconfigured backend.

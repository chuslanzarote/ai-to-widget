/**
 * Feature 008 / T035 — Anthropic message-trio reconstruction.
 *
 * The widget's `ConversationTurn.content` is `string`-only. When the
 * widget posts back a `tool_result`, the backend must synthesize the
 * prior assistant `tool_use` turn (which it never received in typed
 * form) so Anthropic sees a well-formed
 *   [user, assistant:tool_use, user:tool_result]
 * sequence. This module is pure and stateless so both the handler and
 * contract tests can call it without touching Fastify or pg.
 *
 * Contract: specs/008-atw-hardening/contracts/chat-endpoint-v3.md
 *   §Backend message-sequence reconstruction.
 */
import type { AnthropicMessages } from "./opus-client.js";
import type { ToolResultPayload } from "../_shared/types.js";

export interface AssembleToolResultMessagesInput {
  /** The widget's trimmed history — role + string content only. */
  history: Array<{ role: "user" | "assistant"; content: string }>;
  /** The v3 `tool_result` payload, including `tool_name` and `tool_input`. */
  toolResult: ToolResultPayload;
}

export function assembleToolResultMessages(
  input: AssembleToolResultMessagesInput,
): AnthropicMessages {
  const messages: AnthropicMessages = input.history.map((t) => ({
    role: t.role,
    content: t.content,
  }));

  // Synthesize the assistant tool_use turn the widget never sent.
  messages.push({
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: input.toolResult.tool_use_id,
        name: input.toolResult.tool_name,
        input: input.toolResult.tool_input,
      },
    ],
  });

  // Append the tool_result as the next user turn.
  messages.push({
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: input.toolResult.tool_use_id,
        content: input.toolResult.content,
        is_error: input.toolResult.is_error,
      },
    ],
  });

  return messages;
}

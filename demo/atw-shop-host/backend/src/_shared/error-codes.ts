/**
 * Feature 003 — runtime error-code vocabulary.
 * Source: specs/003-runtime/contracts/chat-endpoint.md §7.
 */
export const RUNTIME_ERROR_CODES = [
  "validation_failed",
  "message_too_long",
  "rate_limited",
  "retrieval_unavailable",
  "model_unavailable",
  "host_api_unreachable",
  "internal_error",
] as const;

export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number];

export interface RuntimeErrorBody {
  error_code: RuntimeErrorCode;
  message: string;
  request_id: string;
}

export const DEFAULT_RUNTIME_ERROR_MESSAGES: Record<RuntimeErrorCode, string> = {
  validation_failed: "Some of the fields you sent were malformed.",
  message_too_long: "That message is too long. Please shorten and try again.",
  rate_limited: "You're sending messages too quickly. Try again in a moment.",
  retrieval_unavailable: "Having trouble reaching the catalog. Please try again.",
  model_unavailable: "The assistant is offline for a moment. Please try again.",
  host_api_unreachable: "I can't reach the store right now to help with that.",
  internal_error: "Something went wrong on our side.",
};

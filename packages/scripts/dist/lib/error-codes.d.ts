/**
 * Feature 003 — runtime error-code vocabulary.
 * Source: specs/003-runtime/contracts/chat-endpoint.md §7.
 */
export declare const RUNTIME_ERROR_CODES: readonly ["validation_failed", "message_too_long", "tool_not_allowed", "rate_limited", "retrieval_unavailable", "model_unavailable", "host_api_unreachable", "internal_error"];
export type RuntimeErrorCode = (typeof RUNTIME_ERROR_CODES)[number];
export interface RuntimeErrorBody {
    error_code: RuntimeErrorCode;
    message: string;
    request_id: string;
}
export declare const DEFAULT_RUNTIME_ERROR_MESSAGES: Record<RuntimeErrorCode, string>;
//# sourceMappingURL=error-codes.d.ts.map
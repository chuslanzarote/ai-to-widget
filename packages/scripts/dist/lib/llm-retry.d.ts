/**
 * Exponential-backoff retry helper for LLM calls. Implements the policy
 * decided in Feature 009 Q2 (research.md R4): 3 attempts, 500 ms initial,
 * 2× multiplier, ±20% jitter seeded from `(model_snapshot + input_hash)`
 * for reproducibility (Constitution VIII).
 *
 * Retryable: network/timeout/408/429/500/502/503/504.
 * Non-retryable: 400/401/403/404 and post-call zod-validation failures
 * (FR-008a explicitly excludes structural-output drift from retry).
 */
export interface RetryOptions {
    attempts?: number;
    initialDelayMs?: number;
    multiplier?: number;
    jitterPct?: number;
    /** Seed source: typically `model_snapshot + input_hash`. */
    seed: string;
}
export interface RetryAttempt {
    attempt: number;
    /** Delay in ms applied before this attempt (0 for first attempt). */
    delayMs: number;
    /** Error message captured if the attempt failed; undefined on success. */
    error?: string;
    /** True when the error was classified as non-retryable (loop short-circuits). */
    fatal?: boolean;
}
export interface RetryResult<T> {
    value: T;
    attempts: RetryAttempt[];
}
export declare class LLMRetryError extends Error {
    readonly attempts: RetryAttempt[];
    readonly cause: unknown;
    constructor(attempts: RetryAttempt[], cause: unknown);
}
export declare function isRetryableError(err: unknown): boolean;
export declare function computeDelayMs(attemptIndex: number, opts: {
    initialDelayMs: number;
    multiplier: number;
    jitterPct: number;
    seed: string;
}): number;
export declare function withLLMRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<RetryResult<T>>;
//# sourceMappingURL=llm-retry.d.ts.map
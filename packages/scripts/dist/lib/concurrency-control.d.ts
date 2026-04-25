/**
 * T099 / US9 — Dynamic concurrency controller for the Opus enrichment
 * loop.
 *
 * Responsibilities:
 *   1. Enforce a dynamic cap on in-flight Opus calls (a simple async
 *      semaphore whose ceiling can drop at runtime).
 *   2. Observe HTTP status codes surfaced by `callWithHttpRetries` and
 *      track a rolling count of consecutive 429s.
 *   3. When the threshold (default 3) of consecutive 429s is hit at the
 *      default max (10), lower the ceiling to 3 and record a structured
 *      reduction entry for the manifest (contracts/manifest.md §2.7).
 *   4. When the threshold is hit at the reduced max (3), raise a halt
 *      flag so the orchestrator throws `OPUS_RATE_LIMIT` and writes a
 *      failed manifest (contracts/enrichment.md §5).
 *
 * The controller is deliberately pure-logic so it can be unit tested
 * (T101) without spinning up a real Opus client or Postgres.
 */
export interface Reduction {
    /** ISO-8601 timestamp of when the reduction fired. */
    at: string;
    /** Max in-flight cap before the reduction. */
    from: number;
    /** Max in-flight cap after the reduction. */
    to: number;
    /** Short machine-readable reason. */
    reason: string;
}
export interface ConcurrencyControllerOptions {
    initial: number;
    /** Lowered cap after sustained 429s. Default 3. */
    reducedTo?: number;
    /** Consecutive 429s that trigger a reduction / halt. Default 3. */
    threshold?: number;
    /** Clock hook for deterministic tests. */
    now?: () => Date;
}
/**
 * A single-threaded (single-event-loop) async semaphore whose ceiling
 * can be lowered while work is in flight. Lowering does not preempt
 * already-running tasks — it only prevents new acquires until releases
 * bring the in-flight count below the new max.
 */
export declare class DynamicGate {
    private _max;
    private active;
    private waiters;
    constructor(initial: number);
    get max(): number;
    get inFlight(): number;
    acquire(): Promise<void>;
    release(): void;
    /** Lower (or raise) the cap. Safe to call at any time. */
    setMax(n: number): void;
}
/**
 * ConcurrencyController wraps a DynamicGate with the 429-observing
 * policy described in `contracts/enrichment.md §5` and `contracts/
 * manifest.md §2.7`.
 */
export declare class ConcurrencyController {
    readonly initial: number;
    readonly reducedTo: number;
    readonly threshold: number;
    private now;
    readonly gate: DynamicGate;
    private consecutive429;
    private _halt;
    private _reductions;
    constructor(opts: ConcurrencyControllerOptions);
    get effectiveMax(): number;
    get halt(): boolean;
    get reductions(): ReadonlyArray<Reduction>;
    get consecutive429Count(): number;
    /**
     * Call with every observed HTTP status from the Opus SDK. A 429 bumps
     * the consecutive counter; any non-429 (including success 200) resets
     * it. When the counter reaches the threshold we either reduce the
     * effective max or raise the halt flag.
     */
    onHttpStatus(status: number): void;
}
//# sourceMappingURL=concurrency-control.d.ts.map
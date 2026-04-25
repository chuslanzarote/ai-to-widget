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
/**
 * A single-threaded (single-event-loop) async semaphore whose ceiling
 * can be lowered while work is in flight. Lowering does not preempt
 * already-running tasks — it only prevents new acquires until releases
 * bring the in-flight count below the new max.
 */
export class DynamicGate {
    _max;
    active = 0;
    waiters = [];
    constructor(initial) {
        if (!Number.isInteger(initial) || initial < 1) {
            throw new Error("DynamicGate initial must be a positive integer");
        }
        this._max = initial;
    }
    get max() {
        return this._max;
    }
    get inFlight() {
        return this.active;
    }
    async acquire() {
        if (this.active < this._max) {
            this.active += 1;
            return;
        }
        await new Promise((resolve) => this.waiters.push(resolve));
    }
    release() {
        this.active -= 1;
        // Only wake the next waiter if the current limit still allows it.
        while (this.waiters.length > 0 && this.active < this._max) {
            const next = this.waiters.shift();
            this.active += 1;
            next();
        }
    }
    /** Lower (or raise) the cap. Safe to call at any time. */
    setMax(n) {
        if (!Number.isInteger(n) || n < 1) {
            throw new Error("DynamicGate max must be a positive integer");
        }
        this._max = n;
        while (this.waiters.length > 0 && this.active < this._max) {
            const next = this.waiters.shift();
            this.active += 1;
            next();
        }
    }
}
/**
 * ConcurrencyController wraps a DynamicGate with the 429-observing
 * policy described in `contracts/enrichment.md §5` and `contracts/
 * manifest.md §2.7`.
 */
export class ConcurrencyController {
    initial;
    reducedTo;
    threshold;
    now;
    gate;
    consecutive429 = 0;
    _halt = false;
    _reductions = [];
    constructor(opts) {
        this.initial = opts.initial;
        this.reducedTo = opts.reducedTo ?? 3;
        this.threshold = opts.threshold ?? 3;
        this.now = opts.now ?? (() => new Date());
        this.gate = new DynamicGate(opts.initial);
    }
    get effectiveMax() {
        return this.gate.max;
    }
    get halt() {
        return this._halt;
    }
    get reductions() {
        return this._reductions;
    }
    get consecutive429Count() {
        return this.consecutive429;
    }
    /**
     * Call with every observed HTTP status from the Opus SDK. A 429 bumps
     * the consecutive counter; any non-429 (including success 200) resets
     * it. When the counter reaches the threshold we either reduce the
     * effective max or raise the halt flag.
     */
    onHttpStatus(status) {
        if (status === 429) {
            this.consecutive429 += 1;
            if (this.consecutive429 >= this.threshold) {
                if (this.gate.max > this.reducedTo) {
                    // First trip: lower the ceiling.
                    const from = this.gate.max;
                    this.gate.setMax(this.reducedTo);
                    this._reductions.push({
                        at: this.now().toISOString(),
                        from,
                        to: this.reducedTo,
                        reason: "sustained_429",
                    });
                    this.consecutive429 = 0;
                }
                else {
                    // Already at reduced ceiling — escalate to halt.
                    this._halt = true;
                }
            }
            return;
        }
        // Any other status is evidence the rate-limit pressure has eased.
        this.consecutive429 = 0;
    }
}
//# sourceMappingURL=concurrency-control.js.map
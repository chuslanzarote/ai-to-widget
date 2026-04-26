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
export class DynamicGate {
  private _max: number;
  private active = 0;
  private waiters: Array<() => void> = [];

  constructor(initial: number) {
    if (!Number.isInteger(initial) || initial < 1) {
      throw new Error("DynamicGate initial must be a positive integer");
    }
    this._max = initial;
  }

  get max(): number {
    return this._max;
  }

  get inFlight(): number {
    return this.active;
  }

  async acquire(): Promise<void> {
    if (this.active < this._max) {
      this.active += 1;
      return;
    }
    await new Promise<void>((resolve) => this.waiters.push(resolve));
  }

  release(): void {
    this.active -= 1;
    // Only wake the next waiter if the current limit still allows it.
    while (this.waiters.length > 0 && this.active < this._max) {
      const next = this.waiters.shift()!;
      this.active += 1;
      next();
    }
  }

  /** Lower (or raise) the cap. Safe to call at any time. */
  setMax(n: number): void {
    if (!Number.isInteger(n) || n < 1) {
      throw new Error("DynamicGate max must be a positive integer");
    }
    this._max = n;
    while (this.waiters.length > 0 && this.active < this._max) {
      const next = this.waiters.shift()!;
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
  readonly initial: number;
  readonly reducedTo: number;
  readonly threshold: number;
  private now: () => Date;

  readonly gate: DynamicGate;
  private consecutive429 = 0;
  private _halt = false;
  private _reductions: Reduction[] = [];

  constructor(opts: ConcurrencyControllerOptions) {
    this.initial = opts.initial;
    this.reducedTo = opts.reducedTo ?? 3;
    this.threshold = opts.threshold ?? 3;
    this.now = opts.now ?? (() => new Date());
    this.gate = new DynamicGate(opts.initial);
  }

  get effectiveMax(): number {
    return this.gate.max;
  }

  get halt(): boolean {
    return this._halt;
  }

  get reductions(): ReadonlyArray<Reduction> {
    return this._reductions;
  }

  get consecutive429Count(): number {
    return this.consecutive429;
  }

  /**
   * Call with every observed HTTP status from the Opus SDK. A 429 bumps
   * the consecutive counter; any non-429 (including success 200) resets
   * it. When the counter reaches the threshold we either reduce the
   * effective max or raise the halt flag.
   */
  onHttpStatus(status: number): void {
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
        } else {
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

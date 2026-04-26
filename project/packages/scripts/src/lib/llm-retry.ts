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

import { createHash } from "node:crypto";

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

export class LLMRetryError extends Error {
  constructor(
    public readonly attempts: RetryAttempt[],
    public readonly cause: unknown,
  ) {
    const last = attempts[attempts.length - 1];
    super(
      `LLM call failed after ${attempts.length} attempt(s): ${last?.error ?? String(cause)}`,
    );
    this.name = "LLMRetryError";
  }
}

const DEFAULTS = {
  attempts: 3,
  initialDelayMs: 500,
  multiplier: 2,
  jitterPct: 0.2,
} as const;

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);
const NON_RETRYABLE_STATUS = new Set([400, 401, 403, 404]);

export function isRetryableError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { status?: number; code?: string; name?: string; message?: string };
  if (typeof e.status === "number") {
    if (NON_RETRYABLE_STATUS.has(e.status)) return false;
    if (RETRYABLE_STATUS.has(e.status)) return true;
  }
  // Network/timeout patterns surfaced by node-fetch / undici / Anthropic SDK.
  const code = e.code ?? "";
  if (
    code === "ECONNRESET" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT" ||
    code === "EAI_AGAIN" ||
    code === "ENOTFOUND"
  ) {
    return true;
  }
  const name = e.name ?? "";
  if (name === "AbortError" || name === "FetchError" || name === "TimeoutError") {
    return true;
  }
  // Zod validation errors are deterministic — never retry.
  if (name === "ZodError") return false;
  return false;
}

/**
 * Deterministic jitter in [-jitterPct, +jitterPct] derived from
 * `seed + attemptIndex`. Same seed → same sequence → reproducible reruns.
 */
function jitterFor(seed: string, attemptIndex: number, jitterPct: number): number {
  const h = createHash("sha256").update(`${seed}|${attemptIndex}`).digest();
  // First 4 bytes → [0, 1)
  const r = h.readUInt32BE(0) / 0x1_0000_0000;
  // Map [0, 1) → [-jitterPct, +jitterPct]
  return (r * 2 - 1) * jitterPct;
}

export function computeDelayMs(
  attemptIndex: number,
  opts: { initialDelayMs: number; multiplier: number; jitterPct: number; seed: string },
): number {
  if (attemptIndex === 0) return 0;
  const base = opts.initialDelayMs * Math.pow(opts.multiplier, attemptIndex - 1);
  const factor = 1 + jitterFor(opts.seed, attemptIndex, opts.jitterPct);
  return Math.max(0, Math.round(base * factor));
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    if (ms <= 0) {
      resolve();
      return;
    }
    setTimeout(resolve, ms);
  });

export async function withLLMRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions,
): Promise<RetryResult<T>> {
  const attempts: RetryAttempt[] = [];
  const cfg = {
    attempts: opts.attempts ?? DEFAULTS.attempts,
    initialDelayMs: opts.initialDelayMs ?? DEFAULTS.initialDelayMs,
    multiplier: opts.multiplier ?? DEFAULTS.multiplier,
    jitterPct: opts.jitterPct ?? DEFAULTS.jitterPct,
    seed: opts.seed,
  };

  let lastErr: unknown = null;
  for (let i = 0; i < cfg.attempts; i++) {
    const delayMs = computeDelayMs(i, cfg);
    if (delayMs > 0) await sleep(delayMs);
    try {
      const value = await fn();
      attempts.push({ attempt: i + 1, delayMs });
      return { value, attempts };
    } catch (err) {
      lastErr = err;
      const retryable = isRetryableError(err);
      attempts.push({
        attempt: i + 1,
        delayMs,
        error: (err as Error)?.message ?? String(err),
        fatal: !retryable,
      });
      if (!retryable) break;
    }
  }
  throw new LLMRetryError(attempts, lastErr);
}

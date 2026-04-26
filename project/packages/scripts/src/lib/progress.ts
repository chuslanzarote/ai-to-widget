import { PipelineProgress } from "./types.js";

/**
 * Formatter and throttle for the orchestrator's `[PHASE] …` lines.
 *
 * Contract: FR-053 / plan Quickstart §3 — progress MUST be visible at least
 * every 5 entities OR every 10 seconds, whichever comes first.
 */

export interface ProgressReporterOptions {
  everyNEntities?: number;
  everyMillis?: number;
  writer?: (line: string) => void;
}

export class ProgressReporter {
  private readonly everyN: number;
  private readonly everyMs: number;
  private readonly write: (line: string) => void;
  private lastEmittedAt = 0;
  private lastEmittedAtProcessed = -1;

  constructor(opts: ProgressReporterOptions = {}) {
    this.everyN = opts.everyNEntities ?? 5;
    this.everyMs = opts.everyMillis ?? 10_000;
    this.write = opts.writer ?? ((line) => process.stdout.write(line + "\n"));
  }

  /**
   * Emit progress if the cadence rule fires. Always emits on phase
   * transition (processed === 0) and on completion (processed === total).
   */
  report(p: PipelineProgress, nowMs: number = Date.now()): void {
    const dueByCount = p.processed - this.lastEmittedAtProcessed >= this.everyN;
    const dueByTime = nowMs - this.lastEmittedAt >= this.everyMs;
    const phaseStartOrEnd =
      p.processed === 0 || (p.total > 0 && p.processed === p.total);

    if (!dueByCount && !dueByTime && !phaseStartOrEnd) return;
    this.lastEmittedAt = nowMs;
    this.lastEmittedAtProcessed = p.processed;
    this.write(formatLine(p));
  }

  /**
   * Force-emit regardless of cadence — used for banners like `[BOOT]`,
   * `[DONE]`, `[ABORT]`.
   */
  banner(p: PipelineProgress): void {
    this.lastEmittedAt = Date.now();
    this.lastEmittedAtProcessed = p.processed;
    this.write(formatLine(p));
  }
}

export function formatLine(p: PipelineProgress): string {
  const tag = `[${p.phase.padEnd(8)}]`;
  if (p.message) {
    return `${tag} ${p.message}`;
  }
  const progressStr = `${pad(p.processed, String(p.total).length)}/${p.total}`;
  const cost = `$${p.cost_usd.toFixed(2)}`;
  const elapsed = formatMmSs(p.elapsed_seconds);
  const eta = p.eta_seconds === null ? "  —  " : formatMmSs(p.eta_seconds);
  return `${tag} ${progressStr}   ✓ ${pad(p.ok, 3)}  ⊙ ${pad(p.skipped, 2)}  ✗ ${pad(p.failed, 2)}   ${cost}   ${elapsed} elapsed   ETA ${eta}`;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

function formatMmSs(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

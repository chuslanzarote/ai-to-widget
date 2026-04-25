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
export declare class ProgressReporter {
    private readonly everyN;
    private readonly everyMs;
    private readonly write;
    private lastEmittedAt;
    private lastEmittedAtProcessed;
    constructor(opts?: ProgressReporterOptions);
    /**
     * Emit progress if the cadence rule fires. Always emits on phase
     * transition (processed === 0) and on completion (processed === total).
     */
    report(p: PipelineProgress, nowMs?: number): void;
    /**
     * Force-emit regardless of cadence — used for banners like `[BOOT]`,
     * `[DONE]`, `[ABORT]`.
     */
    banner(p: PipelineProgress): void;
}
export declare function formatLine(p: PipelineProgress): string;
//# sourceMappingURL=progress.d.ts.map
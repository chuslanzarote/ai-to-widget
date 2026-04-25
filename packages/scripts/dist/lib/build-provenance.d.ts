/**
 * Append-only writer for `.atw/artifacts/build-provenance.json` (FR-028,
 * FR-031, E3). Every phase of `/atw.build` records one
 * `BuildProvenanceEntry`; the orchestrator reads previous entries to honour
 * the (input_hashes, model_snapshot) cache (FR-008b) and to print the
 * status-aware end-of-run summary (FR-028 status taxonomy).
 *
 * The schema lives in `lib/schemas/build-provenance.ts`. This module is the
 * I/O layer plus a couple of builder-style ergonomic helpers used at phase
 * boundaries inside `orchestrator.ts`.
 */
import { type BuildProvenanceEntry, type BuildPhase, type BuildPhaseStatus } from "./schemas/build-provenance.js";
export declare const DEFAULT_PROVENANCE_PATH = ".atw/artifacts/build-provenance.json";
export interface ProvenanceFile {
    schema_version: "1.0";
    entries: BuildProvenanceEntry[];
}
export declare function provenancePath(projectRoot: string): string;
export declare function readProvenance(projectRoot: string): ProvenanceFile;
/**
 * Validates `entry` and append-writes it. If the file is missing or
 * structurally broken (recovery failed in `readProvenance`) we re-create it
 * from scratch so a corrupted prior run does not block today's build.
 */
export declare function appendProvenance(projectRoot: string, entry: BuildProvenanceEntry): Promise<void>;
/**
 * Lookup the most-recent SUCCESSFUL entry for `(phase, modelSnapshot,
 * inputHashes)`. Used by FR-008b: when current inputs and snapshot match a
 * prior `success` entry we mark the phase `success_cached` and skip it.
 * Failed runs MUST NOT be cached (they will not match here because we only
 * search `success`).
 */
export declare function findCachedSuccess(projectRoot: string, phase: BuildPhase, inputHashes: Record<string, string>, modelSnapshot?: string): BuildProvenanceEntry | null;
/**
 * Builder used at every phase boundary in `orchestrator.ts`:
 *
 *   const rec = startPhase("CLASSIFY", buildId);
 *   try {
 *     ...
 *     await rec.finishSuccess({ ... });
 *   } catch (err) {
 *     await rec.finishFailed({ failed_reason: ..., next_hint: ... });
 *   }
 */
export interface PhaseRecorder {
    readonly phase: BuildPhase;
    readonly buildId: string;
    readonly startedAt: string;
    finish(projectRoot: string, overrides: Partial<Omit<BuildProvenanceEntry, "phase" | "build_id" | "started_at" | "finished_at">> & {
        status: BuildPhaseStatus;
    }): Promise<BuildProvenanceEntry>;
}
export declare function startPhase(phase: BuildPhase, buildId: string): PhaseRecorder;
/**
 * Status-aware end-of-run summary (FR-028). Returns a multi-line string the
 * orchestrator prints once after the final phase.
 *
 * - `✅ Build complete.` only when every entry for `buildId` is `success`
 *   or `success_cached`.
 * - Otherwise `⚠ Build complete with N <issue>(s):` followed by per-phase
 *   `[PHASE] status — reason · hint: <next_hint>` lines.
 */
export declare function summarize(entries: BuildProvenanceEntry[], buildId: string): string;
//# sourceMappingURL=build-provenance.d.ts.map
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

import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  BuildProvenanceEntrySchema,
  type BuildProvenanceEntry,
  type BuildPhase,
  type BuildPhaseStatus,
} from "./schemas/build-provenance.js";

export const DEFAULT_PROVENANCE_PATH = ".atw/artifacts/build-provenance.json";

export interface ProvenanceFile {
  schema_version: "1.0";
  entries: BuildProvenanceEntry[];
}

export function provenancePath(projectRoot: string): string {
  return path.join(projectRoot, DEFAULT_PROVENANCE_PATH);
}

export function readProvenance(projectRoot: string): ProvenanceFile {
  const abs = provenancePath(projectRoot);
  if (!existsSync(abs)) {
    return { schema_version: "1.0", entries: [] };
  }
  try {
    const raw = readFileSync(abs, "utf8");
    const parsed = JSON.parse(raw) as ProvenanceFile;
    if (!parsed || !Array.isArray(parsed.entries)) {
      return { schema_version: "1.0", entries: [] };
    }
    return parsed;
  } catch {
    return { schema_version: "1.0", entries: [] };
  }
}

/**
 * Validates `entry` and append-writes it. If the file is missing or
 * structurally broken (recovery failed in `readProvenance`) we re-create it
 * from scratch so a corrupted prior run does not block today's build.
 */
export async function appendProvenance(
  projectRoot: string,
  entry: BuildProvenanceEntry,
): Promise<void> {
  const validated = BuildProvenanceEntrySchema.parse(entry);
  const file = readProvenance(projectRoot);
  file.entries.push(validated);
  const abs = provenancePath(projectRoot);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, JSON.stringify(file, null, 2) + "\n", "utf8");
}

/**
 * Lookup the most-recent SUCCESSFUL entry for `(phase, modelSnapshot,
 * inputHashes)`. Used by FR-008b: when current inputs and snapshot match a
 * prior `success` entry we mark the phase `success_cached` and skip it.
 * Failed runs MUST NOT be cached (they will not match here because we only
 * search `success`).
 */
export function findCachedSuccess(
  projectRoot: string,
  phase: BuildPhase,
  inputHashes: Record<string, string>,
  modelSnapshot?: string,
): BuildProvenanceEntry | null {
  const file = readProvenance(projectRoot);
  for (let i = file.entries.length - 1; i >= 0; i--) {
    const e = file.entries[i];
    if (e.phase !== phase) continue;
    if (e.status !== "success") continue;
    if (modelSnapshot && e.model_snapshot !== modelSnapshot) continue;
    if (!hashesEqual(e.input_hashes ?? {}, inputHashes)) continue;
    return e;
  }
  return null;
}

function hashesEqual(a: Record<string, string>, b: Record<string, string>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

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
  finish(
    projectRoot: string,
    overrides: Partial<Omit<BuildProvenanceEntry, "phase" | "build_id" | "started_at" | "finished_at">> & {
      status: BuildPhaseStatus;
    },
  ): Promise<BuildProvenanceEntry>;
}

export function startPhase(phase: BuildPhase, buildId: string): PhaseRecorder {
  const startedAt = new Date().toISOString();
  return {
    phase,
    buildId,
    startedAt,
    async finish(projectRoot, overrides) {
      const entry: BuildProvenanceEntry = BuildProvenanceEntrySchema.parse({
        build_id: buildId,
        phase,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...overrides,
      });
      await appendProvenance(projectRoot, entry);
      return entry;
    },
  };
}

/**
 * Status-aware end-of-run summary (FR-028). Returns a multi-line string the
 * orchestrator prints once after the final phase.
 *
 * - `✅ Build complete.` only when every entry for `buildId` is `success`
 *   or `success_cached`.
 * - Otherwise `⚠ Build complete with N <issue>(s):` followed by per-phase
 *   `[PHASE] status — reason · hint: <next_hint>` lines.
 */
export function summarize(entries: BuildProvenanceEntry[], buildId: string): string {
  const own = entries.filter((e) => e.build_id === buildId);
  if (own.length === 0) {
    return "✅ Build complete.";
  }
  const issues = own.filter(
    (e) => e.status !== "success" && e.status !== "success_cached",
  );
  if (issues.length === 0) {
    return "✅ Build complete.";
  }
  const lines: string[] = [
    `⚠ Build complete with ${issues.length} ${issues.length === 1 ? "issue" : "issues"}:`,
  ];
  for (const e of issues) {
    const reason =
      e.status === "failed"
        ? e.failed_reason
        : e.status === "skipped"
          ? e.skipped_reason
          : (e.warnings ?? []).join("; ") || null;
    const hint = e.next_hint ? ` · hint: ${e.next_hint}` : "";
    lines.push(
      `  [${e.phase}] ${e.status}${reason ? ` — ${reason}` : ""}${hint}`,
    );
  }
  return lines.join("\n");
}

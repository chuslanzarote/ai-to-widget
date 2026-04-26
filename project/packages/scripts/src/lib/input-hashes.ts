/**
 * Read/write `.atw/state/input-hashes.json` for the Build Pipeline (Feature
 * 002). A successful build writes the current hashes; the next build reads
 * them to decide whether anything has changed (US5 incremental rebuild) and
 * to resume via `source_hash` (US3).
 *
 * This is *not* the generic Feature-001 `atw-hash-inputs` CLI — it is a
 * focused flat-record store for the five authored artifacts + the one SQL
 * dump + the prompt template version string.
 *
 * Contract: data-model.md §3.3, plan.md `.atw/state/input-hashes.json`.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";

export interface InputHashes {
  schema_version: "1";
  /** Path-relative-to-projectRoot → `sha256:<hex>` */
  files: Record<string, string>;
  /** Captured verbatim so changing template_version forces re-enrichment */
  prompt_template_version: string;
}

const TRACKED_ARTIFACTS = [
  ".atw/config/project.md",
  ".atw/config/brief.md",
  ".atw/artifacts/schema-map.md",
  ".atw/artifacts/action-manifest.md",
  ".atw/artifacts/build-plan.md",
  // Feature 006 — OpenAPI is a first-class input artefact. Its hash
  // participates in the RENDER-cache decision the same way
  // action-manifest.md does, per data-model.md §4.
  ".atw/artifacts/openapi.json",
] as const;

export const DEFAULT_INPUT_HASHES_PATH = ".atw/state/input-hashes.json";

export function computeInputHashes(
  projectRoot: string,
  sqlDumpRelPath: string | null,
  promptTemplateVersion: string,
): InputHashes {
  const files: Record<string, string> = {};
  for (const rel of TRACKED_ARTIFACTS) {
    const abs = join(projectRoot, rel);
    if (existsSync(abs)) files[rel] = sha256File(abs);
  }
  if (sqlDumpRelPath) {
    const abs = join(projectRoot, sqlDumpRelPath);
    if (existsSync(abs)) files[sqlDumpRelPath] = sha256File(abs);
  }
  return {
    schema_version: "1",
    files,
    prompt_template_version: promptTemplateVersion,
  };
}

export function readInputHashes(projectRoot: string): InputHashes | null {
  const abs = join(projectRoot, DEFAULT_INPUT_HASHES_PATH);
  if (!existsSync(abs)) return null;
  try {
    const parsed = JSON.parse(readFileSync(abs, "utf8")) as InputHashes;
    if (parsed.schema_version !== "1") return null;
    if (!parsed.files || typeof parsed.files !== "object") return null;
    if (typeof parsed.prompt_template_version !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function writeInputHashes(
  projectRoot: string,
  hashes: InputHashes,
): Promise<void> {
  const abs = join(projectRoot, DEFAULT_INPUT_HASHES_PATH);
  await fs.mkdir(dirname(abs), { recursive: true });
  const tmp = abs + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(hashes, null, 2) + "\n", "utf8");
  await fs.rename(tmp, abs);
}

/**
 * Compare two hash snapshots. Returns:
 *   - `changedKeys`: files whose hash differs (includes files added/removed)
 *   - `promptVersionChanged`: true if `prompt_template_version` changed
 *   - `sameTotal`: true iff all hashes + version match exactly
 */
export function diffInputHashes(
  prior: InputHashes | null,
  current: InputHashes,
): { changedKeys: string[]; promptVersionChanged: boolean; sameTotal: boolean } {
  if (!prior) {
    return {
      changedKeys: Object.keys(current.files),
      promptVersionChanged: true,
      sameTotal: false,
    };
  }
  const changed: string[] = [];
  const all = new Set<string>([
    ...Object.keys(prior.files),
    ...Object.keys(current.files),
  ]);
  for (const k of all) {
    if (prior.files[k] !== current.files[k]) changed.push(k);
  }
  const promptVersionChanged =
    prior.prompt_template_version !== current.prompt_template_version;
  return {
    changedKeys: changed,
    promptVersionChanged,
    sameTotal: changed.length === 0 && !promptVersionChanged,
  };
}

function sha256File(abs: string): string {
  const h = createHash("sha256").update(readFileSync(abs)).digest("hex");
  return "sha256:" + h;
}

/**
 * Feature 005 / T032 — roll up per-file hashes from the rendered+seeded+
 * vendored `backend/` tree into a single deterministic sha256 so the next
 * run can short-circuit the IMAGE step when nothing under `backend/`
 * changed. Input is the `backend_files[]` array carried by the manifest
 * (or any `{path, sha256}[]` with `backend/`-prefixed paths).
 *
 * Determinism: paths are sorted byte-wise; each entry is joined as
 * `path:sha256` on its own `\n`-terminated line; the final hash is the
 * sha256 of the UTF-8 bytes of that text. Re-running the build on
 * unchanged inputs yields the same rollup.
 */
export function computeBackendSourceTree(
  entries: ReadonlyArray<{ path: string; sha256: string }>,
): string {
  const filtered = entries
    .filter((e) => e.path.startsWith("backend/"))
    .map((e) => ({ path: e.path, sha256: e.sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const lines = filtered.map((e) => `${e.path}:${e.sha256}`).join("\n");
  const body = lines.length === 0 ? "" : lines + "\n";
  const h = createHash("sha256").update(body, "utf8").digest("hex");
  return "sha256:" + h;
}

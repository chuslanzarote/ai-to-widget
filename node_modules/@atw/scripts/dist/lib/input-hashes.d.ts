export interface InputHashes {
    schema_version: "1";
    /** Path-relative-to-projectRoot → `sha256:<hex>` */
    files: Record<string, string>;
    /** Captured verbatim so changing template_version forces re-enrichment */
    prompt_template_version: string;
}
export declare const DEFAULT_INPUT_HASHES_PATH = ".atw/state/input-hashes.json";
export declare function computeInputHashes(projectRoot: string, sqlDumpRelPath: string | null, promptTemplateVersion: string): InputHashes;
export declare function readInputHashes(projectRoot: string): InputHashes | null;
export declare function writeInputHashes(projectRoot: string, hashes: InputHashes): Promise<void>;
/**
 * Compare two hash snapshots. Returns:
 *   - `changedKeys`: files whose hash differs (includes files added/removed)
 *   - `promptVersionChanged`: true if `prompt_template_version` changed
 *   - `sameTotal`: true iff all hashes + version match exactly
 */
export declare function diffInputHashes(prior: InputHashes | null, current: InputHashes): {
    changedKeys: string[];
    promptVersionChanged: boolean;
    sameTotal: boolean;
};
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
export declare function computeBackendSourceTree(entries: ReadonlyArray<{
    path: string;
    sha256: string;
}>): string;
//# sourceMappingURL=input-hashes.d.ts.map
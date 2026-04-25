/**
 * Dist-staleness gate (FR-032, R8). Each `bin/atw-X.js` shim invokes this
 * before importing compiled code. If any `src` TypeScript file's mtime is
 * newer than its `dist` JavaScript counterpart (or the `.js` artifact is
 * missing), the runner aborts with the message:
 *
 *   [atw] dist/ is stale: src/<file>.ts modified after dist/<file>.js.
 *   [atw] Run `npm run build` and try again.
 *
 * The `ATW_SKIP_DIST_CHECK=1` env var bypasses the gate (escape hatch for
 * ATW maintainers running with `tsx`).
 */
export interface StalenessReport {
    stale: boolean;
    /** Source files newer than (or missing) their dist counterpart. */
    offendingFiles: string[];
}
export interface CheckOptions {
    packageRoot: string;
    srcDir?: string;
    distDir?: string;
}
export declare function checkDistStaleness(opts: CheckOptions): StalenessReport;
/**
 * Convenience wrapper used by the bin shims. Reads `ATW_SKIP_DIST_CHECK`
 * itself, prints the standard message, and exits non-zero on staleness.
 * No-ops when the gate is satisfied or skipped.
 */
export declare function enforceDistFreshness(opts: CheckOptions): void;
//# sourceMappingURL=dist-staleness.d.ts.map
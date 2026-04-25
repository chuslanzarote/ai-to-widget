/**
 * Feature 005 — files in `packages/scripts/src/lib/` that `vendorSharedLib()`
 * is allowed to copy into a Builder project's `backend/src/_shared/`.
 *
 * Adding a file here is a deliberate choice: it must be safe to ship inside
 * a distroless runtime image (no test-only deps, no dev tooling).
 */
export declare const SHARED_LIB_ALLOWLIST: readonly string[];
export declare function isAllowlisted(filename: string): boolean;
//# sourceMappingURL=_shared-lib-allowlist.d.ts.map
/**
 * Feature 005 — files in `packages/scripts/src/lib/` that `vendorSharedLib()`
 * is allowed to copy into a Builder project's `backend/src/_shared/`.
 *
 * Adding a file here is a deliberate choice: it must be safe to ship inside
 * a distroless runtime image (no test-only deps, no dev tooling).
 */
export const SHARED_LIB_ALLOWLIST: readonly string[] = [
  "runtime-config.ts",
  "runtime-pii-scrub.ts",
  "runtime-credential-strip.ts",
  "runtime-logger.ts",
  "types.ts",
  "error-codes.ts",
] as const;

export function isAllowlisted(filename: string): boolean {
  return SHARED_LIB_ALLOWLIST.includes(filename);
}

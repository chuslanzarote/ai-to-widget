import { BuildManifest } from "./types.js";
/**
 * Atomic JSON writer for build-manifest.json.
 *
 * Contract: contracts/manifest.md §3
 *
 *   1. Serialize with stable key order and 2-space indent
 *   2. Write to <target>.tmp
 *   3. fsync the temp file
 *   4. rename over the target
 *   5. fsync the parent directory
 *
 * On any failure the existing manifest (if any) is preserved.
 * A crashed write leaves either the previous file or no file at all.
 */
export declare function writeManifestAtomic(targetPath: string, manifest: BuildManifest): void;
export declare function readManifest(targetPath: string): BuildManifest | null;
/**
 * Forward-compatible migrator. Given an unknown manifest shape (possibly
 * from an older schema_version), upconvert to the current shape.
 *
 * For schema_version === "1" (the current version) this is the identity.
 * Future versions add cases.
 */
export declare function migrate(raw: unknown): unknown;
/**
 * Default path inside a project's .atw/state directory.
 */
export declare function defaultManifestPath(projectRoot: string): string;
import { type ActionManifest } from "./schemas/action-manifest.js";
export interface ReadActionManifestResult {
    manifest: ActionManifest;
    /** The free-form markdown body below the frontmatter. */
    body: string;
}
export declare class ActionManifestValidationError extends Error {
    readonly issues: ReadonlyArray<{
        path: string;
        message: string;
    }>;
    constructor(message: string, issues: ReadonlyArray<{
        path: string;
        message: string;
    }>);
}
export declare function readActionManifest(targetPath: string): ReadActionManifestResult;
export declare function writeActionManifest(targetPath: string, manifest: ActionManifest, body?: string): void;
//# sourceMappingURL=manifest-io.d.ts.map
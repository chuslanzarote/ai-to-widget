export interface WriteManifestResult {
    path: string;
    sha256: string;
}
export interface WriteManifestOptions {
    manifest: unknown;
    targetPath: string;
}
export declare function writeManifestCli(opts: WriteManifestOptions): WriteManifestResult;
/**
 * Write an action manifest (Feature 009 / FR-005, FR-007) via the
 * gray-matter round-trip helper. The header frontmatter (schema_version,
 * model_snapshot, input_hashes, counts) is enforced by
 * `ActionManifestSchema`; passing an invalid object surfaces field-level
 * issues at the call site.
 */
export declare function writeActionManifestCli(opts: WriteManifestOptions, body?: string): WriteManifestResult;
export declare function runWriteManifest(argv: string[]): Promise<number>;
//# sourceMappingURL=write-manifest.d.ts.map
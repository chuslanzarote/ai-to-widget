export type VendorAction = "unchanged" | "created" | "rewritten";
export interface VendoredFile {
    path: string;
    sha256: string;
    bytes: number;
    action: VendorAction;
    backup?: string;
}
export interface VendorSharedLibOptions {
    projectRoot: string;
    /** Override the source `packages/scripts/src/lib/` directory (tests). */
    sourceDir?: string;
    /** If provided, only vendor files whose `<name>.ts` is both in the
     * allowlist AND referenced by the rendered backend source tree. */
    referencedNames?: readonly string[];
    backup?: boolean;
}
export declare function defaultSourceDir(): string;
export declare function vendorSharedLib(opts: VendorSharedLibOptions): Promise<VendoredFile[]>;
/** Scan a rendered backend source tree for `../_shared/<name>.js` /
 * `./_shared/<name>.js` specifiers (post-render, post-rewrite). Not
 * currently used by the orchestrator — it just copies the whole allowlist
 * for determinism — but exposed for tests and for future trimming. */
export declare function collectReferencedSharedNames(backendSrcDir: string): Promise<string[]>;
//# sourceMappingURL=vendor-shared-lib.d.ts.map
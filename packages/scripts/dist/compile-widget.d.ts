export interface BundleAsset {
    path: string;
    bytes: number;
    gzip_bytes: number;
    sha256: string;
}
export interface WidgetSourceOrigin {
    package_version: string;
    tree_hash: string;
}
export interface CompileResult {
    js: BundleAsset;
    css: BundleAsset;
    source: WidgetSourceOrigin;
}
export interface CompileOptions {
    outDir: string;
    minify?: boolean;
}
interface ResolvedWidgetSource {
    entry: string;
    widgetRoot: string;
    packageVersion: string;
}
/**
 * Resolve the widget entry point through Node's module resolver against the
 * `@atw/widget` package. Works identically inside the monorepo (via npm
 * workspaces) and for external Builders who install `@atw/widget` as a
 * transitive dependency of `@atw/scripts`. Never inspects the caller's
 * process.cwd() — the source is the installed package, full stop (FR-011).
 */
export declare function resolveWidgetSource(): ResolvedWidgetSource;
/**
 * Deterministic sha256 over every file under <widgetRoot>/src/. The digest
 * inputs are the sorted `<relative_path>\t<file_sha256>` lines (LF separated)
 * so the hash is OS-independent and identical for two identical trees.
 */
export declare function computeWidgetTreeHash(widgetRoot: string): Promise<string>;
export declare function compileWidget(opts: CompileOptions): Promise<CompileResult>;
export declare function runCompileWidget(argv: string[]): Promise<number>;
export {};
//# sourceMappingURL=compile-widget.d.ts.map
import type { ManifestOperation } from "./lib/schemas/action-manifest.js";
/**
 * The shape consumed by `tools.ts.hbs` (see Feature 009 manifest schema).
 * `path_template` carries the unresolved path so action-intent and
 * safe-read paths can resolve `{slot}` placeholders at runtime.
 */
export interface RuntimeToolEntry {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    http: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path_template: string;
    };
    requires_confirmation: boolean;
    summary_template: string;
}
export interface RenderContext {
    projectName: string;
    embeddingModel: string;
    anthropicModel: string;
    generatedAt: string;
    /** Action-manifest operations rendered into RUNTIME_TOOLS. */
    tools?: RuntimeToolEntry[];
    /** Pre-stringified JSON of `tools` (set automatically before render). */
    toolsJson?: string;
    /** IETF locale tag (or common name) used in prompts.ts.hbs. */
    defaultLocale?: string;
    /** Plain-text business-scope summary used in prompts.ts.hbs. */
    briefSummary?: string;
}
export declare function manifestOperationsToRuntimeTools(ops: ReadonlyArray<ManifestOperation>): RuntimeToolEntry[];
export declare function loadRuntimeToolsFromManifest(manifestPath: string): RuntimeToolEntry[];
export type RenderAction = "unchanged" | "created" | "rewritten";
export interface RenderedFile {
    path: string;
    sha256: string;
    bytes: number;
    action: RenderAction;
    backup?: string;
}
export interface RenderOptions {
    templatesDir: string;
    outputDir: string;
    context: RenderContext;
    backup?: boolean;
}
export declare function defaultTemplatesDir(): string;
export declare function renderBackend(opts: RenderOptions): Promise<RenderedFile[]>;
export declare function runRenderBackend(argv: string[]): Promise<number>;
//# sourceMappingURL=render-backend.d.ts.map
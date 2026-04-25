import { type ActionManifest, type ActionManifestEntry } from "./lib/action-manifest-types.js";
export declare class ManifestFormatError extends Error {
    readonly code: "MANIFEST_FORMAT";
}
export declare class ProvenanceFormatError extends Error {
    readonly code: "PROVENANCE_FORMAT";
}
export declare class ManifestValidationError extends Error {
    readonly code: "MANIFEST_VALIDATION";
}
export interface ParseActionManifestOptions {
    /** Absolute path to the `action-manifest.md` file to parse. */
    manifestPath: string;
    /** Optional path to the ingested `openapi.json` for the FR-004 cross-check. */
    openapiPath?: string;
    /**
     * From `project.md#deploymentType`. When `"customer-facing-widget"`,
     * shopper-scoped entries that would ship without a credential source
     * cause a D-CREDSRC halt (FR-013).
     */
    deploymentType?: string;
}
/**
 * Thrown by the FR-013 D-CREDSRC halt. Text matches
 * contracts/builder-diagnostics.md verbatim.
 */
export declare class MissingCredentialSourceError extends Error {
    readonly code: "MISSING_CREDENTIAL_SOURCE";
    readonly entries: Array<{
        toolName: string;
        method: string;
        path: string;
    }>;
    constructor(entries: Array<{
        toolName: string;
        method: string;
        path: string;
    }>);
}
export declare function parseActionManifest(opts: ParseActionManifestOptions): Promise<ActionManifest>;
/**
 * Core text-in → manifest-out (no filesystem). Callers that don't need
 * OpenAPI cross-validation (e.g. the render step when the manifest was
 * just written by the classifier) use this directly.
 */
export declare function parseActionManifestText(text: string): ActionManifest;
export interface RuntimeToolDescriptorLike {
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    http: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path: string;
    };
    is_action: boolean;
    description_template?: string;
    summary_fields?: string[];
}
/**
 * Convert a single ActionManifestEntry to the RuntimeToolDescriptor
 * shape consumed by `tools.ts.hbs` / `renderBackend()`. Declaration
 * key order is preserved by fresh-literal construction so the
 * subsequent JSON.stringify emits keys in the order declared by the
 * `RuntimeToolDescriptor` interface (contracts/render-tools-context.md §4).
 *
 * Optional fields are OMITTED (not set to null/undefined) when the
 * source entry lacks them, so the rendered JSON stays clean.
 */
export declare function actionEntryToDescriptor(entry: ActionManifestEntry): RuntimeToolDescriptorLike;
/**
 * Recursively sort object keys alphabetically so `JSON.stringify`
 * emits a canonical form. Arrays are left alone (order is meaningful —
 * e.g. `required`, `summary_fields`). Primitives pass through.
 */
export declare function canonicaliseInputSchema(schema: Record<string, unknown>): Record<string, unknown>;
export { ToolNameCollisionError } from "./lib/action-manifest-types.js";
//# sourceMappingURL=parse-action-manifest.d.ts.map
import { type ParsedOpenAPI } from "./lib/types.js";
export declare class Swagger20DetectedError extends Error {
    readonly sourceVersion: "2.0";
    constructor(sourceVersion: "2.0");
}
export declare class OpenAPIFetchError extends Error {
    readonly url: string;
    constructor(url: string, cause: string);
}
export declare class ParseOpenAPIError extends Error {
    constructor(message: string);
}
/**
 * Feature 006 — FR-002: operationIds must be unique within the document.
 * Detection is performed during `normalize()` so every downstream
 * consumer (classifier, manifest cross-validation, render pipeline)
 * can trust that the operations array has no duplicates.
 * See contracts/atw-api-command.md §3 step 6.
 */
export declare class DuplicateOperationIdError extends Error {
    readonly operationId: string;
    readonly first: {
        method: string;
        path: string;
    };
    readonly second: {
        method: string;
        path: string;
    };
    readonly code: "DUPLICATE_OPERATION_ID";
    constructor(operationId: string, first: {
        method: string;
        path: string;
    }, second: {
        method: string;
        path: string;
    });
}
export interface ParseOpenAPIInput {
    /** Absolute file path OR an `http(s)://` URL. */
    source: string;
    /** Optional pre-read document body (for paste flow). */
    body?: string;
}
export interface ParseOpenAPIResult {
    parsed: ParsedOpenAPI;
    /** The fully-dereferenced raw document, useful for downstream helpers. */
    raw: unknown;
}
export declare function parseOpenAPI(input: ParseOpenAPIInput): Promise<ParseOpenAPIResult>;
export declare function runParseOpenAPI(argv: string[]): Promise<number>;
//# sourceMappingURL=parse-openapi.d.ts.map
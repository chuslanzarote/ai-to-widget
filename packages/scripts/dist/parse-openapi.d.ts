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
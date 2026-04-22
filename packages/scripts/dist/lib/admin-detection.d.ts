import type { ParsedOpenAPI } from "./types.js";
export interface AdminFlag {
    operationId: string;
    path: string;
    reason: "path-prefix" | "tag" | "security-scheme" | "vendor-extension";
}
export declare function detectAdminOperations(parsed: ParsedOpenAPI, 
/** Raw OpenAPI document (dereferenced) — needed to read `x-admin` vendor extensions. */
raw?: unknown): AdminFlag[];
//# sourceMappingURL=admin-detection.d.ts.map
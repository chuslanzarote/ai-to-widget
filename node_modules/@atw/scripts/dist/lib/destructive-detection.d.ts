import type { ParsedOpenAPI } from "./types.js";
export interface DestructiveFlag {
    operationId: string;
    path: string;
    method: string;
    reason: "http-delete" | "operation-id-verb" | "path-suffix-verb";
}
export declare function detectDestructiveOperations(parsed: ParsedOpenAPI): DestructiveFlag[];
//# sourceMappingURL=destructive-detection.d.ts.map
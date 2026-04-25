import type { SchemaMapArtifact } from "./lib/types.js";
export interface PiiMatch {
    entity_type: string;
    entity_id: string;
    pii_column: string;
    pii_value: string;
    matched_in: "document" | "facts" | "categories";
    snippet: string;
}
export interface ScanResult {
    clean: boolean;
    values_checked: number;
    matches: PiiMatch[];
}
export interface ScanOptions {
    schemaMap: SchemaMapArtifact;
    connectionConfig: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
}
/**
 * Clarifications Q1 / FR-088: case-insensitive substring match after
 * whitespace normalization (collapse runs of whitespace to a single space
 * and lowercase both sides).
 */
export declare function normalizeForMatch(s: string): string;
export declare function findMatches(normalizedDoc: string, originalDoc: string, values: Array<{
    column: string;
    value: string;
}>): Array<{
    column: string;
    value: string;
    snippet: string;
}>;
export declare function scanPiiLeaks(opts: ScanOptions): Promise<ScanResult>;
export declare function runScanPiiLeaks(argv: string[]): Promise<number>;
//# sourceMappingURL=scan-pii-leaks.d.ts.map
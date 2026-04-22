import type { ParsedSQLSchema, ParsedSQLTable } from "./types.js";
export type PIIClass = "email" | "phone" | "name" | "address" | "payment" | "gov-id" | "free-text-bio";
export interface ColumnPIIFlag {
    schema: string;
    table: string;
    column: string;
    piiClass: PIIClass;
    evidence: string;
}
export interface TablePIIFlag {
    schema: string;
    table: string;
    reason: string;
    columns: string[];
}
export interface PIIReport {
    columns: ColumnPIIFlag[];
    tables: TablePIIFlag[];
}
export declare function detectPII(schema: ParsedSQLSchema, sampleRows?: Record<string, ReadonlyArray<Record<string, unknown>>>): PIIReport;
export declare function piiColumnsFor(report: PIIReport, table: ParsedSQLTable): string[];
//# sourceMappingURL=pii-detection.d.ts.map
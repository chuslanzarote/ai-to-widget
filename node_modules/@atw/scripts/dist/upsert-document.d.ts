import { z } from "zod";
/**
 * Row shape accepted by `atw-upsert-document`. Matches `atw_documents`
 * plus metadata required for the source_hash skip rule.
 */
export declare const UpsertDocumentRowSchema: z.ZodObject<{
    entity_type: z.ZodString;
    entity_id: z.ZodString;
    document: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        claim: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        claim: string;
        source: string;
    }, {
        claim: string;
        source: string;
    }>, "many">;
    categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
    embedding: z.ZodArray<z.ZodNumber, "many">;
    source_hash: z.ZodString;
    opus_tokens: z.ZodObject<{
        input_tokens: z.ZodNumber;
        output_tokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        input_tokens: number;
        output_tokens: number;
    }, {
        input_tokens: number;
        output_tokens: number;
    }>;
}, "strip", z.ZodTypeAny, {
    entity_type: string;
    entity_id: string;
    document: string;
    facts: {
        claim: string;
        source: string;
    }[];
    categories: Record<string, string[]>;
    embedding: number[];
    source_hash: string;
    opus_tokens: {
        input_tokens: number;
        output_tokens: number;
    };
}, {
    entity_type: string;
    entity_id: string;
    document: string;
    facts: {
        claim: string;
        source: string;
    }[];
    categories: Record<string, string[]>;
    embedding: number[];
    source_hash: string;
    opus_tokens: {
        input_tokens: number;
        output_tokens: number;
    };
}>;
export type UpsertDocumentRow = z.infer<typeof UpsertDocumentRowSchema>;
export type UpsertAction = "inserted" | "updated" | "skipped";
export interface UpsertResult {
    action: UpsertAction;
    entity_type: string;
    entity_id: string;
}
export interface UpsertOptions {
    row: UpsertDocumentRow;
    force?: boolean;
    connectionConfig: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
}
export declare function upsertDocument(opts: UpsertOptions): Promise<UpsertResult>;
/**
 * pgvector expects `[v1,v2,...]` as text. We avoid `::vector` cast on the
 * client side by formatting a single string and relying on the explicit
 * cast in the SQL above.
 */
export declare function toPgVectorLiteral(vec: number[]): string;
export declare function runUpsertDocument(argv: string[]): Promise<number>;
//# sourceMappingURL=upsert-document.d.ts.map
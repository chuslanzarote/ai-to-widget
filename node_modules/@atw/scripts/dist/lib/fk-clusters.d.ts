import type { ParsedSQLSchema } from "./types.js";
export interface Cluster {
    id: number;
    tables: string[];
}
/**
 * FK-graph clustering via union-find (FR-024).
 *
 * Every edge is a foreign key. Isolated tables form singleton clusters.
 * Used by /atw.schema to decide how to chunk LLM classification requests
 * when the schema is large enough (>100 tables or >500 columns).
 */
export declare function clusterTables(schema: ParsedSQLSchema): Cluster[];
//# sourceMappingURL=fk-clusters.d.ts.map
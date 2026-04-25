import { type AssembledEntityInput, type SchemaMapArtifact } from "./lib/types.js";
export interface AssembleOptions {
    entityType: string;
    entityId: string;
    schemaMap: SchemaMapArtifact;
    briefSummary: string;
    connectionConfig: {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
    };
    now?: Date;
}
/**
 * Assemble one entity's structured input for Opus. Throws:
 *  - `ENTITY_NOT_FOUND` when the primary row is missing (exit 9)
 *  - `SCHEMA_CORRUPT` when schema-map references a missing table (exit 10)
 */
export declare function assembleEntityInput(opts: AssembleOptions): Promise<AssembledEntityInput>;
export declare function runAssembleEntityInput(argv: string[]): Promise<number>;
//# sourceMappingURL=assemble-entity-input.d.ts.map
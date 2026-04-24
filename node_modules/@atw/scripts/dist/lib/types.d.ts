import { z } from "zod";
export declare const ArtifactKindSchema: z.ZodEnum<["project", "brief", "schema-map", "action-manifest", "build-plan"]>;
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;
export declare const DeploymentTypeSchema: z.ZodEnum<["customer-facing-widget", "internal-copilot", "custom"]>;
export declare const ProjectArtifactSchema: z.ZodObject<{
    name: z.ZodString;
    languages: z.ZodArray<z.ZodString, "many">;
    deploymentType: z.ZodEnum<["customer-facing-widget", "internal-copilot", "custom"]>;
    createdAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    languages: string[];
    deploymentType: "customer-facing-widget" | "internal-copilot" | "custom";
    createdAt: string;
}, {
    name: string;
    languages: string[];
    deploymentType: "customer-facing-widget" | "internal-copilot" | "custom";
    createdAt: string;
}>;
export type ProjectArtifact = z.infer<typeof ProjectArtifactSchema>;
export declare const BriefArtifactSchema: z.ZodObject<{
    businessScope: z.ZodString;
    customers: z.ZodString;
    allowedActions: z.ZodArray<z.ZodString, "many">;
    forbiddenActions: z.ZodArray<z.ZodString, "many">;
    tone: z.ZodString;
    primaryUseCases: z.ZodArray<z.ZodString, "many">;
    vocabulary: z.ZodArray<z.ZodObject<{
        term: z.ZodString;
        definition: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        term: string;
        definition: string;
    }, {
        term: string;
        definition: string;
    }>, "many">;
    antiPatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    businessScope: string;
    customers: string;
    allowedActions: string[];
    forbiddenActions: string[];
    tone: string;
    primaryUseCases: string[];
    vocabulary: {
        term: string;
        definition: string;
    }[];
    antiPatterns?: string[] | undefined;
}, {
    businessScope: string;
    customers: string;
    allowedActions: string[];
    forbiddenActions: string[];
    tone: string;
    primaryUseCases: string[];
    vocabulary: {
        term: string;
        definition: string;
    }[];
    antiPatterns?: string[] | undefined;
}>;
export type BriefArtifact = z.infer<typeof BriefArtifactSchema>;
export declare const SchemaMapEntitySchema: z.ZodObject<{
    name: z.ZodString;
    classification: z.ZodEnum<["indexable", "reference", "infrastructure"]>;
    sourceTables: z.ZodArray<z.ZodString, "many">;
    joinedReferences: z.ZodArray<z.ZodString, "many">;
    columns: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        decision: z.ZodEnum<["index", "reference", "exclude-pii", "exclude-internal"]>;
        notes: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
        notes?: string | undefined;
    }, {
        name: string;
        decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
        notes?: string | undefined;
    }>, "many">;
    evidence: z.ZodString;
}, "strip", z.ZodTypeAny, {
    name: string;
    classification: "indexable" | "reference" | "infrastructure";
    sourceTables: string[];
    joinedReferences: string[];
    columns: {
        name: string;
        decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
        notes?: string | undefined;
    }[];
    evidence: string;
}, {
    name: string;
    classification: "indexable" | "reference" | "infrastructure";
    sourceTables: string[];
    joinedReferences: string[];
    columns: {
        name: string;
        decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
        notes?: string | undefined;
    }[];
    evidence: string;
}>;
export declare const SchemaMapArtifactSchema: z.ZodObject<{
    summary: z.ZodString;
    entities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        classification: z.ZodEnum<["indexable", "reference", "infrastructure"]>;
        sourceTables: z.ZodArray<z.ZodString, "many">;
        joinedReferences: z.ZodArray<z.ZodString, "many">;
        columns: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            decision: z.ZodEnum<["index", "reference", "exclude-pii", "exclude-internal"]>;
            notes: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }, {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }>, "many">;
        evidence: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        classification: "indexable" | "reference" | "infrastructure";
        sourceTables: string[];
        joinedReferences: string[];
        columns: {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }[];
        evidence: string;
    }, {
        name: string;
        classification: "indexable" | "reference" | "infrastructure";
        sourceTables: string[];
        joinedReferences: string[];
        columns: {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }[];
        evidence: string;
    }>, "many">;
    referenceTables: z.ZodArray<z.ZodString, "many">;
    infrastructureTables: z.ZodArray<z.ZodString, "many">;
    piiExcluded: z.ZodArray<z.ZodObject<{
        table: z.ZodString;
        columns: z.ZodArray<z.ZodString, "many">;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        columns: string[];
        table: string;
        reason: string;
    }, {
        columns: string[];
        table: string;
        reason: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    summary: string;
    entities: {
        name: string;
        classification: "indexable" | "reference" | "infrastructure";
        sourceTables: string[];
        joinedReferences: string[];
        columns: {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }[];
        evidence: string;
    }[];
    referenceTables: string[];
    infrastructureTables: string[];
    piiExcluded: {
        columns: string[];
        table: string;
        reason: string;
    }[];
}, {
    summary: string;
    entities: {
        name: string;
        classification: "indexable" | "reference" | "infrastructure";
        sourceTables: string[];
        joinedReferences: string[];
        columns: {
            name: string;
            decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
            notes?: string | undefined;
        }[];
        evidence: string;
    }[];
    referenceTables: string[];
    infrastructureTables: string[];
    piiExcluded: {
        columns: string[];
        table: string;
        reason: string;
    }[];
}>;
export type SchemaMapArtifact = z.infer<typeof SchemaMapArtifactSchema>;
export declare const ActionManifestToolSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    requiresConfirmation: z.ZodBoolean;
    source: z.ZodObject<{
        path: z.ZodString;
        method: z.ZodString;
        security: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        method: string;
        security?: string | undefined;
    }, {
        path: string;
        method: string;
        security?: string | undefined;
    }>;
    parameterSources: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    requiresConfirmation: boolean;
    source: {
        path: string;
        method: string;
        security?: string | undefined;
    };
    parameterSources: string[];
}, {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    requiresConfirmation: boolean;
    source: {
        path: string;
        method: string;
        security?: string | undefined;
    };
    parameterSources: string[];
}>;
export declare const ActionManifestArtifactSchema: z.ZodObject<{
    summary: z.ZodString;
    tools: z.ZodArray<z.ZodObject<{
        entity: z.ZodString;
        items: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            description: z.ZodString;
            parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            requiresConfirmation: z.ZodBoolean;
            source: z.ZodObject<{
                path: z.ZodString;
                method: z.ZodString;
                security: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                path: string;
                method: string;
                security?: string | undefined;
            }, {
                path: string;
                method: string;
                security?: string | undefined;
            }>;
            parameterSources: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }, {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entity: string;
        items: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }[];
    }, {
        entity: string;
        items: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }[];
    }>, "many">;
    excluded: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        method: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        reason: string;
        method: string;
    }, {
        path: string;
        reason: string;
        method: string;
    }>, "many">;
    runtimeSystemPromptBlock: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: string;
    tools: {
        entity: string;
        items: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }[];
    }[];
    excluded: {
        path: string;
        reason: string;
        method: string;
    }[];
    runtimeSystemPromptBlock: string;
}, {
    summary: string;
    tools: {
        entity: string;
        items: {
            name: string;
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            parameterSources: string[];
        }[];
    }[];
    excluded: {
        path: string;
        reason: string;
        method: string;
    }[];
    runtimeSystemPromptBlock: string;
}>;
export type ActionManifestArtifact = z.infer<typeof ActionManifestArtifactSchema>;
export declare const CostEstimateSchema: z.ZodObject<{
    enrichmentCalls: z.ZodNumber;
    perCallCostUsd: z.ZodNumber;
    totalCostUsd: z.ZodNumber;
    retryBufferUsd: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    enrichmentCalls: number;
    perCallCostUsd: number;
    totalCostUsd: number;
    retryBufferUsd: number;
}, {
    enrichmentCalls: number;
    perCallCostUsd: number;
    totalCostUsd: number;
    retryBufferUsd: number;
}>;
export declare const BuildPlanArtifactSchema: z.ZodObject<{
    summary: z.ZodString;
    embeddingApproach: z.ZodString;
    categoryVocabularies: z.ZodArray<z.ZodObject<{
        entity: z.ZodString;
        terms: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        entity: string;
        terms: string[];
    }, {
        entity: string;
        terms: string[];
    }>, "many">;
    enrichmentPromptTemplates: z.ZodArray<z.ZodObject<{
        entity: z.ZodString;
        template: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        entity: string;
        template: string;
    }, {
        entity: string;
        template: string;
    }>, "many">;
    estimatedEntityCounts: z.ZodRecord<z.ZodString, z.ZodNumber>;
    costEstimate: z.ZodObject<{
        enrichmentCalls: z.ZodNumber;
        perCallCostUsd: z.ZodNumber;
        totalCostUsd: z.ZodNumber;
        retryBufferUsd: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enrichmentCalls: number;
        perCallCostUsd: number;
        totalCostUsd: number;
        retryBufferUsd: number;
    }, {
        enrichmentCalls: number;
        perCallCostUsd: number;
        totalCostUsd: number;
        retryBufferUsd: number;
    }>;
    backendConfigurationDefaults: z.ZodRecord<z.ZodString, z.ZodString>;
    widgetConfigurationDefaults: z.ZodRecord<z.ZodString, z.ZodString>;
    buildSequence: z.ZodArray<z.ZodString, "many">;
    failureHandling: z.ZodString;
}, "strip", z.ZodTypeAny, {
    summary: string;
    embeddingApproach: string;
    categoryVocabularies: {
        entity: string;
        terms: string[];
    }[];
    enrichmentPromptTemplates: {
        entity: string;
        template: string;
    }[];
    estimatedEntityCounts: Record<string, number>;
    costEstimate: {
        enrichmentCalls: number;
        perCallCostUsd: number;
        totalCostUsd: number;
        retryBufferUsd: number;
    };
    backendConfigurationDefaults: Record<string, string>;
    widgetConfigurationDefaults: Record<string, string>;
    buildSequence: string[];
    failureHandling: string;
}, {
    summary: string;
    embeddingApproach: string;
    categoryVocabularies: {
        entity: string;
        terms: string[];
    }[];
    enrichmentPromptTemplates: {
        entity: string;
        template: string;
    }[];
    estimatedEntityCounts: Record<string, number>;
    costEstimate: {
        enrichmentCalls: number;
        perCallCostUsd: number;
        totalCostUsd: number;
        retryBufferUsd: number;
    };
    backendConfigurationDefaults: Record<string, string>;
    widgetConfigurationDefaults: Record<string, string>;
    buildSequence: string[];
    failureHandling: string;
}>;
export type BuildPlanArtifact = z.infer<typeof BuildPlanArtifactSchema>;
export declare const ParsedSQLColumnSchema: z.ZodObject<{
    name: z.ZodString;
    dataType: z.ZodString;
    nullable: z.ZodBoolean;
    default: z.ZodNullable<z.ZodString>;
    isPrimaryKey: z.ZodBoolean;
    comment: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    dataType: string;
    nullable: boolean;
    default: string | null;
    isPrimaryKey: boolean;
    comment: string | null;
}, {
    name: string;
    dataType: string;
    nullable: boolean;
    default: string | null;
    isPrimaryKey: boolean;
    comment: string | null;
}>;
export declare const ParsedSQLForeignKeySchema: z.ZodObject<{
    columns: z.ZodArray<z.ZodString, "many">;
    referenceSchema: z.ZodString;
    referenceTable: z.ZodString;
    referenceColumns: z.ZodArray<z.ZodString, "many">;
    onDelete: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
    onUpdate: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
}, "strip", z.ZodTypeAny, {
    columns: string[];
    referenceSchema: string;
    referenceTable: string;
    referenceColumns: string[];
    onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
    onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
}, {
    columns: string[];
    referenceSchema: string;
    referenceTable: string;
    referenceColumns: string[];
    onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
    onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
}>;
export declare const ParsedSQLTableSchema: z.ZodObject<{
    schema: z.ZodString;
    name: z.ZodString;
    columns: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        dataType: z.ZodString;
        nullable: z.ZodBoolean;
        default: z.ZodNullable<z.ZodString>;
        isPrimaryKey: z.ZodBoolean;
        comment: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        dataType: string;
        nullable: boolean;
        default: string | null;
        isPrimaryKey: boolean;
        comment: string | null;
    }, {
        name: string;
        dataType: string;
        nullable: boolean;
        default: string | null;
        isPrimaryKey: boolean;
        comment: string | null;
    }>, "many">;
    primaryKey: z.ZodArray<z.ZodString, "many">;
    foreignKeys: z.ZodArray<z.ZodObject<{
        columns: z.ZodArray<z.ZodString, "many">;
        referenceSchema: z.ZodString;
        referenceTable: z.ZodString;
        referenceColumns: z.ZodArray<z.ZodString, "many">;
        onDelete: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
        onUpdate: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
    }, "strip", z.ZodTypeAny, {
        columns: string[];
        referenceSchema: string;
        referenceTable: string;
        referenceColumns: string[];
        onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
        onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
    }, {
        columns: string[];
        referenceSchema: string;
        referenceTable: string;
        referenceColumns: string[];
        onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
        onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
    }>, "many">;
    uniqueConstraints: z.ZodArray<z.ZodObject<{
        columns: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        columns: string[];
    }, {
        columns: string[];
    }>, "many">;
    indexes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        columns: z.ZodArray<z.ZodString, "many">;
        unique: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        name: string;
        columns: string[];
        unique: boolean;
    }, {
        name: string;
        columns: string[];
        unique: boolean;
    }>, "many">;
    inherits: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
    comment: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    columns: {
        name: string;
        dataType: string;
        nullable: boolean;
        default: string | null;
        isPrimaryKey: boolean;
        comment: string | null;
    }[];
    comment: string | null;
    schema: string;
    primaryKey: string[];
    foreignKeys: {
        columns: string[];
        referenceSchema: string;
        referenceTable: string;
        referenceColumns: string[];
        onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
        onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
    }[];
    uniqueConstraints: {
        columns: string[];
    }[];
    indexes: {
        name: string;
        columns: string[];
        unique: boolean;
    }[];
    inherits: string[] | null;
}, {
    name: string;
    columns: {
        name: string;
        dataType: string;
        nullable: boolean;
        default: string | null;
        isPrimaryKey: boolean;
        comment: string | null;
    }[];
    comment: string | null;
    schema: string;
    primaryKey: string[];
    foreignKeys: {
        columns: string[];
        referenceSchema: string;
        referenceTable: string;
        referenceColumns: string[];
        onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
        onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
    }[];
    uniqueConstraints: {
        columns: string[];
    }[];
    indexes: {
        name: string;
        columns: string[];
        unique: boolean;
    }[];
    inherits: string[] | null;
}>;
export type ParsedSQLTable = z.infer<typeof ParsedSQLTableSchema>;
export declare const ParsedSQLSchemaSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    dialect: z.ZodLiteral<"postgres">;
    schemas: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        tables: z.ZodArray<z.ZodObject<{
            schema: z.ZodString;
            name: z.ZodString;
            columns: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                dataType: z.ZodString;
                nullable: z.ZodBoolean;
                default: z.ZodNullable<z.ZodString>;
                isPrimaryKey: z.ZodBoolean;
                comment: z.ZodNullable<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }, {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }>, "many">;
            primaryKey: z.ZodArray<z.ZodString, "many">;
            foreignKeys: z.ZodArray<z.ZodObject<{
                columns: z.ZodArray<z.ZodString, "many">;
                referenceSchema: z.ZodString;
                referenceTable: z.ZodString;
                referenceColumns: z.ZodArray<z.ZodString, "many">;
                onDelete: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
                onUpdate: z.ZodNullable<z.ZodEnum<["cascade", "restrict", "set null", "no action"]>>;
            }, "strip", z.ZodTypeAny, {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }, {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }>, "many">;
            uniqueConstraints: z.ZodArray<z.ZodObject<{
                columns: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                columns: string[];
            }, {
                columns: string[];
            }>, "many">;
            indexes: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                columns: z.ZodArray<z.ZodString, "many">;
                unique: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                name: string;
                columns: string[];
                unique: boolean;
            }, {
                name: string;
                columns: string[];
                unique: boolean;
            }>, "many">;
            inherits: z.ZodNullable<z.ZodArray<z.ZodString, "many">>;
            comment: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }, {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }>, "many">;
        enums: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            values: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            name: string;
            values: string[];
        }, {
            name: string;
            values: string[];
        }>, "many">;
        extensions: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        name: string;
        tables: {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }[];
        enums: {
            name: string;
            values: string[];
        }[];
        extensions: string[];
    }, {
        name: string;
        tables: {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }[];
        enums: {
            name: string;
            values: string[];
        }[];
        extensions: string[];
    }>, "many">;
    sampleRows: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    parseErrors: z.ZodArray<z.ZodObject<{
        line: z.ZodNumber;
        column: z.ZodNumber;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        line: number;
        column: number;
    }, {
        message: string;
        line: number;
        column: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    dialect: "postgres";
    schemas: {
        name: string;
        tables: {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }[];
        enums: {
            name: string;
            values: string[];
        }[];
        extensions: string[];
    }[];
    sampleRows: Record<string, Record<string, unknown>[]>;
    parseErrors: {
        message: string;
        line: number;
        column: number;
    }[];
}, {
    version: 1;
    dialect: "postgres";
    schemas: {
        name: string;
        tables: {
            name: string;
            columns: {
                name: string;
                dataType: string;
                nullable: boolean;
                default: string | null;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            comment: string | null;
            schema: string;
            primaryKey: string[];
            foreignKeys: {
                columns: string[];
                referenceSchema: string;
                referenceTable: string;
                referenceColumns: string[];
                onDelete: "cascade" | "restrict" | "set null" | "no action" | null;
                onUpdate: "cascade" | "restrict" | "set null" | "no action" | null;
            }[];
            uniqueConstraints: {
                columns: string[];
            }[];
            indexes: {
                name: string;
                columns: string[];
                unique: boolean;
            }[];
            inherits: string[] | null;
        }[];
        enums: {
            name: string;
            values: string[];
        }[];
        extensions: string[];
    }[];
    sampleRows: Record<string, Record<string, unknown>[]>;
    parseErrors: {
        message: string;
        line: number;
        column: number;
    }[];
}>;
export type ParsedSQLSchema = z.infer<typeof ParsedSQLSchemaSchema>;
export declare const ParsedOpenAPIOperationSchema: z.ZodObject<{
    id: z.ZodString;
    method: z.ZodEnum<["get", "post", "put", "patch", "delete", "head", "options"]>;
    path: z.ZodString;
    tag: z.ZodNullable<z.ZodString>;
    summary: z.ZodNullable<z.ZodString>;
    description: z.ZodNullable<z.ZodString>;
    security: z.ZodArray<z.ZodObject<{
        scheme: z.ZodString;
        scopes: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        scheme: string;
        scopes: string[];
    }, {
        scheme: string;
        scopes: string[];
    }>, "many">;
    parameters: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        in: z.ZodEnum<["query", "path", "header", "cookie"]>;
        required: z.ZodBoolean;
        schema: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        name: string;
        in: "path" | "query" | "header" | "cookie";
        required: boolean;
        schema?: unknown;
    }, {
        name: string;
        in: "path" | "query" | "header" | "cookie";
        required: boolean;
        schema?: unknown;
    }>, "many">;
    requestBody: z.ZodNullable<z.ZodObject<{
        contentType: z.ZodString;
        schema: z.ZodUnknown;
    }, "strip", z.ZodTypeAny, {
        contentType: string;
        schema?: unknown;
    }, {
        contentType: string;
        schema?: unknown;
    }>>;
    responses: z.ZodArray<z.ZodObject<{
        status: z.ZodString;
        contentType: z.ZodNullable<z.ZodString>;
        schema: z.ZodNullable<z.ZodUnknown>;
    }, "strip", z.ZodTypeAny, {
        status: string;
        contentType: string | null;
        schema?: unknown;
    }, {
        status: string;
        contentType: string | null;
        schema?: unknown;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    path: string;
    summary: string | null;
    description: string | null;
    parameters: {
        name: string;
        in: "path" | "query" | "header" | "cookie";
        required: boolean;
        schema?: unknown;
    }[];
    method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
    security: {
        scheme: string;
        scopes: string[];
    }[];
    id: string;
    tag: string | null;
    requestBody: {
        contentType: string;
        schema?: unknown;
    } | null;
    responses: {
        status: string;
        contentType: string | null;
        schema?: unknown;
    }[];
}, {
    path: string;
    summary: string | null;
    description: string | null;
    parameters: {
        name: string;
        in: "path" | "query" | "header" | "cookie";
        required: boolean;
        schema?: unknown;
    }[];
    method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
    security: {
        scheme: string;
        scopes: string[];
    }[];
    id: string;
    tag: string | null;
    requestBody: {
        contentType: string;
        schema?: unknown;
    } | null;
    responses: {
        status: string;
        contentType: string | null;
        schema?: unknown;
    }[];
}>;
export type ParsedOpenAPIOperation = z.infer<typeof ParsedOpenAPIOperationSchema>;
export declare const ParsedOpenAPISchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    sourceVersion: z.ZodEnum<["3.1", "3.0", "2.0"]>;
    sourceUrl: z.ZodNullable<z.ZodString>;
    title: z.ZodString;
    apiDescription: z.ZodNullable<z.ZodString>;
    servers: z.ZodArray<z.ZodObject<{
        url: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string | null;
        url: string;
    }, {
        description: string | null;
        url: string;
    }>, "many">;
    tags: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string | null;
    }, {
        name: string;
        description: string | null;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        method: z.ZodEnum<["get", "post", "put", "patch", "delete", "head", "options"]>;
        path: z.ZodString;
        tag: z.ZodNullable<z.ZodString>;
        summary: z.ZodNullable<z.ZodString>;
        description: z.ZodNullable<z.ZodString>;
        security: z.ZodArray<z.ZodObject<{
            scheme: z.ZodString;
            scopes: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            scheme: string;
            scopes: string[];
        }, {
            scheme: string;
            scopes: string[];
        }>, "many">;
        parameters: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            in: z.ZodEnum<["query", "path", "header", "cookie"]>;
            required: z.ZodBoolean;
            schema: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }, {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }>, "many">;
        requestBody: z.ZodNullable<z.ZodObject<{
            contentType: z.ZodString;
            schema: z.ZodUnknown;
        }, "strip", z.ZodTypeAny, {
            contentType: string;
            schema?: unknown;
        }, {
            contentType: string;
            schema?: unknown;
        }>>;
        responses: z.ZodArray<z.ZodObject<{
            status: z.ZodString;
            contentType: z.ZodNullable<z.ZodString>;
            schema: z.ZodNullable<z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }, {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        path: string;
        summary: string | null;
        description: string | null;
        parameters: {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }[];
        method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
        security: {
            scheme: string;
            scopes: string[];
        }[];
        id: string;
        tag: string | null;
        requestBody: {
            contentType: string;
            schema?: unknown;
        } | null;
        responses: {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }[];
    }, {
        path: string;
        summary: string | null;
        description: string | null;
        parameters: {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }[];
        method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
        security: {
            scheme: string;
            scopes: string[];
        }[];
        id: string;
        tag: string | null;
        requestBody: {
            contentType: string;
            schema?: unknown;
        } | null;
        responses: {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }[];
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    sourceVersion: "3.1" | "3.0" | "2.0";
    sourceUrl: string | null;
    title: string;
    apiDescription: string | null;
    servers: {
        description: string | null;
        url: string;
    }[];
    tags: {
        name: string;
        description: string | null;
    }[];
    operations: {
        path: string;
        summary: string | null;
        description: string | null;
        parameters: {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }[];
        method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
        security: {
            scheme: string;
            scopes: string[];
        }[];
        id: string;
        tag: string | null;
        requestBody: {
            contentType: string;
            schema?: unknown;
        } | null;
        responses: {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }[];
    }[];
}, {
    version: 1;
    sourceVersion: "3.1" | "3.0" | "2.0";
    sourceUrl: string | null;
    title: string;
    apiDescription: string | null;
    servers: {
        description: string | null;
        url: string;
    }[];
    tags: {
        name: string;
        description: string | null;
    }[];
    operations: {
        path: string;
        summary: string | null;
        description: string | null;
        parameters: {
            name: string;
            in: "path" | "query" | "header" | "cookie";
            required: boolean;
            schema?: unknown;
        }[];
        method: "options" | "get" | "post" | "put" | "patch" | "delete" | "head";
        security: {
            scheme: string;
            scopes: string[];
        }[];
        id: string;
        tag: string | null;
        requestBody: {
            contentType: string;
            schema?: unknown;
        } | null;
        responses: {
            status: string;
            contentType: string | null;
            schema?: unknown;
        }[];
    }[];
}>;
export type ParsedOpenAPI = z.infer<typeof ParsedOpenAPISchema>;
export declare const InputHashKindSchema: z.ZodEnum<["sql-dump", "openapi", "brief-input", "other"]>;
export type InputHashKind = z.infer<typeof InputHashKindSchema>;
export declare const InputHashRecordSchema: z.ZodObject<{
    path: z.ZodString;
    kind: z.ZodEnum<["sql-dump", "openapi", "brief-input", "other"]>;
    sha256: z.ZodString;
    seenAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    kind: "sql-dump" | "openapi" | "brief-input" | "other";
    sha256: string;
    seenAt: string;
}, {
    path: string;
    kind: "sql-dump" | "openapi" | "brief-input" | "other";
    sha256: string;
    seenAt: string;
}>;
export type InputHashRecord = z.infer<typeof InputHashRecordSchema>;
export declare const InputHashesStateSchema: z.ZodObject<{
    version: z.ZodLiteral<1>;
    entries: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        kind: z.ZodEnum<["sql-dump", "openapi", "brief-input", "other"]>;
        sha256: z.ZodString;
        seenAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        sha256: string;
        seenAt: string;
    }, {
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        sha256: string;
        seenAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    entries: {
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        sha256: string;
        seenAt: string;
    }[];
    version: 1;
}, {
    entries: {
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        sha256: string;
        seenAt: string;
    }[];
    version: 1;
}>;
export type InputHashesState = z.infer<typeof InputHashesStateSchema>;
export type LoadedArtifact = {
    kind: "project";
    path: string;
    content: ProjectArtifact;
} | {
    kind: "brief";
    path: string;
    content: BriefArtifact;
} | {
    kind: "schema-map";
    path: string;
    content: SchemaMapArtifact;
} | {
    kind: "action-manifest";
    path: string;
    content: ActionManifestArtifact;
} | {
    kind: "build-plan";
    path: string;
    content: BuildPlanArtifact;
};
export declare const InconsistencyKindSchema: z.ZodEnum<["action-references-excluded-entity", "brief-references-missing-vocabulary", "schema-map-references-missing-brief-section", "plan-references-missing-upstream"]>;
export type InconsistencyKind = z.infer<typeof InconsistencyKindSchema>;
export declare const ArtifactConsistencyReportSchema: z.ZodObject<{
    ok: z.ZodBoolean;
    missing: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["project", "brief", "schema-map", "action-manifest", "build-plan"]>;
        expectedPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "project" | "brief" | "schema-map" | "action-manifest" | "build-plan";
        expectedPath: string;
    }, {
        kind: "project" | "brief" | "schema-map" | "action-manifest" | "build-plan";
        expectedPath: string;
    }>, "many">;
    inconsistencies: z.ZodArray<z.ZodObject<{
        kind: z.ZodEnum<["action-references-excluded-entity", "brief-references-missing-vocabulary", "schema-map-references-missing-brief-section", "plan-references-missing-upstream"]>;
        detail: z.ZodString;
        leftPath: z.ZodString;
        rightPath: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        kind: "action-references-excluded-entity" | "brief-references-missing-vocabulary" | "schema-map-references-missing-brief-section" | "plan-references-missing-upstream";
        detail: string;
        leftPath: string;
        rightPath: string;
    }, {
        kind: "action-references-excluded-entity" | "brief-references-missing-vocabulary" | "schema-map-references-missing-brief-section" | "plan-references-missing-upstream";
        detail: string;
        leftPath: string;
        rightPath: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    ok: boolean;
    missing: {
        kind: "project" | "brief" | "schema-map" | "action-manifest" | "build-plan";
        expectedPath: string;
    }[];
    inconsistencies: {
        kind: "action-references-excluded-entity" | "brief-references-missing-vocabulary" | "schema-map-references-missing-brief-section" | "plan-references-missing-upstream";
        detail: string;
        leftPath: string;
        rightPath: string;
    }[];
}, {
    ok: boolean;
    missing: {
        kind: "project" | "brief" | "schema-map" | "action-manifest" | "build-plan";
        expectedPath: string;
    }[];
    inconsistencies: {
        kind: "action-references-excluded-entity" | "brief-references-missing-vocabulary" | "schema-map-references-missing-brief-section" | "plan-references-missing-upstream";
        detail: string;
        leftPath: string;
        rightPath: string;
    }[];
}>;
export type ArtifactConsistencyReport = z.infer<typeof ArtifactConsistencyReportSchema>;
export interface StructuralDiff<T> {
    added: T[];
    removed: T[];
    modified: Array<{
        before: T;
        after: T;
        changedFields: string[];
    }>;
}
export declare const ARTIFACT_SCHEMAS: {
    readonly project: z.ZodObject<{
        name: z.ZodString;
        languages: z.ZodArray<z.ZodString, "many">;
        deploymentType: z.ZodEnum<["customer-facing-widget", "internal-copilot", "custom"]>;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        name: string;
        languages: string[];
        deploymentType: "customer-facing-widget" | "internal-copilot" | "custom";
        createdAt: string;
    }, {
        name: string;
        languages: string[];
        deploymentType: "customer-facing-widget" | "internal-copilot" | "custom";
        createdAt: string;
    }>;
    readonly brief: z.ZodObject<{
        businessScope: z.ZodString;
        customers: z.ZodString;
        allowedActions: z.ZodArray<z.ZodString, "many">;
        forbiddenActions: z.ZodArray<z.ZodString, "many">;
        tone: z.ZodString;
        primaryUseCases: z.ZodArray<z.ZodString, "many">;
        vocabulary: z.ZodArray<z.ZodObject<{
            term: z.ZodString;
            definition: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            term: string;
            definition: string;
        }, {
            term: string;
            definition: string;
        }>, "many">;
        antiPatterns: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        businessScope: string;
        customers: string;
        allowedActions: string[];
        forbiddenActions: string[];
        tone: string;
        primaryUseCases: string[];
        vocabulary: {
            term: string;
            definition: string;
        }[];
        antiPatterns?: string[] | undefined;
    }, {
        businessScope: string;
        customers: string;
        allowedActions: string[];
        forbiddenActions: string[];
        tone: string;
        primaryUseCases: string[];
        vocabulary: {
            term: string;
            definition: string;
        }[];
        antiPatterns?: string[] | undefined;
    }>;
    readonly "schema-map": z.ZodObject<{
        summary: z.ZodString;
        entities: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            classification: z.ZodEnum<["indexable", "reference", "infrastructure"]>;
            sourceTables: z.ZodArray<z.ZodString, "many">;
            joinedReferences: z.ZodArray<z.ZodString, "many">;
            columns: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                decision: z.ZodEnum<["index", "reference", "exclude-pii", "exclude-internal"]>;
                notes: z.ZodOptional<z.ZodString>;
            }, "strip", z.ZodTypeAny, {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }, {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }>, "many">;
            evidence: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            name: string;
            classification: "indexable" | "reference" | "infrastructure";
            sourceTables: string[];
            joinedReferences: string[];
            columns: {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }[];
            evidence: string;
        }, {
            name: string;
            classification: "indexable" | "reference" | "infrastructure";
            sourceTables: string[];
            joinedReferences: string[];
            columns: {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }[];
            evidence: string;
        }>, "many">;
        referenceTables: z.ZodArray<z.ZodString, "many">;
        infrastructureTables: z.ZodArray<z.ZodString, "many">;
        piiExcluded: z.ZodArray<z.ZodObject<{
            table: z.ZodString;
            columns: z.ZodArray<z.ZodString, "many">;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            columns: string[];
            table: string;
            reason: string;
        }, {
            columns: string[];
            table: string;
            reason: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        entities: {
            name: string;
            classification: "indexable" | "reference" | "infrastructure";
            sourceTables: string[];
            joinedReferences: string[];
            columns: {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }[];
            evidence: string;
        }[];
        referenceTables: string[];
        infrastructureTables: string[];
        piiExcluded: {
            columns: string[];
            table: string;
            reason: string;
        }[];
    }, {
        summary: string;
        entities: {
            name: string;
            classification: "indexable" | "reference" | "infrastructure";
            sourceTables: string[];
            joinedReferences: string[];
            columns: {
                name: string;
                decision: "reference" | "index" | "exclude-pii" | "exclude-internal";
                notes?: string | undefined;
            }[];
            evidence: string;
        }[];
        referenceTables: string[];
        infrastructureTables: string[];
        piiExcluded: {
            columns: string[];
            table: string;
            reason: string;
        }[];
    }>;
    readonly "action-manifest": z.ZodObject<{
        summary: z.ZodString;
        tools: z.ZodArray<z.ZodObject<{
            entity: z.ZodString;
            items: z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                description: z.ZodString;
                parameters: z.ZodRecord<z.ZodString, z.ZodUnknown>;
                requiresConfirmation: z.ZodBoolean;
                source: z.ZodObject<{
                    path: z.ZodString;
                    method: z.ZodString;
                    security: z.ZodOptional<z.ZodString>;
                }, "strip", z.ZodTypeAny, {
                    path: string;
                    method: string;
                    security?: string | undefined;
                }, {
                    path: string;
                    method: string;
                    security?: string | undefined;
                }>;
                parameterSources: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }, {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            entity: string;
            items: {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }[];
        }, {
            entity: string;
            items: {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }[];
        }>, "many">;
        excluded: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            method: z.ZodString;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            reason: string;
            method: string;
        }, {
            path: string;
            reason: string;
            method: string;
        }>, "many">;
        runtimeSystemPromptBlock: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        tools: {
            entity: string;
            items: {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }[];
        }[];
        excluded: {
            path: string;
            reason: string;
            method: string;
        }[];
        runtimeSystemPromptBlock: string;
    }, {
        summary: string;
        tools: {
            entity: string;
            items: {
                name: string;
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                parameterSources: string[];
            }[];
        }[];
        excluded: {
            path: string;
            reason: string;
            method: string;
        }[];
        runtimeSystemPromptBlock: string;
    }>;
    readonly "build-plan": z.ZodObject<{
        summary: z.ZodString;
        embeddingApproach: z.ZodString;
        categoryVocabularies: z.ZodArray<z.ZodObject<{
            entity: z.ZodString;
            terms: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            entity: string;
            terms: string[];
        }, {
            entity: string;
            terms: string[];
        }>, "many">;
        enrichmentPromptTemplates: z.ZodArray<z.ZodObject<{
            entity: z.ZodString;
            template: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            entity: string;
            template: string;
        }, {
            entity: string;
            template: string;
        }>, "many">;
        estimatedEntityCounts: z.ZodRecord<z.ZodString, z.ZodNumber>;
        costEstimate: z.ZodObject<{
            enrichmentCalls: z.ZodNumber;
            perCallCostUsd: z.ZodNumber;
            totalCostUsd: z.ZodNumber;
            retryBufferUsd: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            enrichmentCalls: number;
            perCallCostUsd: number;
            totalCostUsd: number;
            retryBufferUsd: number;
        }, {
            enrichmentCalls: number;
            perCallCostUsd: number;
            totalCostUsd: number;
            retryBufferUsd: number;
        }>;
        backendConfigurationDefaults: z.ZodRecord<z.ZodString, z.ZodString>;
        widgetConfigurationDefaults: z.ZodRecord<z.ZodString, z.ZodString>;
        buildSequence: z.ZodArray<z.ZodString, "many">;
        failureHandling: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        summary: string;
        embeddingApproach: string;
        categoryVocabularies: {
            entity: string;
            terms: string[];
        }[];
        enrichmentPromptTemplates: {
            entity: string;
            template: string;
        }[];
        estimatedEntityCounts: Record<string, number>;
        costEstimate: {
            enrichmentCalls: number;
            perCallCostUsd: number;
            totalCostUsd: number;
            retryBufferUsd: number;
        };
        backendConfigurationDefaults: Record<string, string>;
        widgetConfigurationDefaults: Record<string, string>;
        buildSequence: string[];
        failureHandling: string;
    }, {
        summary: string;
        embeddingApproach: string;
        categoryVocabularies: {
            entity: string;
            terms: string[];
        }[];
        enrichmentPromptTemplates: {
            entity: string;
            template: string;
        }[];
        estimatedEntityCounts: Record<string, number>;
        costEstimate: {
            enrichmentCalls: number;
            perCallCostUsd: number;
            totalCostUsd: number;
            retryBufferUsd: number;
        };
        backendConfigurationDefaults: Record<string, string>;
        widgetConfigurationDefaults: Record<string, string>;
        buildSequence: string[];
        failureHandling: string;
    }>;
};
export type ArtifactContent<K extends ArtifactKind> = K extends "project" ? ProjectArtifact : K extends "brief" ? BriefArtifact : K extends "schema-map" ? SchemaMapArtifact : K extends "action-manifest" ? ActionManifestArtifact : K extends "build-plan" ? BuildPlanArtifact : never;
export declare const AssembledEntityInputSchema: z.ZodObject<{
    entity_type: z.ZodString;
    entity_id: z.ZodString;
    project_brief_summary: z.ZodString;
    primary_record: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    related: z.ZodDefault<z.ZodArray<z.ZodObject<{
        relation: z.ZodString;
        rows: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    }, "strip", z.ZodTypeAny, {
        relation: string;
        rows: Record<string, unknown>[];
    }, {
        relation: string;
        rows: Record<string, unknown>[];
    }>, "many">>;
    metadata: z.ZodObject<{
        assembled_at: z.ZodString;
        assembler_version: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        assembled_at: string;
        assembler_version: string;
    }, {
        assembled_at: string;
        assembler_version: string;
    }>;
}, "strip", z.ZodTypeAny, {
    entity_type: string;
    entity_id: string;
    project_brief_summary: string;
    primary_record: Record<string, unknown>;
    related: {
        relation: string;
        rows: Record<string, unknown>[];
    }[];
    metadata: {
        assembled_at: string;
        assembler_version: string;
    };
}, {
    entity_type: string;
    entity_id: string;
    project_brief_summary: string;
    primary_record: Record<string, unknown>;
    metadata: {
        assembled_at: string;
        assembler_version: string;
    };
    related?: {
        relation: string;
        rows: Record<string, unknown>[];
    }[] | undefined;
}>;
export type AssembledEntityInput = z.infer<typeof AssembledEntityInputSchema>;
export declare const EnrichedFactSchema: z.ZodObject<{
    claim: z.ZodString;
    source: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source: string;
    claim: string;
}, {
    source: string;
    claim: string;
}>;
export type EnrichedFact = z.infer<typeof EnrichedFactSchema>;
export declare const EnrichedResponseSchema: z.ZodObject<{
    kind: z.ZodLiteral<"enriched">;
    document: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        claim: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        claim: string;
    }, {
        source: string;
        claim: string;
    }>, "many">;
    categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "enriched";
    document: string;
    facts: {
        source: string;
        claim: string;
    }[];
    categories: Record<string, string[]>;
}, {
    kind: "enriched";
    document: string;
    facts: {
        source: string;
        claim: string;
    }[];
    categories: Record<string, string[]>;
}>;
export type EnrichedResponse = z.infer<typeof EnrichedResponseSchema>;
export declare const InsufficientDataResponseSchema: z.ZodObject<{
    insufficient_data: z.ZodLiteral<true>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    insufficient_data: true;
}, {
    reason: string;
    insufficient_data: true;
}>;
export type InsufficientDataResponse = z.infer<typeof InsufficientDataResponseSchema>;
export declare const EnrichmentResponseSchema: z.ZodUnion<[z.ZodObject<{
    kind: z.ZodLiteral<"enriched">;
    document: z.ZodString;
    facts: z.ZodArray<z.ZodObject<{
        claim: z.ZodString;
        source: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: string;
        claim: string;
    }, {
        source: string;
        claim: string;
    }>, "many">;
    categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "enriched";
    document: string;
    facts: {
        source: string;
        claim: string;
    }[];
    categories: Record<string, string[]>;
}, {
    kind: "enriched";
    document: string;
    facts: {
        source: string;
        claim: string;
    }[];
    categories: Record<string, string[]>;
}>, z.ZodObject<{
    insufficient_data: z.ZodLiteral<true>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: string;
    insufficient_data: true;
}, {
    reason: string;
    insufficient_data: true;
}>]>;
export type EnrichmentResponse = z.infer<typeof EnrichmentResponseSchema>;
export declare const ManifestFailureReasonSchema: z.ZodEnum<["insufficient_data", "validation_failed_twice", "opus_400", "opus_5xx_twice", "missing_source_data"]>;
export type ManifestFailureReason = z.infer<typeof ManifestFailureReasonSchema>;
export declare const ManifestFailureSchema: z.ZodObject<{
    entity_type: z.ZodString;
    entity_id: z.ZodString;
    reason: z.ZodEnum<["insufficient_data", "validation_failed_twice", "opus_400", "opus_5xx_twice", "missing_source_data"]>;
    details: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
    entity_type: string;
    entity_id: string;
    details: string;
}, {
    reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
    entity_type: string;
    entity_id: string;
    details: string;
}>;
export declare const PipelineStepSchema: z.ZodEnum<["render", "bundle", "image", "compose", "scan"]>;
export type PipelineStep = z.infer<typeof PipelineStepSchema>;
export declare const PipelineFailureCodeSchema: z.ZodEnum<["TEMPLATE_COMPILE", "VENDOR_IMPORT_UNRESOLVED", "DOCKER_UNREACHABLE", "DOCKER_BUILD", "SECRET_IN_CONTEXT", "COMPOSE_ACTIVATE_FAILED", "SCAN_FAILED"]>;
export type PipelineFailureCode = z.infer<typeof PipelineFailureCodeSchema>;
export declare const PipelineFailureSchema: z.ZodObject<{
    step: z.ZodEnum<["render", "bundle", "image", "compose", "scan"]>;
    code: z.ZodEnum<["TEMPLATE_COMPILE", "VENDOR_IMPORT_UNRESOLVED", "DOCKER_UNREACHABLE", "DOCKER_BUILD", "SECRET_IN_CONTEXT", "COMPOSE_ACTIVATE_FAILED", "SCAN_FAILED"]>;
    message: z.ZodString;
}, "strip", z.ZodTypeAny, {
    code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
    message: string;
    step: "render" | "bundle" | "image" | "compose" | "scan";
}, {
    code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
    message: string;
    step: "render" | "bundle" | "image" | "compose" | "scan";
}>;
export type PipelineFailure = z.infer<typeof PipelineFailureSchema>;
export declare const RenderStepActionSchema: z.ZodEnum<["created", "rewritten", "unchanged"]>;
export declare const BundleStepActionSchema: z.ZodEnum<["created", "rewritten", "unchanged"]>;
export declare const ImageStepActionSchema: z.ZodEnum<["created", "rebuilt", "unchanged", "skipped", "failed"]>;
export declare const ComposeStepActionSchema: z.ZodEnum<["activated", "unchanged", "skipped"]>;
export declare const ScanStepActionSchema: z.ZodEnum<["ran", "skipped"]>;
export declare const ActionExecutorsStepSchema: z.ZodObject<{
    action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
    path: z.ZodString;
    sha256: z.ZodString;
    bytes: z.ZodNumber;
    warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    path: string;
    sha256: string;
    action: "created" | "rewritten" | "unchanged";
    bytes: number;
    warnings: string[];
}, {
    path: string;
    sha256: string;
    action: "created" | "rewritten" | "unchanged";
    bytes: number;
    warnings?: string[] | undefined;
}>;
export type ActionExecutorsStep = z.infer<typeof ActionExecutorsStepSchema>;
export declare const PipelineStepsSchema: z.ZodObject<{
    render: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
        files_changed: z.ZodNumber;
        action_executors: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
            path: z.ZodString;
            sha256: z.ZodString;
            bytes: z.ZodNumber;
            warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings: string[];
        }, {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings?: string[] | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        action: "created" | "rewritten" | "unchanged";
        files_changed: number;
        action_executors?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings: string[];
        } | undefined;
    }, {
        action: "created" | "rewritten" | "unchanged";
        files_changed: number;
        action_executors?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings?: string[] | undefined;
        } | undefined;
    }>>;
    bundle: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
    }, "strip", z.ZodTypeAny, {
        action: "created" | "rewritten" | "unchanged";
    }, {
        action: "created" | "rewritten" | "unchanged";
    }>>;
    image: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["created", "rebuilt", "unchanged", "skipped", "failed"]>;
        reason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
        reason?: string | undefined;
    }, {
        action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
        reason?: string | undefined;
    }>>;
    compose: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["activated", "unchanged", "skipped"]>;
    }, "strip", z.ZodTypeAny, {
        action: "unchanged" | "skipped" | "activated";
    }, {
        action: "unchanged" | "skipped" | "activated";
    }>>;
    scan: z.ZodOptional<z.ZodObject<{
        action: z.ZodEnum<["ran", "skipped"]>;
        clean: z.ZodOptional<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        action: "skipped" | "ran";
        clean?: boolean | undefined;
    }, {
        action: "skipped" | "ran";
        clean?: boolean | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    render?: {
        action: "created" | "rewritten" | "unchanged";
        files_changed: number;
        action_executors?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings: string[];
        } | undefined;
    } | undefined;
    bundle?: {
        action: "created" | "rewritten" | "unchanged";
    } | undefined;
    image?: {
        action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
        reason?: string | undefined;
    } | undefined;
    compose?: {
        action: "unchanged" | "skipped" | "activated";
    } | undefined;
    scan?: {
        action: "skipped" | "ran";
        clean?: boolean | undefined;
    } | undefined;
}, {
    render?: {
        action: "created" | "rewritten" | "unchanged";
        files_changed: number;
        action_executors?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
            warnings?: string[] | undefined;
        } | undefined;
    } | undefined;
    bundle?: {
        action: "created" | "rewritten" | "unchanged";
    } | undefined;
    image?: {
        action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
        reason?: string | undefined;
    } | undefined;
    compose?: {
        action: "unchanged" | "skipped" | "activated";
    } | undefined;
    scan?: {
        action: "skipped" | "ran";
        clean?: boolean | undefined;
    } | undefined;
}>;
export type PipelineSteps = z.infer<typeof PipelineStepsSchema>;
export declare const ManifestResultSchema: z.ZodEnum<["success", "partial", "aborted", "failed", "nothing-to-do"]>;
export type ManifestResult = z.infer<typeof ManifestResultSchema>;
export declare const ConcurrencyReductionSchema: z.ZodObject<{
    at: z.ZodString;
    from: z.ZodNumber;
    to: z.ZodNumber;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    at: string;
    reason: string;
    from: number;
    to: number;
}, {
    at: string;
    reason: string;
    from: number;
    to: number;
}>;
export declare const BuildManifestSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1">;
    build_id: z.ZodString;
    started_at: z.ZodString;
    completed_at: z.ZodString;
    duration_seconds: z.ZodNumber;
    result: z.ZodEnum<["success", "partial", "aborted", "failed", "nothing-to-do"]>;
    totals: z.ZodObject<{
        total_entities: z.ZodNumber;
        enriched: z.ZodNumber;
        skipped_unchanged: z.ZodNumber;
        failed: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        enriched: number;
        failed: number;
        total_entities: number;
        skipped_unchanged: number;
    }, {
        enriched: number;
        failed: number;
        total_entities: number;
        skipped_unchanged: number;
    }>;
    failures: z.ZodDefault<z.ZodArray<z.ZodObject<{
        entity_type: z.ZodString;
        entity_id: z.ZodString;
        reason: z.ZodEnum<["insufficient_data", "validation_failed_twice", "opus_400", "opus_5xx_twice", "missing_source_data"]>;
        details: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
        entity_type: string;
        entity_id: string;
        details: string;
    }, {
        reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
        entity_type: string;
        entity_id: string;
        details: string;
    }>, "many">>;
    opus: z.ZodObject<{
        calls: z.ZodNumber;
        input_tokens: z.ZodNumber;
        output_tokens: z.ZodNumber;
        cost_usd: z.ZodNumber;
        estimated_cost_usd: z.ZodOptional<z.ZodNumber>;
        cost_variance_pct: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        calls: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
    }, {
        calls: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
    }>;
    concurrency: z.ZodObject<{
        configured: z.ZodNumber;
        effective_max: z.ZodNumber;
        reductions: z.ZodDefault<z.ZodArray<z.ZodObject<{
            at: z.ZodString;
            from: z.ZodNumber;
            to: z.ZodNumber;
            reason: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            at: string;
            reason: string;
            from: number;
            to: number;
        }, {
            at: string;
            reason: string;
            from: number;
            to: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        configured: number;
        effective_max: number;
        reductions: {
            at: string;
            reason: string;
            from: number;
            to: number;
        }[];
    }, {
        configured: number;
        effective_max: number;
        reductions?: {
            at: string;
            reason: string;
            from: number;
            to: number;
        }[] | undefined;
    }>;
    input_hashes: z.ZodRecord<z.ZodString, z.ZodString>;
    outputs: z.ZodObject<{
        backend_files: z.ZodDefault<z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            sha256: z.ZodString;
            bytes: z.ZodNumber;
            action: z.ZodEnum<["rewritten", "unchanged", "created"]>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }, {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }>, "many">>;
        widget_bundle: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            js: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
                bytes: z.ZodNumber;
                gzip_bytes: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            }, {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            }>;
            css: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
                bytes: z.ZodNumber;
                gzip_bytes: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            }, {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            }>;
            source: z.ZodObject<{
                package_version: z.ZodString;
                tree_hash: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                package_version: string;
                tree_hash: string;
            }, {
                package_version: string;
                tree_hash: string;
            }>;
        }, "strip", z.ZodTypeAny, {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        }, {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        }>>>;
        backend_image: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            ref: z.ZodString;
            image_id: z.ZodString;
            size_bytes: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            ref: string;
            image_id: string;
            size_bytes: number;
        }, {
            ref: string;
            image_id: string;
            size_bytes: number;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        backend_files: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }[];
        widget_bundle: {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        } | null;
        backend_image: {
            ref: string;
            image_id: string;
            size_bytes: number;
        } | null;
    }, {
        backend_files?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }[] | undefined;
        widget_bundle?: {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        } | null | undefined;
        backend_image?: {
            ref: string;
            image_id: string;
            size_bytes: number;
        } | null | undefined;
    }>;
    environment: z.ZodObject<{
        platform: z.ZodString;
        node_version: z.ZodString;
        docker_server_version: z.ZodString;
        postgres_image_digest: z.ZodString;
        embedding_model: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        platform: string;
        node_version: string;
        docker_server_version: string;
        postgres_image_digest: string;
        embedding_model: string;
    }, {
        platform: string;
        node_version: string;
        docker_server_version: string;
        postgres_image_digest: string;
        embedding_model: string;
    }>;
    compliance_scan: z.ZodObject<{
        ran: z.ZodBoolean;
        clean: z.ZodBoolean;
        values_checked: z.ZodNumber;
        matches: z.ZodDefault<z.ZodArray<z.ZodObject<{
            entity_type: z.ZodString;
            entity_id: z.ZodString;
            pii_column: z.ZodString;
            matched_snippet: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }, {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        ran: boolean;
        clean: boolean;
        values_checked: number;
        matches: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[];
    }, {
        ran: boolean;
        clean: boolean;
        values_checked: number;
        matches?: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[] | undefined;
    }>;
    steps: z.ZodOptional<z.ZodObject<{
        render: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
            files_changed: z.ZodNumber;
            action_executors: z.ZodOptional<z.ZodObject<{
                action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
                path: z.ZodString;
                sha256: z.ZodString;
                bytes: z.ZodNumber;
                warnings: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings: string[];
            }, {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings?: string[] | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings: string[];
            } | undefined;
        }, {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings?: string[] | undefined;
            } | undefined;
        }>>;
        bundle: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["created", "rewritten", "unchanged"]>;
        }, "strip", z.ZodTypeAny, {
            action: "created" | "rewritten" | "unchanged";
        }, {
            action: "created" | "rewritten" | "unchanged";
        }>>;
        image: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["created", "rebuilt", "unchanged", "skipped", "failed"]>;
            reason: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        }, {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        }>>;
        compose: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["activated", "unchanged", "skipped"]>;
        }, "strip", z.ZodTypeAny, {
            action: "unchanged" | "skipped" | "activated";
        }, {
            action: "unchanged" | "skipped" | "activated";
        }>>;
        scan: z.ZodOptional<z.ZodObject<{
            action: z.ZodEnum<["ran", "skipped"]>;
            clean: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        }, {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        render?: {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings: string[];
            } | undefined;
        } | undefined;
        bundle?: {
            action: "created" | "rewritten" | "unchanged";
        } | undefined;
        image?: {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        } | undefined;
        compose?: {
            action: "unchanged" | "skipped" | "activated";
        } | undefined;
        scan?: {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        } | undefined;
    }, {
        render?: {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings?: string[] | undefined;
            } | undefined;
        } | undefined;
        bundle?: {
            action: "created" | "rewritten" | "unchanged";
        } | undefined;
        image?: {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        } | undefined;
        compose?: {
            action: "unchanged" | "skipped" | "activated";
        } | undefined;
        scan?: {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        } | undefined;
    }>>;
    pipeline_failures: z.ZodOptional<z.ZodArray<z.ZodObject<{
        step: z.ZodEnum<["render", "bundle", "image", "compose", "scan"]>;
        code: z.ZodEnum<["TEMPLATE_COMPILE", "VENDOR_IMPORT_UNRESOLVED", "DOCKER_UNREACHABLE", "DOCKER_BUILD", "SECRET_IN_CONTEXT", "COMPOSE_ACTIVATE_FAILED", "SCAN_FAILED"]>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
        message: string;
        step: "render" | "bundle" | "image" | "compose" | "scan";
    }, {
        code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
        message: string;
        step: "render" | "bundle" | "image" | "compose" | "scan";
    }>, "many">>;
    warnings: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    schema_version: "1";
    build_id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    result: "aborted" | "failed" | "success" | "partial" | "nothing-to-do";
    totals: {
        enriched: number;
        failed: number;
        total_entities: number;
        skipped_unchanged: number;
    };
    failures: {
        reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
        entity_type: string;
        entity_id: string;
        details: string;
    }[];
    opus: {
        calls: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
    };
    concurrency: {
        configured: number;
        effective_max: number;
        reductions: {
            at: string;
            reason: string;
            from: number;
            to: number;
        }[];
    };
    input_hashes: Record<string, string>;
    outputs: {
        backend_files: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }[];
        widget_bundle: {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        } | null;
        backend_image: {
            ref: string;
            image_id: string;
            size_bytes: number;
        } | null;
    };
    environment: {
        platform: string;
        node_version: string;
        docker_server_version: string;
        postgres_image_digest: string;
        embedding_model: string;
    };
    compliance_scan: {
        ran: boolean;
        clean: boolean;
        values_checked: number;
        matches: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[];
    };
    warnings?: string[] | undefined;
    steps?: {
        render?: {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings: string[];
            } | undefined;
        } | undefined;
        bundle?: {
            action: "created" | "rewritten" | "unchanged";
        } | undefined;
        image?: {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        } | undefined;
        compose?: {
            action: "unchanged" | "skipped" | "activated";
        } | undefined;
        scan?: {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        } | undefined;
    } | undefined;
    pipeline_failures?: {
        code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
        message: string;
        step: "render" | "bundle" | "image" | "compose" | "scan";
    }[] | undefined;
}, {
    schema_version: "1";
    build_id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    result: "aborted" | "failed" | "success" | "partial" | "nothing-to-do";
    totals: {
        enriched: number;
        failed: number;
        total_entities: number;
        skipped_unchanged: number;
    };
    opus: {
        calls: number;
        input_tokens: number;
        output_tokens: number;
        cost_usd: number;
        estimated_cost_usd?: number | undefined;
        cost_variance_pct?: number | undefined;
    };
    concurrency: {
        configured: number;
        effective_max: number;
        reductions?: {
            at: string;
            reason: string;
            from: number;
            to: number;
        }[] | undefined;
    };
    input_hashes: Record<string, string>;
    outputs: {
        backend_files?: {
            path: string;
            sha256: string;
            action: "created" | "rewritten" | "unchanged";
            bytes: number;
        }[] | undefined;
        widget_bundle?: {
            source: {
                package_version: string;
                tree_hash: string;
            };
            js: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
            css: {
                path: string;
                sha256: string;
                bytes: number;
                gzip_bytes: number;
            };
        } | null | undefined;
        backend_image?: {
            ref: string;
            image_id: string;
            size_bytes: number;
        } | null | undefined;
    };
    environment: {
        platform: string;
        node_version: string;
        docker_server_version: string;
        postgres_image_digest: string;
        embedding_model: string;
    };
    compliance_scan: {
        ran: boolean;
        clean: boolean;
        values_checked: number;
        matches?: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[] | undefined;
    };
    warnings?: string[] | undefined;
    failures?: {
        reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
        entity_type: string;
        entity_id: string;
        details: string;
    }[] | undefined;
    steps?: {
        render?: {
            action: "created" | "rewritten" | "unchanged";
            files_changed: number;
            action_executors?: {
                path: string;
                sha256: string;
                action: "created" | "rewritten" | "unchanged";
                bytes: number;
                warnings?: string[] | undefined;
            } | undefined;
        } | undefined;
        bundle?: {
            action: "created" | "rewritten" | "unchanged";
        } | undefined;
        image?: {
            action: "created" | "unchanged" | "rebuilt" | "skipped" | "failed";
            reason?: string | undefined;
        } | undefined;
        compose?: {
            action: "unchanged" | "skipped" | "activated";
        } | undefined;
        scan?: {
            action: "skipped" | "ran";
            clean?: boolean | undefined;
        } | undefined;
    } | undefined;
    pipeline_failures?: {
        code: "TEMPLATE_COMPILE" | "VENDOR_IMPORT_UNRESOLVED" | "DOCKER_UNREACHABLE" | "DOCKER_BUILD" | "SECRET_IN_CONTEXT" | "COMPOSE_ACTIVATE_FAILED" | "SCAN_FAILED";
        message: string;
        step: "render" | "bundle" | "image" | "compose" | "scan";
    }[] | undefined;
}>;
export type BuildManifest = z.infer<typeof BuildManifestSchema>;
export declare const PipelineProgressSchema: z.ZodObject<{
    phase: z.ZodEnum<["BOOT", "MIGRATE", "IMPORT", "ENRICH", "RENDER", "BUNDLE", "IMAGE", "SCAN", "DONE", "ABORT"]>;
    processed: z.ZodNumber;
    total: z.ZodNumber;
    ok: z.ZodNumber;
    skipped: z.ZodNumber;
    failed: z.ZodNumber;
    cost_usd: z.ZodNumber;
    elapsed_seconds: z.ZodNumber;
    eta_seconds: z.ZodNullable<z.ZodNumber>;
    message: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    ok: number;
    skipped: number;
    failed: number;
    cost_usd: number;
    phase: "BOOT" | "MIGRATE" | "IMPORT" | "ENRICH" | "RENDER" | "BUNDLE" | "IMAGE" | "SCAN" | "DONE" | "ABORT";
    processed: number;
    total: number;
    elapsed_seconds: number;
    eta_seconds: number | null;
    message?: string | undefined;
}, {
    ok: number;
    skipped: number;
    failed: number;
    cost_usd: number;
    phase: "BOOT" | "MIGRATE" | "IMPORT" | "ENRICH" | "RENDER" | "BUNDLE" | "IMAGE" | "SCAN" | "DONE" | "ABORT";
    processed: number;
    total: number;
    elapsed_seconds: number;
    eta_seconds: number | null;
    message?: string | undefined;
}>;
export type PipelineProgress = z.infer<typeof PipelineProgressSchema>;
export declare const ConversationTurnSchema: z.ZodObject<{
    role: z.ZodEnum<["user", "assistant"]>;
    content: z.ZodString;
    timestamp: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}, {
    role: "user" | "assistant";
    content: string;
    timestamp: string;
}>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export declare const ActionFollowUpSchema: z.ZodObject<{
    action_id: z.ZodString;
    outcome: z.ZodEnum<["succeeded", "cancelled", "failed"]>;
    host_response_summary: z.ZodOptional<z.ZodString>;
    error: z.ZodOptional<z.ZodObject<{
        status: z.ZodOptional<z.ZodNumber>;
        message: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        status?: number | undefined;
    }, {
        message: string;
        status?: number | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    action_id: string;
    outcome: "failed" | "succeeded" | "cancelled";
    host_response_summary?: string | undefined;
    error?: {
        message: string;
        status?: number | undefined;
    } | undefined;
}, {
    action_id: string;
    outcome: "failed" | "succeeded" | "cancelled";
    host_response_summary?: string | undefined;
    error?: {
        message: string;
        status?: number | undefined;
    } | undefined;
}>;
export type ActionFollowUp = z.infer<typeof ActionFollowUpSchema>;
export declare const SessionContextSchema: z.ZodObject<{
    cart_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    customer_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    region_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    locale: z.ZodString;
    page_context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull, z.ZodObject<{
        action_id: z.ZodString;
        outcome: z.ZodEnum<["succeeded", "cancelled", "failed"]>;
        host_response_summary: z.ZodOptional<z.ZodString>;
        error: z.ZodOptional<z.ZodObject<{
            status: z.ZodOptional<z.ZodNumber>;
            message: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            message: string;
            status?: number | undefined;
        }, {
            message: string;
            status?: number | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        action_id: string;
        outcome: "failed" | "succeeded" | "cancelled";
        host_response_summary?: string | undefined;
        error?: {
            message: string;
            status?: number | undefined;
        } | undefined;
    }, {
        action_id: string;
        outcome: "failed" | "succeeded" | "cancelled";
        host_response_summary?: string | undefined;
        error?: {
            message: string;
            status?: number | undefined;
        } | undefined;
    }>]>>>;
}, "strip", z.ZodTypeAny, {
    locale: string;
    cart_id?: string | null | undefined;
    customer_id?: string | null | undefined;
    region_id?: string | null | undefined;
    page_context?: Record<string, string | number | boolean | {
        action_id: string;
        outcome: "failed" | "succeeded" | "cancelled";
        host_response_summary?: string | undefined;
        error?: {
            message: string;
            status?: number | undefined;
        } | undefined;
    } | null> | undefined;
}, {
    locale: string;
    cart_id?: string | null | undefined;
    customer_id?: string | null | undefined;
    region_id?: string | null | undefined;
    page_context?: Record<string, string | number | boolean | {
        action_id: string;
        outcome: "failed" | "succeeded" | "cancelled";
        host_response_summary?: string | undefined;
        error?: {
            message: string;
            status?: number | undefined;
        } | undefined;
    } | null> | undefined;
}>;
export type SessionContext = z.infer<typeof SessionContextSchema>;
/**
 * Feature 007 — Tool-result payload posted back by the widget after a
 * client-side fetch. Contract: specs/007-widget-tool-loop/contracts/
 * chat-endpoint-v2.md §Request shape.
 *
 * `content` is an opaque string (the widget truncates the shop response
 * to BODY_LIMIT=4096 bytes before posting) that the backend forwards
 * verbatim into the Anthropic `tool_result` block.
 */
export declare const ToolResultPayloadSchema: z.ZodObject<{
    tool_use_id: z.ZodString;
    content: z.ZodString;
    is_error: z.ZodBoolean;
    status: z.ZodNumber;
    truncated: z.ZodBoolean;
}, "strip", z.ZodTypeAny, {
    status: number;
    content: string;
    tool_use_id: string;
    is_error: boolean;
    truncated: boolean;
}, {
    status: number;
    content: string;
    tool_use_id: string;
    is_error: boolean;
    truncated: boolean;
}>;
export type ToolResultPayload = z.infer<typeof ToolResultPayloadSchema>;
export declare const ChatRequestSchema: z.ZodObject<{
    message: z.ZodString;
    history: z.ZodArray<z.ZodObject<{
        role: z.ZodEnum<["user", "assistant"]>;
        content: z.ZodString;
        timestamp: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }, {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }>, "many">;
    context: z.ZodObject<{
        cart_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        customer_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        region_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        locale: z.ZodString;
        page_context: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber, z.ZodBoolean, z.ZodNull, z.ZodObject<{
            action_id: z.ZodString;
            outcome: z.ZodEnum<["succeeded", "cancelled", "failed"]>;
            host_response_summary: z.ZodOptional<z.ZodString>;
            error: z.ZodOptional<z.ZodObject<{
                status: z.ZodOptional<z.ZodNumber>;
                message: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                message: string;
                status?: number | undefined;
            }, {
                message: string;
                status?: number | undefined;
            }>>;
        }, "strip", z.ZodTypeAny, {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        }, {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        }>]>>>;
    }, "strip", z.ZodTypeAny, {
        locale: string;
        cart_id?: string | null | undefined;
        customer_id?: string | null | undefined;
        region_id?: string | null | undefined;
        page_context?: Record<string, string | number | boolean | {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        } | null> | undefined;
    }, {
        locale: string;
        cart_id?: string | null | undefined;
        customer_id?: string | null | undefined;
        region_id?: string | null | undefined;
        page_context?: Record<string, string | number | boolean | {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        } | null> | undefined;
    }>;
    /** Feature 007 — carried across posts of the same turn. */
    pending_turn_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    /** Feature 007 — present on resume posts; skips retrieval/embedding. */
    tool_result: z.ZodOptional<z.ZodObject<{
        tool_use_id: z.ZodString;
        content: z.ZodString;
        is_error: z.ZodBoolean;
        status: z.ZodNumber;
        truncated: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        status: number;
        content: string;
        tool_use_id: string;
        is_error: boolean;
        truncated: boolean;
    }, {
        status: number;
        content: string;
        tool_use_id: string;
        is_error: boolean;
        truncated: boolean;
    }>>;
    /** Feature 007 — decrements by 1 on each action_intent emitted. */
    tool_call_budget_remaining: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    message: string;
    history: {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }[];
    context: {
        locale: string;
        cart_id?: string | null | undefined;
        customer_id?: string | null | undefined;
        region_id?: string | null | undefined;
        page_context?: Record<string, string | number | boolean | {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        } | null> | undefined;
    };
    pending_turn_id?: string | null | undefined;
    tool_result?: {
        status: number;
        content: string;
        tool_use_id: string;
        is_error: boolean;
        truncated: boolean;
    } | undefined;
    tool_call_budget_remaining?: number | undefined;
}, {
    message: string;
    history: {
        role: "user" | "assistant";
        content: string;
        timestamp: string;
    }[];
    context: {
        locale: string;
        cart_id?: string | null | undefined;
        customer_id?: string | null | undefined;
        region_id?: string | null | undefined;
        page_context?: Record<string, string | number | boolean | {
            action_id: string;
            outcome: "failed" | "succeeded" | "cancelled";
            host_response_summary?: string | undefined;
            error?: {
                message: string;
                status?: number | undefined;
            } | undefined;
        } | null> | undefined;
    };
    pending_turn_id?: string | null | undefined;
    tool_result?: {
        status: number;
        content: string;
        tool_use_id: string;
        is_error: boolean;
        truncated: boolean;
    } | undefined;
    tool_call_budget_remaining?: number | undefined;
}>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export declare const CitationSchema: z.ZodObject<{
    entity_id: z.ZodString;
    entity_type: z.ZodString;
    relevance: z.ZodNumber;
    href: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    entity_type: string;
    entity_id: string;
    relevance: number;
    title?: string | undefined;
    href?: string | undefined;
}, {
    entity_type: string;
    entity_id: string;
    relevance: number;
    title?: string | undefined;
    href?: string | undefined;
}>;
export type Citation = z.infer<typeof CitationSchema>;
/**
 * Feature 007 — action intent emitted by the backend on `tool_use`.
 * The widget resolves it through `action-executors.json`, fetches the
 * shop, and posts the result back.
 *
 * `confirmation_required` is a union now: reads (Feature 007 US2/US3)
 * run inline with `false`; writes (US4) keep the existing confirmation
 * card flow with `true`.
 */
export declare const ActionIntentSchema: z.ZodObject<{
    id: z.ZodString;
    tool: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    description: z.ZodString;
    confirmation_required: z.ZodBoolean;
    http: z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    }, {
        path: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    }>;
    summary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    description: string;
    id: string;
    tool: string;
    arguments: Record<string, unknown>;
    confirmation_required: boolean;
    http: {
        path: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    };
    summary?: Record<string, string> | undefined;
}, {
    description: string;
    id: string;
    tool: string;
    arguments: Record<string, unknown>;
    confirmation_required: boolean;
    http: {
        path: string;
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    };
    summary?: Record<string, string> | undefined;
}>;
export type ActionIntent = z.infer<typeof ActionIntentSchema>;
/**
 * Feature 007 — the two response variants from `POST /v1/chat`:
 *   - final text (stop_reason !== "tool_use"): {message, citations, pending_turn_id: null}
 *   - action intent (stop_reason === "tool_use"): {action_intent, pending_turn_id, tool_call_budget_remaining}
 *
 * `actions[]` is kept as a pass-through for backward-compat consumers
 * that still read the old shape; it carries the same single intent when
 * present so existing v1 unit tests keep passing.
 */
export declare const ChatResponseSchema: z.ZodObject<{
    message: z.ZodString;
    citations: z.ZodArray<z.ZodObject<{
        entity_id: z.ZodString;
        entity_type: z.ZodString;
        relevance: z.ZodNumber;
        href: z.ZodOptional<z.ZodString>;
        title: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        entity_type: string;
        entity_id: string;
        relevance: number;
        title?: string | undefined;
        href?: string | undefined;
    }, {
        entity_type: string;
        entity_id: string;
        relevance: number;
        title?: string | undefined;
        href?: string | undefined;
    }>, "many">;
    actions: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        tool: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        description: z.ZodString;
        confirmation_required: z.ZodBoolean;
        http: z.ZodObject<{
            method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
            path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        }, {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        }>;
        summary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }, {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }>, "many">;
    action_intent: z.ZodOptional<z.ZodObject<{
        id: z.ZodString;
        tool: z.ZodString;
        arguments: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        description: z.ZodString;
        confirmation_required: z.ZodBoolean;
        http: z.ZodObject<{
            method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
            path: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        }, {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        }>;
        summary: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }, {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }>>;
    pending_turn_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tool_call_budget_remaining: z.ZodOptional<z.ZodNumber>;
    suggestions: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    message: string;
    citations: {
        entity_type: string;
        entity_id: string;
        relevance: number;
        title?: string | undefined;
        href?: string | undefined;
    }[];
    actions: {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }[];
    request_id: string;
    pending_turn_id?: string | null | undefined;
    tool_call_budget_remaining?: number | undefined;
    action_intent?: {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    } | undefined;
    suggestions?: string[] | undefined;
}, {
    message: string;
    citations: {
        entity_type: string;
        entity_id: string;
        relevance: number;
        title?: string | undefined;
        href?: string | undefined;
    }[];
    actions: {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    }[];
    request_id: string;
    pending_turn_id?: string | null | undefined;
    tool_call_budget_remaining?: number | undefined;
    action_intent?: {
        description: string;
        id: string;
        tool: string;
        arguments: Record<string, unknown>;
        confirmation_required: boolean;
        http: {
            path: string;
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        };
        summary?: Record<string, string> | undefined;
    } | undefined;
    suggestions?: string[] | undefined;
}>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
//# sourceMappingURL=types.d.ts.map
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
            values: string[];
            name: string;
        }, {
            values: string[];
            name: string;
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
            values: string[];
            name: string;
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
            values: string[];
            name: string;
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
            values: string[];
            name: string;
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
            values: string[];
            name: string;
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
//# sourceMappingURL=types.d.ts.map
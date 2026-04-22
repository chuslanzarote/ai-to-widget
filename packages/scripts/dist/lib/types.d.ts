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
    deploymentType: "custom" | "customer-facing-widget" | "internal-copilot";
    createdAt: string;
}, {
    name: string;
    languages: string[];
    deploymentType: "custom" | "customer-facing-widget" | "internal-copilot";
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
    source: {
        path: string;
        method: string;
        security?: string | undefined;
    };
    description: string;
    parameters: Record<string, unknown>;
    requiresConfirmation: boolean;
    parameterSources: string[];
}, {
    name: string;
    source: {
        path: string;
        method: string;
        security?: string | undefined;
    };
    description: string;
    parameters: Record<string, unknown>;
    requiresConfirmation: boolean;
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
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            parameterSources: string[];
        }, {
            name: string;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            parameterSources: string[];
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        entity: string;
        items: {
            name: string;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
            parameterSources: string[];
        }[];
    }, {
        entity: string;
        items: {
            name: string;
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
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
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
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
            source: {
                path: string;
                method: string;
                security?: string | undefined;
            };
            description: string;
            parameters: Record<string, unknown>;
            requiresConfirmation: boolean;
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
    default: string | null;
    name: string;
    dataType: string;
    nullable: boolean;
    isPrimaryKey: boolean;
    comment: string | null;
}, {
    default: string | null;
    name: string;
    dataType: string;
    nullable: boolean;
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
        default: string | null;
        name: string;
        dataType: string;
        nullable: boolean;
        isPrimaryKey: boolean;
        comment: string | null;
    }, {
        default: string | null;
        name: string;
        dataType: string;
        nullable: boolean;
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
        default: string | null;
        name: string;
        dataType: string;
        nullable: boolean;
        isPrimaryKey: boolean;
        comment: string | null;
    }[];
    schema: string;
    comment: string | null;
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
        default: string | null;
        name: string;
        dataType: string;
        nullable: boolean;
        isPrimaryKey: boolean;
        comment: string | null;
    }[];
    schema: string;
    comment: string | null;
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
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }, {
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
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
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
        column: number;
        line: number;
    }, {
        message: string;
        column: number;
        line: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    dialect: "postgres";
    schemas: {
        name: string;
        tables: {
            name: string;
            columns: {
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
        column: number;
        line: number;
    }[];
}, {
    version: 1;
    dialect: "postgres";
    schemas: {
        name: string;
        tables: {
            name: string;
            columns: {
                default: string | null;
                name: string;
                dataType: string;
                nullable: boolean;
                isPrimaryKey: boolean;
                comment: string | null;
            }[];
            schema: string;
            comment: string | null;
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
        column: number;
        line: number;
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
    summary: string | null;
    path: string;
    tag: string | null;
    id: string;
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
    summary: string | null;
    path: string;
    tag: string | null;
    id: string;
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
        summary: string | null;
        path: string;
        tag: string | null;
        id: string;
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
        summary: string | null;
        path: string;
        tag: string | null;
        id: string;
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
        summary: string | null;
        path: string;
        tag: string | null;
        id: string;
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
        summary: string | null;
        path: string;
        tag: string | null;
        id: string;
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
    sha256: string;
    path: string;
    kind: "sql-dump" | "openapi" | "brief-input" | "other";
    seenAt: string;
}, {
    sha256: string;
    path: string;
    kind: "sql-dump" | "openapi" | "brief-input" | "other";
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
        sha256: string;
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        seenAt: string;
    }, {
        sha256: string;
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        seenAt: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    version: 1;
    entries: {
        sha256: string;
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        seenAt: string;
    }[];
}, {
    version: 1;
    entries: {
        sha256: string;
        path: string;
        kind: "sql-dump" | "openapi" | "brief-input" | "other";
        seenAt: string;
    }[];
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
        kind: "schema-map" | "brief" | "project" | "action-manifest" | "build-plan";
        expectedPath: string;
    }, {
        kind: "schema-map" | "brief" | "project" | "action-manifest" | "build-plan";
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
        kind: "schema-map" | "brief" | "project" | "action-manifest" | "build-plan";
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
        kind: "schema-map" | "brief" | "project" | "action-manifest" | "build-plan";
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
        deploymentType: "custom" | "customer-facing-widget" | "internal-copilot";
        createdAt: string;
    }, {
        name: string;
        languages: string[];
        deploymentType: "custom" | "customer-facing-widget" | "internal-copilot";
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
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                parameterSources: string[];
            }, {
                name: string;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                parameterSources: string[];
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            entity: string;
            items: {
                name: string;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
                parameterSources: string[];
            }[];
        }, {
            entity: string;
            items: {
                name: string;
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
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
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
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
                source: {
                    path: string;
                    method: string;
                    security?: string | undefined;
                };
                description: string;
                parameters: Record<string, unknown>;
                requiresConfirmation: boolean;
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
    claim: string;
    source: string;
}, {
    claim: string;
    source: string;
}>;
export type EnrichedFact = z.infer<typeof EnrichedFactSchema>;
export declare const EnrichedResponseSchema: z.ZodObject<{
    kind: z.ZodLiteral<"enriched">;
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
}, "strip", z.ZodTypeAny, {
    kind: "enriched";
    document: string;
    facts: {
        claim: string;
        source: string;
    }[];
    categories: Record<string, string[]>;
}, {
    kind: "enriched";
    document: string;
    facts: {
        claim: string;
        source: string;
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
        claim: string;
        source: string;
    }, {
        claim: string;
        source: string;
    }>, "many">;
    categories: z.ZodRecord<z.ZodString, z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    kind: "enriched";
    document: string;
    facts: {
        claim: string;
        source: string;
    }[];
    categories: Record<string, string[]>;
}, {
    kind: "enriched";
    document: string;
    facts: {
        claim: string;
        source: string;
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
    to: number;
    from: number;
}, {
    at: string;
    reason: string;
    to: number;
    from: number;
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
        failed: number;
        enriched: number;
        total_entities: number;
        skipped_unchanged: number;
    }, {
        failed: number;
        enriched: number;
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
            to: number;
            from: number;
        }, {
            at: string;
            reason: string;
            to: number;
            from: number;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        configured: number;
        effective_max: number;
        reductions: {
            at: string;
            reason: string;
            to: number;
            from: number;
        }[];
    }, {
        configured: number;
        effective_max: number;
        reductions?: {
            at: string;
            reason: string;
            to: number;
            from: number;
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
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }, {
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }>, "many">>;
        widget_bundle: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            js: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
                bytes: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                sha256: string;
                path: string;
                bytes: number;
            }, {
                sha256: string;
                path: string;
                bytes: number;
            }>;
            css: z.ZodObject<{
                path: z.ZodString;
                sha256: z.ZodString;
                bytes: z.ZodNumber;
            }, "strip", z.ZodTypeAny, {
                sha256: string;
                path: string;
                bytes: number;
            }, {
                sha256: string;
                path: string;
                bytes: number;
            }>;
        }, "strip", z.ZodTypeAny, {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        }, {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        }>>>;
        backend_image: z.ZodDefault<z.ZodNullable<z.ZodObject<{
            ref: z.ZodString;
            image_id: z.ZodString;
            size_bytes: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            image_id: string;
            ref: string;
            size_bytes: number;
        }, {
            image_id: string;
            ref: string;
            size_bytes: number;
        }>>>;
    }, "strip", z.ZodTypeAny, {
        backend_files: {
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }[];
        widget_bundle: {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        } | null;
        backend_image: {
            image_id: string;
            ref: string;
            size_bytes: number;
        } | null;
    }, {
        backend_files?: {
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }[] | undefined;
        widget_bundle?: {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        } | null | undefined;
        backend_image?: {
            image_id: string;
            ref: string;
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
        matches: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[];
        ran: boolean;
        clean: boolean;
        values_checked: number;
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
}, "strip", z.ZodTypeAny, {
    schema_version: "1";
    build_id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    result: "failed" | "aborted" | "success" | "partial" | "nothing-to-do";
    totals: {
        failed: number;
        enriched: number;
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
            to: number;
            from: number;
        }[];
    };
    input_hashes: Record<string, string>;
    outputs: {
        backend_files: {
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }[];
        widget_bundle: {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        } | null;
        backend_image: {
            image_id: string;
            ref: string;
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
        matches: {
            entity_type: string;
            entity_id: string;
            pii_column: string;
            matched_snippet: string;
        }[];
        ran: boolean;
        clean: boolean;
        values_checked: number;
    };
}, {
    schema_version: "1";
    build_id: string;
    started_at: string;
    completed_at: string;
    duration_seconds: number;
    result: "failed" | "aborted" | "success" | "partial" | "nothing-to-do";
    totals: {
        failed: number;
        enriched: number;
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
            to: number;
            from: number;
        }[] | undefined;
    };
    input_hashes: Record<string, string>;
    outputs: {
        backend_files?: {
            sha256: string;
            path: string;
            bytes: number;
            action: "unchanged" | "rewritten" | "created";
        }[] | undefined;
        widget_bundle?: {
            js: {
                sha256: string;
                path: string;
                bytes: number;
            };
            css: {
                sha256: string;
                path: string;
                bytes: number;
            };
        } | null | undefined;
        backend_image?: {
            image_id: string;
            ref: string;
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
    failures?: {
        reason: "insufficient_data" | "validation_failed_twice" | "opus_400" | "opus_5xx_twice" | "missing_source_data";
        entity_type: string;
        entity_id: string;
        details: string;
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
    skipped: number;
    failed: number;
    cost_usd: number;
    total: number;
    phase: "BOOT" | "MIGRATE" | "IMPORT" | "ENRICH" | "RENDER" | "BUNDLE" | "IMAGE" | "SCAN" | "DONE" | "ABORT";
    processed: number;
    ok: number;
    elapsed_seconds: number;
    eta_seconds: number | null;
    message?: string | undefined;
}, {
    skipped: number;
    failed: number;
    cost_usd: number;
    total: number;
    phase: "BOOT" | "MIGRATE" | "IMPORT" | "ENRICH" | "RENDER" | "BUNDLE" | "IMAGE" | "SCAN" | "DONE" | "ABORT";
    processed: number;
    ok: number;
    elapsed_seconds: number;
    eta_seconds: number | null;
    message?: string | undefined;
}>;
export type PipelineProgress = z.infer<typeof PipelineProgressSchema>;
//# sourceMappingURL=types.d.ts.map
import { z } from "zod";
/* ============================================================================
 * Artifact kinds
 * ========================================================================= */
export const ArtifactKindSchema = z.enum([
    "project",
    "brief",
    "schema-map",
    "action-manifest",
    "build-plan",
]);
/* ============================================================================
 * 1.1 Project metadata (.atw/config/project.md)
 * ========================================================================= */
export const DeploymentTypeSchema = z.enum([
    "customer-facing-widget",
    "internal-copilot",
    "custom",
]);
export const ProjectArtifactSchema = z.object({
    name: z.string().min(1),
    languages: z.array(z.string().min(1)).min(1),
    deploymentType: DeploymentTypeSchema,
    createdAt: z.string(),
});
/* ============================================================================
 * 1.2 Business brief (.atw/config/brief.md)
 * ========================================================================= */
export const BriefArtifactSchema = z.object({
    businessScope: z.string(),
    customers: z.string(),
    allowedActions: z.array(z.string()),
    forbiddenActions: z.array(z.string()),
    tone: z.string(),
    primaryUseCases: z.array(z.string()),
    vocabulary: z.array(z.object({
        term: z.string(),
        definition: z.string(),
    })),
    antiPatterns: z.array(z.string()).optional(),
});
/* ============================================================================
 * 1.3 Schema map (.atw/artifacts/schema-map.md)
 * ========================================================================= */
export const SchemaMapEntitySchema = z.object({
    name: z.string(),
    classification: z.enum(["indexable", "reference", "infrastructure"]),
    sourceTables: z.array(z.string()),
    joinedReferences: z.array(z.string()),
    columns: z.array(z.object({
        name: z.string(),
        decision: z.enum(["index", "reference", "exclude-pii", "exclude-internal"]),
        notes: z.string().optional(),
    })),
    evidence: z.string(),
});
export const SchemaMapArtifactSchema = z.object({
    summary: z.string(),
    entities: z.array(SchemaMapEntitySchema),
    referenceTables: z.array(z.string()),
    infrastructureTables: z.array(z.string()),
    piiExcluded: z.array(z.object({
        table: z.string(),
        columns: z.array(z.string()),
        reason: z.string(),
    })),
});
/* ============================================================================
 * 1.4 Action manifest (.atw/artifacts/action-manifest.md)
 * ========================================================================= */
export const ActionManifestToolSchema = z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.record(z.unknown()),
    requiresConfirmation: z.boolean(),
    source: z.object({
        path: z.string(),
        method: z.string(),
        security: z.string().optional(),
    }),
    parameterSources: z.array(z.string()),
});
export const ActionManifestArtifactSchema = z.object({
    summary: z.string(),
    tools: z.array(z.object({
        entity: z.string(),
        items: z.array(ActionManifestToolSchema),
    })),
    excluded: z.array(z.object({
        path: z.string(),
        method: z.string(),
        reason: z.string(),
    })),
    runtimeSystemPromptBlock: z.string(),
});
/* ============================================================================
 * 1.5 Build plan (.atw/artifacts/build-plan.md)
 * ========================================================================= */
export const CostEstimateSchema = z.object({
    enrichmentCalls: z.number().int().nonnegative(),
    perCallCostUsd: z.number().nonnegative(),
    totalCostUsd: z.number().nonnegative(),
    retryBufferUsd: z.number().nonnegative(),
});
export const BuildPlanArtifactSchema = z.object({
    summary: z.string(),
    embeddingApproach: z.string(),
    categoryVocabularies: z.array(z.object({
        entity: z.string(),
        terms: z.array(z.string()),
    })),
    enrichmentPromptTemplates: z.array(z.object({
        entity: z.string(),
        template: z.string(),
    })),
    estimatedEntityCounts: z.record(z.number().int().nonnegative()),
    costEstimate: CostEstimateSchema,
    backendConfigurationDefaults: z.record(z.string()),
    widgetConfigurationDefaults: z.record(z.string()),
    buildSequence: z.array(z.string()),
    failureHandling: z.string(),
});
/* ============================================================================
 * 2.1 ParsedSQLSchema
 * ========================================================================= */
export const ParsedSQLColumnSchema = z.object({
    name: z.string(),
    dataType: z.string(),
    nullable: z.boolean(),
    default: z.string().nullable(),
    isPrimaryKey: z.boolean(),
    comment: z.string().nullable(),
});
export const ParsedSQLForeignKeySchema = z.object({
    columns: z.array(z.string()),
    referenceSchema: z.string(),
    referenceTable: z.string(),
    referenceColumns: z.array(z.string()),
    onDelete: z.enum(["cascade", "restrict", "set null", "no action"]).nullable(),
    onUpdate: z.enum(["cascade", "restrict", "set null", "no action"]).nullable(),
});
export const ParsedSQLTableSchema = z.object({
    schema: z.string(),
    name: z.string(),
    columns: z.array(ParsedSQLColumnSchema),
    primaryKey: z.array(z.string()),
    foreignKeys: z.array(ParsedSQLForeignKeySchema),
    uniqueConstraints: z.array(z.object({ columns: z.array(z.string()) })),
    indexes: z.array(z.object({
        name: z.string(),
        columns: z.array(z.string()),
        unique: z.boolean(),
    })),
    inherits: z.array(z.string()).nullable(),
    comment: z.string().nullable(),
});
export const ParsedSQLSchemaSchema = z.object({
    version: z.literal(1),
    dialect: z.literal("postgres"),
    schemas: z.array(z.object({
        name: z.string(),
        tables: z.array(ParsedSQLTableSchema),
        enums: z.array(z.object({
            name: z.string(),
            values: z.array(z.string()),
        })),
        extensions: z.array(z.string()),
    })),
    sampleRows: z.record(z.array(z.record(z.unknown()))),
    parseErrors: z.array(z.object({
        line: z.number().int(),
        column: z.number().int(),
        message: z.string(),
    })),
});
/* ============================================================================
 * 2.2 ParsedOpenAPI
 * ========================================================================= */
export const ParsedOpenAPIOperationSchema = z.object({
    id: z.string(),
    method: z.enum(["get", "post", "put", "patch", "delete", "head", "options"]),
    path: z.string(),
    tag: z.string().nullable(),
    summary: z.string().nullable(),
    description: z.string().nullable(),
    security: z.array(z.object({
        scheme: z.string(),
        scopes: z.array(z.string()),
    })),
    parameters: z.array(z.object({
        name: z.string(),
        in: z.enum(["query", "path", "header", "cookie"]),
        required: z.boolean(),
        schema: z.unknown(),
    })),
    requestBody: z
        .object({
        contentType: z.string(),
        schema: z.unknown(),
    })
        .nullable(),
    responses: z.array(z.object({
        status: z.string(),
        contentType: z.string().nullable(),
        schema: z.unknown().nullable(),
    })),
});
export const ParsedOpenAPISchema = z.object({
    version: z.literal(1),
    sourceVersion: z.enum(["3.1", "3.0", "2.0"]),
    sourceUrl: z.string().nullable(),
    title: z.string(),
    apiDescription: z.string().nullable(),
    servers: z.array(z.object({
        url: z.string(),
        description: z.string().nullable(),
    })),
    tags: z.array(z.object({
        name: z.string(),
        description: z.string().nullable(),
    })),
    operations: z.array(ParsedOpenAPIOperationSchema),
});
/* ============================================================================
 * 2.3 InputHashRecord + InputHashesState
 * ========================================================================= */
export const InputHashKindSchema = z.enum(["sql-dump", "openapi", "brief-input", "other"]);
export const InputHashRecordSchema = z.object({
    path: z.string(),
    kind: InputHashKindSchema,
    sha256: z.string().regex(/^[a-f0-9]{64}$/i),
    seenAt: z.string(),
});
export const InputHashesStateSchema = z.object({
    version: z.literal(1),
    entries: z.array(InputHashRecordSchema),
});
/* ============================================================================
 * 2.5 ArtifactConsistencyReport
 * ========================================================================= */
export const InconsistencyKindSchema = z.enum([
    "action-references-excluded-entity",
    "brief-references-missing-vocabulary",
    "schema-map-references-missing-brief-section",
    "plan-references-missing-upstream",
]);
export const ArtifactConsistencyReportSchema = z.object({
    ok: z.boolean(),
    missing: z.array(z.object({
        kind: ArtifactKindSchema,
        expectedPath: z.string(),
    })),
    inconsistencies: z.array(z.object({
        kind: InconsistencyKindSchema,
        detail: z.string(),
        leftPath: z.string(),
        rightPath: z.string(),
    })),
});
/* ============================================================================
 * Convenience helpers
 * ========================================================================= */
export const ARTIFACT_SCHEMAS = {
    project: ProjectArtifactSchema,
    brief: BriefArtifactSchema,
    "schema-map": SchemaMapArtifactSchema,
    "action-manifest": ActionManifestArtifactSchema,
    "build-plan": BuildPlanArtifactSchema,
};
/* ============================================================================
 * Feature 002: Build Pipeline
 * ========================================================================= */
/* ----- 3.1 AssembledEntityInput --------------------------------------------
 * The JSON blob the orchestrator feeds to Opus for a single entity.
 * Contract: contracts/enrichment.md §2.4 — every fact.source MUST appear
 * as a key in the flattened version of this object.
 */
export const AssembledEntityInputSchema = z.object({
    entity_type: z.string().min(1),
    entity_id: z.string().min(1),
    project_brief_summary: z.string(),
    primary_record: z.record(z.unknown()),
    related: z
        .array(z.object({
        relation: z.string(),
        rows: z.array(z.record(z.unknown())),
    }))
        .default([]),
    metadata: z.object({
        assembled_at: z.string(),
        assembler_version: z.string(),
    }),
});
/* ----- 3.2 EnrichmentResponse (oneOf) ----- */
export const EnrichedFactSchema = z.object({
    claim: z.string().min(1),
    source: z.string().min(1),
});
export const EnrichedResponseSchema = z.object({
    kind: z.literal("enriched"),
    document: z.string().min(40),
    facts: z.array(EnrichedFactSchema),
    categories: z.record(z.array(z.string())),
});
export const InsufficientDataResponseSchema = z.object({
    insufficient_data: z.literal(true),
    reason: z.string().min(1),
});
export const EnrichmentResponseSchema = z.union([
    EnrichedResponseSchema,
    InsufficientDataResponseSchema,
]);
/* ----- 3.3 BuildManifest (schema_version "1") ------
 * Contract: contracts/manifest.md
 */
export const ManifestFailureReasonSchema = z.enum([
    "insufficient_data",
    "validation_failed_twice",
    "opus_400",
    "opus_5xx_twice",
    "missing_source_data",
]);
export const ManifestFailureSchema = z.object({
    entity_type: z.string(),
    entity_id: z.string(),
    reason: ManifestFailureReasonSchema,
    details: z.string(),
});
/* Feature 005 — pipeline-step failure taxonomy (distinct from per-entity failures). */
export const PipelineStepSchema = z.enum([
    "render",
    "bundle",
    "image",
    "compose",
    "scan",
]);
export const PipelineFailureCodeSchema = z.enum([
    "TEMPLATE_COMPILE",
    "VENDOR_IMPORT_UNRESOLVED",
    "DOCKER_UNREACHABLE",
    "DOCKER_BUILD",
    "SECRET_IN_CONTEXT",
    "COMPOSE_ACTIVATE_FAILED",
    "SCAN_FAILED",
]);
export const PipelineFailureSchema = z.object({
    step: PipelineStepSchema,
    code: PipelineFailureCodeSchema,
    message: z.string(),
});
export const RenderStepActionSchema = z.enum(["created", "rewritten", "unchanged"]);
export const BundleStepActionSchema = z.enum(["created", "rewritten", "unchanged"]);
export const ImageStepActionSchema = z.enum([
    "created",
    "rebuilt",
    "unchanged",
    "skipped",
    "failed",
]);
export const ComposeStepActionSchema = z.enum(["activated", "unchanged", "skipped"]);
export const ScanStepActionSchema = z.enum(["ran", "skipped"]);
export const ActionExecutorsStepSchema = z.object({
    action: z.enum(["created", "rewritten", "unchanged"]),
    path: z.string(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    bytes: z.number().int().nonnegative(),
    warnings: z.array(z.string()).default([]),
});
export const PipelineStepsSchema = z.object({
    render: z
        .object({
        action: RenderStepActionSchema,
        files_changed: z.number().int().nonnegative(),
        /* Feature 006 / T058 — declarative executor catalog emitted
         * alongside backend render. Present iff
         * `.atw/artifacts/action-manifest.md` existed this build. */
        action_executors: ActionExecutorsStepSchema.optional(),
    })
        .optional(),
    bundle: z
        .object({
        action: BundleStepActionSchema,
    })
        .optional(),
    image: z
        .object({
        action: ImageStepActionSchema,
        reason: z.string().optional(),
    })
        .optional(),
    compose: z
        .object({
        action: ComposeStepActionSchema,
    })
        .optional(),
    scan: z
        .object({
        action: ScanStepActionSchema,
        clean: z.boolean().optional(),
    })
        .optional(),
});
export const ManifestResultSchema = z.enum([
    "success",
    "partial",
    "aborted",
    "failed",
    "nothing-to-do",
]);
export const ConcurrencyReductionSchema = z.object({
    at: z.string(),
    from: z.number().int().positive(),
    to: z.number().int().positive(),
    reason: z.string(),
});
export const BuildManifestSchema = z.object({
    schema_version: z.literal("1"),
    build_id: z.string().min(1),
    started_at: z.string(),
    completed_at: z.string(),
    duration_seconds: z.number().nonnegative(),
    result: ManifestResultSchema,
    totals: z.object({
        total_entities: z.number().int().nonnegative(),
        enriched: z.number().int().nonnegative(),
        skipped_unchanged: z.number().int().nonnegative(),
        failed: z.number().int().nonnegative(),
    }),
    failures: z.array(ManifestFailureSchema).default([]),
    opus: z.object({
        calls: z.number().int().nonnegative(),
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
        cost_usd: z.number().nonnegative(),
        estimated_cost_usd: z.number().nonnegative().optional(),
        cost_variance_pct: z.number().optional(),
    }),
    concurrency: z.object({
        configured: z.number().int().positive(),
        effective_max: z.number().int().positive(),
        reductions: z.array(ConcurrencyReductionSchema).default([]),
    }),
    input_hashes: z.record(z.string()),
    outputs: z.object({
        backend_files: z
            .array(z.object({
            path: z.string(),
            sha256: z.string(),
            bytes: z.number().int().nonnegative(),
            action: z.enum(["rewritten", "unchanged", "created"]),
        }))
            .default([]),
        widget_bundle: z
            .object({
            js: z.object({
                path: z.string(),
                sha256: z.string(),
                bytes: z.number().int().nonnegative(),
                gzip_bytes: z.number().int().nonnegative(),
            }),
            css: z.object({
                path: z.string(),
                sha256: z.string(),
                bytes: z.number().int().nonnegative(),
                gzip_bytes: z.number().int().nonnegative(),
            }),
            source: z.object({
                package_version: z.string().min(1),
                tree_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
            }),
        })
            .nullable()
            .default(null),
        backend_image: z
            .object({
            ref: z.string(),
            image_id: z.string(),
            size_bytes: z.number().int().nonnegative(),
        })
            .nullable()
            .default(null),
    }),
    environment: z.object({
        platform: z.string(),
        node_version: z.string(),
        docker_server_version: z.string(),
        postgres_image_digest: z.string(),
        embedding_model: z.string(),
    }),
    compliance_scan: z.object({
        ran: z.boolean(),
        clean: z.boolean(),
        values_checked: z.number().int().nonnegative(),
        matches: z
            .array(z.object({
            entity_type: z.string(),
            entity_id: z.string(),
            pii_column: z.string(),
            matched_snippet: z.string(),
        }))
            .default([]),
    }),
    /* Feature 005 — optional, backward-compatible extensions. */
    steps: PipelineStepsSchema.optional(),
    pipeline_failures: z.array(PipelineFailureSchema).optional(),
    /* Feature 006 / T058 — build-level human-facing warnings. Includes
     * the "no action-manifest → chat-only" notice (T071) and any
     * cross-origin / >20-actions notices emitted by `renderExecutors()`. */
    warnings: z.array(z.string()).optional(),
});
/* ----- 3.4 PipelineProgress ----- */
export const PipelineProgressSchema = z.object({
    phase: z.enum([
        "BOOT",
        "MIGRATE",
        "IMPORT",
        "ENRICH",
        "RENDER",
        "BUNDLE",
        "IMAGE",
        "SCAN",
        "DONE",
        "ABORT",
    ]),
    processed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    ok: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    cost_usd: z.number().nonnegative(),
    elapsed_seconds: z.number().nonnegative(),
    eta_seconds: z.number().nonnegative().nullable(),
    message: z.string().optional(),
});
/* ============================================================================
 * Feature 003 — Runtime wire types (data-model.md §1)
 * ========================================================================= */
export const ConversationTurnSchema = z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    timestamp: z.string(),
});
export const ActionFollowUpSchema = z.object({
    action_id: z.string().min(1),
    outcome: z.enum(["succeeded", "cancelled", "failed"]),
    host_response_summary: z.string().optional(),
    error: z
        .object({ status: z.number().int().optional(), message: z.string() })
        .optional(),
});
export const SessionContextSchema = z.object({
    cart_id: z.string().nullable().optional(),
    customer_id: z.string().nullable().optional(),
    region_id: z.string().nullable().optional(),
    locale: z.string().min(1),
    page_context: z
        .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null(), ActionFollowUpSchema]))
        .optional(),
});
export const ChatRequestSchema = z.object({
    message: z.string().min(1).max(4000),
    history: z.array(ConversationTurnSchema).max(20),
    context: SessionContextSchema,
});
export const CitationSchema = z.object({
    entity_id: z.string().min(1),
    entity_type: z.string().min(1),
    relevance: z.number().min(0).max(1),
    href: z.string().optional(),
    title: z.string().optional(),
});
export const ActionIntentSchema = z.object({
    id: z.string().min(1),
    tool: z.string().min(1),
    arguments: z.record(z.string(), z.unknown()),
    description: z.string().min(1),
    confirmation_required: z.literal(true),
    http: z.object({
        method: z.enum(["GET", "POST", "PATCH", "DELETE"]),
        path: z.string().min(1),
    }),
    summary: z.record(z.string(), z.string()).optional(),
});
export const ChatResponseSchema = z.object({
    message: z.string().min(1),
    citations: z.array(CitationSchema),
    actions: z.array(ActionIntentSchema),
    suggestions: z.array(z.string()).optional(),
    request_id: z.string().min(1),
});
//# sourceMappingURL=types.js.map
/**
 * Feature 006 — Zod schemas for `.atw/artifacts/action-manifest.md`
 * in-memory representation. Contract: specs/006-openapi-action-catalog/
 * contracts/action-manifest.schema.md and data-model.md §2.
 *
 * These schemas validate both (a) what the parser returns from
 * `parse-action-manifest.ts` and (b) what the classifier writes. The
 * render pipeline derives `RuntimeToolDescriptor[]` from
 * `ActionManifest.included` and the executors pipeline derives the
 * declarative catalog from the same source.
 *
 * Distinct from the legacy `ActionManifestArtifactSchema` in
 * `lib/types.ts`, which models the Feature 001 shape. The two live
 * side-by-side during migration; Feature 006 consumers use this file.
 */
import { z } from "zod";
export declare const ActionManifestEntrySchema: z.ZodObject<{
    toolName: z.ZodString;
    description: z.ZodString;
    descriptionTemplate: z.ZodOptional<z.ZodString>;
    summaryFields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    parameters: z.ZodObject<{
        type: z.ZodLiteral<"object">;
        properties: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
        required: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        type: "object";
        required: string[];
        properties: Record<string, any>;
    }, {
        type: "object";
        required?: string[] | undefined;
        properties?: Record<string, any> | undefined;
    }>;
    requiresConfirmation: z.ZodBoolean;
    isAction: z.ZodBoolean;
    source: z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path: z.ZodString;
        operationId: z.ZodString;
        /**
         * Feature 007 — OpenAPI security schemes required by this
         * operation (e.g. `["bearerAuth"]`). Empty / absent means the
         * operation is public. Carried through manifest round-trips so
         * `render-executors.ts` can emit a `credentialSource` block.
         */
        security: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
        security?: string[] | undefined;
    }, {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
        security?: string[] | undefined;
    }>;
    parameterSources: z.ZodOptional<z.ZodString>;
    /**
     * FR-012 — when true, this entry is a runtime-only tool (no indexed
     * counterpart in schema-map). Propagated from the `(runtime-only)`
     * flag on the `## Tools: <group>` heading in `action-manifest.md`,
     * and round-trips through `render-executors.ts` as
     * `runtimeOnly: true` on the rendered executor.
     */
    runtimeOnly: z.ZodOptional<z.ZodBoolean>;
    /**
     * Feature 008 / FR-026 — optional Handlebars-style summary template
     * (e.g. `"Add {{ quantity }}× {{ product_name }} to your cart"`) used
     * by the widget's ActionCard renderer in US5. Declarative pass-through
     * only; the widget substitutes placeholders from the tool call's
     * arguments at render time. Absent ⇒ ActionCard falls back to the
     * raw-JSON view.
     */
    summaryTemplate: z.ZodOptional<z.ZodString>;
    /**
     * Feature 008 / FR-003 — optional per-tool host prerequisite string
     * (e.g. `"The Customer-Addresses endpoint requires a verified email
     * on the shopper's account"`). Surfaced in the
     * `host-requirements.md#Tool-specific prerequisites` section.
     */
    hostPrerequisite: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description: string;
    parameters: {
        type: "object";
        required: string[];
        properties: Record<string, any>;
    };
    requiresConfirmation: boolean;
    source: {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
        security?: string[] | undefined;
    };
    toolName: string;
    isAction: boolean;
    runtimeOnly?: boolean | undefined;
    parameterSources?: string | undefined;
    descriptionTemplate?: string | undefined;
    summaryFields?: string[] | undefined;
    summaryTemplate?: string | undefined;
    hostPrerequisite?: string | undefined;
}, {
    description: string;
    parameters: {
        type: "object";
        required?: string[] | undefined;
        properties?: Record<string, any> | undefined;
    };
    requiresConfirmation: boolean;
    source: {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
        security?: string[] | undefined;
    };
    toolName: string;
    isAction: boolean;
    runtimeOnly?: boolean | undefined;
    parameterSources?: string | undefined;
    descriptionTemplate?: string | undefined;
    summaryFields?: string[] | undefined;
    summaryTemplate?: string | undefined;
    hostPrerequisite?: string | undefined;
}>;
export type ActionManifestEntry = z.infer<typeof ActionManifestEntrySchema>;
export declare const ExcludedEntrySchema: z.ZodObject<{
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    path: z.ZodString;
    operationId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    reason: string;
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    operationId: string;
}, {
    path: string;
    reason: string;
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    operationId: string;
}>;
export type ExcludedEntry = z.infer<typeof ExcludedEntrySchema>;
export declare const OrphanedEntrySchema: z.ZodObject<{
    method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
    path: z.ZodString;
    previousToolName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    path: string;
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    previousToolName: string;
}, {
    path: string;
    method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
    previousToolName: string;
}>;
export type OrphanedEntry = z.infer<typeof OrphanedEntrySchema>;
export declare const ActionManifestSchema: z.ZodObject<{
    provenance: z.ZodObject<{
        openapiSha256: z.ZodString;
        classifierModel: z.ZodString;
        classifiedAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        openapiSha256: string;
        classifierModel: string;
        classifiedAt: string;
    }, {
        openapiSha256: string;
        classifierModel: string;
        classifiedAt: string;
    }>;
    summary: z.ZodString;
    included: z.ZodArray<z.ZodObject<{
        toolName: z.ZodString;
        description: z.ZodString;
        descriptionTemplate: z.ZodOptional<z.ZodString>;
        summaryFields: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        parameters: z.ZodObject<{
            type: z.ZodLiteral<"object">;
            properties: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodAny>>;
            required: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            type: "object";
            required: string[];
            properties: Record<string, any>;
        }, {
            type: "object";
            required?: string[] | undefined;
            properties?: Record<string, any> | undefined;
        }>;
        requiresConfirmation: z.ZodBoolean;
        isAction: z.ZodBoolean;
        source: z.ZodObject<{
            method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
            path: z.ZodString;
            operationId: z.ZodString;
            /**
             * Feature 007 — OpenAPI security schemes required by this
             * operation (e.g. `["bearerAuth"]`). Empty / absent means the
             * operation is public. Carried through manifest round-trips so
             * `render-executors.ts` can emit a `credentialSource` block.
             */
            security: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        }, {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        }>;
        parameterSources: z.ZodOptional<z.ZodString>;
        /**
         * FR-012 — when true, this entry is a runtime-only tool (no indexed
         * counterpart in schema-map). Propagated from the `(runtime-only)`
         * flag on the `## Tools: <group>` heading in `action-manifest.md`,
         * and round-trips through `render-executors.ts` as
         * `runtimeOnly: true` on the rendered executor.
         */
        runtimeOnly: z.ZodOptional<z.ZodBoolean>;
        /**
         * Feature 008 / FR-026 — optional Handlebars-style summary template
         * (e.g. `"Add {{ quantity }}× {{ product_name }} to your cart"`) used
         * by the widget's ActionCard renderer in US5. Declarative pass-through
         * only; the widget substitutes placeholders from the tool call's
         * arguments at render time. Absent ⇒ ActionCard falls back to the
         * raw-JSON view.
         */
        summaryTemplate: z.ZodOptional<z.ZodString>;
        /**
         * Feature 008 / FR-003 — optional per-tool host prerequisite string
         * (e.g. `"The Customer-Addresses endpoint requires a verified email
         * on the shopper's account"`). Surfaced in the
         * `host-requirements.md#Tool-specific prerequisites` section.
         */
        hostPrerequisite: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        description: string;
        parameters: {
            type: "object";
            required: string[];
            properties: Record<string, any>;
        };
        requiresConfirmation: boolean;
        source: {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        };
        toolName: string;
        isAction: boolean;
        runtimeOnly?: boolean | undefined;
        parameterSources?: string | undefined;
        descriptionTemplate?: string | undefined;
        summaryFields?: string[] | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
    }, {
        description: string;
        parameters: {
            type: "object";
            required?: string[] | undefined;
            properties?: Record<string, any> | undefined;
        };
        requiresConfirmation: boolean;
        source: {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        };
        toolName: string;
        isAction: boolean;
        runtimeOnly?: boolean | undefined;
        parameterSources?: string | undefined;
        descriptionTemplate?: string | undefined;
        summaryFields?: string[] | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
    }>, "many">;
    excluded: z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path: z.ZodString;
        operationId: z.ZodString;
        reason: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        reason: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
    }, {
        path: string;
        reason: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
    }>, "many">;
    orphaned: z.ZodDefault<z.ZodArray<z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path: z.ZodString;
        previousToolName: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        previousToolName: string;
    }, {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        previousToolName: string;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    summary: string;
    excluded: {
        path: string;
        reason: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
    }[];
    provenance: {
        openapiSha256: string;
        classifierModel: string;
        classifiedAt: string;
    };
    included: {
        description: string;
        parameters: {
            type: "object";
            required: string[];
            properties: Record<string, any>;
        };
        requiresConfirmation: boolean;
        source: {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        };
        toolName: string;
        isAction: boolean;
        runtimeOnly?: boolean | undefined;
        parameterSources?: string | undefined;
        descriptionTemplate?: string | undefined;
        summaryFields?: string[] | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
    }[];
    orphaned: {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        previousToolName: string;
    }[];
}, {
    summary: string;
    excluded: {
        path: string;
        reason: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        operationId: string;
    }[];
    provenance: {
        openapiSha256: string;
        classifierModel: string;
        classifiedAt: string;
    };
    included: {
        description: string;
        parameters: {
            type: "object";
            required?: string[] | undefined;
            properties?: Record<string, any> | undefined;
        };
        requiresConfirmation: boolean;
        source: {
            path: string;
            method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
            operationId: string;
            security?: string[] | undefined;
        };
        toolName: string;
        isAction: boolean;
        runtimeOnly?: boolean | undefined;
        parameterSources?: string | undefined;
        descriptionTemplate?: string | undefined;
        summaryFields?: string[] | undefined;
        summaryTemplate?: string | undefined;
        hostPrerequisite?: string | undefined;
    }[];
    orphaned?: {
        path: string;
        method: "GET" | "POST" | "PATCH" | "DELETE" | "PUT";
        previousToolName: string;
    }[] | undefined;
}>;
export type ActionManifest = z.infer<typeof ActionManifestSchema>;
/**
 * Thrown when two `### <tool_name>` blocks share the same name. Parser
 * maps this to exit 1 with a diagnostic listing every offending
 * tool_name and the line ranges they appear at.
 */
export declare class ToolNameCollisionError extends Error {
    readonly code: "TOOL_NAME_COLLISION";
    readonly toolName: string;
    constructor(toolName: string, message: string);
}
//# sourceMappingURL=action-manifest-types.d.ts.map
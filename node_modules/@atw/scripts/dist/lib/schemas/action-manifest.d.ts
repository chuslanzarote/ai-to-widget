/**
 * Zod mirror of `specs/009-demo-guide-hardening/contracts/action-manifest.schema.json`.
 *
 * The same schema is used in two places:
 *   1. As the `input_schema` of the Anthropic `tool_use` call in
 *      `classify-actions.ts` — derived to JSON via `zod-to-json-schema`
 *      to avoid hand-keeping two copies in sync.
 *   2. As the post-call validator in `write-manifest.ts`, surfacing
 *      field-level error paths on validation failure (FR-008).
 *
 * Shape changes here MUST also bump `schema_version`.
 */
import { z } from "zod";
export declare const HttpMethodSchema: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
export type HttpMethod = z.infer<typeof HttpMethodSchema>;
export declare const OperationCitationSchema: z.ZodObject<{
    operation_id: z.ZodString;
    schema_ref: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    operation_id: string;
    schema_ref?: string | undefined;
}, {
    operation_id: string;
    schema_ref?: string | undefined;
}>;
export declare const ManifestOperationSchema: z.ZodObject<{
    tool_name: z.ZodString;
    description: z.ZodString;
    summary_template: z.ZodString;
    requires_confirmation: z.ZodBoolean;
    http: z.ZodObject<{
        method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
        path_template: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path_template: string;
    }, {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path_template: string;
    }>;
    input_schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    citation: z.ZodObject<{
        operation_id: z.ZodString;
        schema_ref: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        operation_id: string;
        schema_ref?: string | undefined;
    }, {
        operation_id: string;
        schema_ref?: string | undefined;
    }>;
    rationale_excerpt: z.ZodOptional<z.ZodString>;
}, "strict", z.ZodTypeAny, {
    description: string;
    summary_template: string;
    requires_confirmation: boolean;
    http: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path_template: string;
    };
    tool_name: string;
    input_schema: Record<string, unknown>;
    citation: {
        operation_id: string;
        schema_ref?: string | undefined;
    };
    rationale_excerpt?: string | undefined;
}, {
    description: string;
    summary_template: string;
    requires_confirmation: boolean;
    http: {
        method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
        path_template: string;
    };
    tool_name: string;
    input_schema: Record<string, unknown>;
    citation: {
        operation_id: string;
        schema_ref?: string | undefined;
    };
    rationale_excerpt?: string | undefined;
}>;
export type ManifestOperation = z.infer<typeof ManifestOperationSchema>;
export declare const ActionManifestSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1.0">;
    generated_at: z.ZodString;
    model_snapshot: z.ZodString;
    input_hashes: z.ZodObject<{
        openapi_sha256: z.ZodString;
        project_md_sha256: z.ZodString;
    }, "strict", z.ZodTypeAny, {
        openapi_sha256: string;
        project_md_sha256: string;
    }, {
        openapi_sha256: string;
        project_md_sha256: string;
    }>;
    operation_count_total: z.ZodNumber;
    operation_count_in_scope: z.ZodNumber;
    source_openapi_path: z.ZodString;
    operations: z.ZodArray<z.ZodObject<{
        tool_name: z.ZodString;
        description: z.ZodString;
        summary_template: z.ZodString;
        requires_confirmation: z.ZodBoolean;
        http: z.ZodObject<{
            method: z.ZodEnum<["GET", "POST", "PUT", "PATCH", "DELETE"]>;
            path_template: z.ZodString;
        }, "strict", z.ZodTypeAny, {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        }, {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        }>;
        input_schema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        citation: z.ZodObject<{
            operation_id: z.ZodString;
            schema_ref: z.ZodOptional<z.ZodString>;
        }, "strict", z.ZodTypeAny, {
            operation_id: string;
            schema_ref?: string | undefined;
        }, {
            operation_id: string;
            schema_ref?: string | undefined;
        }>;
        rationale_excerpt: z.ZodOptional<z.ZodString>;
    }, "strict", z.ZodTypeAny, {
        description: string;
        summary_template: string;
        requires_confirmation: boolean;
        http: {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        };
        tool_name: string;
        input_schema: Record<string, unknown>;
        citation: {
            operation_id: string;
            schema_ref?: string | undefined;
        };
        rationale_excerpt?: string | undefined;
    }, {
        description: string;
        summary_template: string;
        requires_confirmation: boolean;
        http: {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        };
        tool_name: string;
        input_schema: Record<string, unknown>;
        citation: {
            operation_id: string;
            schema_ref?: string | undefined;
        };
        rationale_excerpt?: string | undefined;
    }>, "many">;
}, "strict", z.ZodTypeAny, {
    operations: {
        description: string;
        summary_template: string;
        requires_confirmation: boolean;
        http: {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        };
        tool_name: string;
        input_schema: Record<string, unknown>;
        citation: {
            operation_id: string;
            schema_ref?: string | undefined;
        };
        rationale_excerpt?: string | undefined;
    }[];
    schema_version: "1.0";
    input_hashes: {
        openapi_sha256: string;
        project_md_sha256: string;
    };
    model_snapshot: string;
    generated_at: string;
    operation_count_total: number;
    operation_count_in_scope: number;
    source_openapi_path: string;
}, {
    operations: {
        description: string;
        summary_template: string;
        requires_confirmation: boolean;
        http: {
            method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
            path_template: string;
        };
        tool_name: string;
        input_schema: Record<string, unknown>;
        citation: {
            operation_id: string;
            schema_ref?: string | undefined;
        };
        rationale_excerpt?: string | undefined;
    }[];
    schema_version: "1.0";
    input_hashes: {
        openapi_sha256: string;
        project_md_sha256: string;
    };
    model_snapshot: string;
    generated_at: string;
    operation_count_total: number;
    operation_count_in_scope: number;
    source_openapi_path: string;
}>;
export type ActionManifest = z.infer<typeof ActionManifestSchema>;
/**
 * Cross-field invariants that zod's structural schema cannot express alone:
 *
 *   - For write operations whose source OpenAPI declares a request body,
 *     `input_schema.properties` MUST be non-empty (the bug Q1 wave fixes).
 *   - Every placeholder in `summary_template` MUST resolve to a key in
 *     `input_schema.properties`.
 *   - `tool_name` is unique within the manifest.
 *
 * `hasSourceRequestBodyByOperationId` is supplied by the caller (it knows the
 * source OpenAPI document); when undefined, the request-body invariant is
 * skipped (we cannot prove the source declared one).
 */
export interface ManifestInvariantOptions {
    hasSourceRequestBodyByOperationId?: (operationId: string) => boolean;
    sourceOperationIdExists?: (operationId: string) => boolean;
}
export interface ManifestInvariantIssue {
    path: string;
    message: string;
}
export declare function checkManifestInvariants(manifest: ActionManifest, opts?: ManifestInvariantOptions): ManifestInvariantIssue[];
export declare function extractPlaceholders(template: string): string[];
/**
 * Returns the manifest's JSON schema in the shape Anthropic's tool-use
 * `input_schema` expects. We hand-construct rather than depend on
 * `zod-to-json-schema` to avoid an extra dependency (Constitution VII)
 * and to keep the JSON output 1:1 with the contract file.
 */
export declare function actionManifestJsonSchema(): Record<string, unknown>;
//# sourceMappingURL=action-manifest.d.ts.map
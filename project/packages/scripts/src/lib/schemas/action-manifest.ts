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

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "expected lowercase hex sha256");
const modelSnapshotPattern = /^claude-(opus|sonnet|haiku)-[0-9]+-[0-9]+(-[0-9]{8})?$/;

export const HttpMethodSchema = z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]);
export type HttpMethod = z.infer<typeof HttpMethodSchema>;

export const OperationCitationSchema = z
  .object({
    operation_id: z.string().min(1),
    schema_ref: z.string().optional(),
  })
  .strict();

export const ManifestOperationSchema = z
  .object({
    tool_name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    description: z.string().min(1),
    summary_template: z.string().min(1),
    requires_confirmation: z.boolean(),
    http: z
      .object({
        method: HttpMethodSchema,
        path_template: z.string().min(1),
      })
      .strict(),
    input_schema: z.record(z.unknown()),
    citation: OperationCitationSchema,
    rationale_excerpt: z.string().optional(),
  })
  .strict();

export type ManifestOperation = z.infer<typeof ManifestOperationSchema>;

export const ActionManifestSchema = z
  .object({
    schema_version: z.literal("1.0"),
    generated_at: z.string(),
    model_snapshot: z.string().regex(modelSnapshotPattern),
    input_hashes: z
      .object({
        openapi_sha256: sha256Hex,
        project_md_sha256: sha256Hex,
      })
      .strict(),
    operation_count_total: z.number().int().min(0),
    operation_count_in_scope: z.number().int().min(0),
    source_openapi_path: z.string().min(1),
    operations: z.array(ManifestOperationSchema),
  })
  .strict();

export type ActionManifest = z.infer<typeof ActionManifestSchema>;

const WRITE_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH", "DELETE"]);

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

export function checkManifestInvariants(
  manifest: ActionManifest,
  opts: ManifestInvariantOptions = {},
): ManifestInvariantIssue[] {
  const issues: ManifestInvariantIssue[] = [];
  const seen = new Set<string>();

  manifest.operations.forEach((op, idx) => {
    const base = `operations[${idx}]`;
    if (seen.has(op.tool_name)) {
      issues.push({
        path: `${base}.tool_name`,
        message: `duplicate tool_name "${op.tool_name}"`,
      });
    }
    seen.add(op.tool_name);

    const props = (op.input_schema.properties as Record<string, unknown> | undefined) ?? {};
    const propKeys = new Set(Object.keys(props));

    if (WRITE_METHODS.has(op.http.method)) {
      const hasBody = opts.hasSourceRequestBodyByOperationId?.(op.citation.operation_id);
      if (hasBody && propKeys.size === 0) {
        issues.push({
          path: `${base}.input_schema.properties`,
          message: `write operation "${op.tool_name}" must have non-empty properties (source declares request body)`,
        });
      }
    }

    // Every {{ placeholder }} → must be a property key.
    for (const placeholder of extractPlaceholders(op.summary_template)) {
      if (!propKeys.has(placeholder)) {
        issues.push({
          path: `${base}.summary_template`,
          message: `placeholder "{{ ${placeholder} }}" not present in input_schema.properties`,
        });
      }
    }

    if (propKeys.size > 0 && !op.citation.schema_ref) {
      issues.push({
        path: `${base}.citation.schema_ref`,
        message: "schema_ref is required when input_schema.properties is non-empty",
      });
    }

    if (opts.sourceOperationIdExists) {
      if (!opts.sourceOperationIdExists(op.citation.operation_id)) {
        issues.push({
          path: `${base}.citation.operation_id`,
          message: `operation_id "${op.citation.operation_id}" does not exist in the source OpenAPI document`,
        });
      }
    }
  });

  return issues;
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export function extractPlaceholders(template: string): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(template)) !== null) {
    out.push(m[1]);
  }
  return out;
}

/**
 * Returns the manifest's JSON schema in the shape Anthropic's tool-use
 * `input_schema` expects. We hand-construct rather than depend on
 * `zod-to-json-schema` to avoid an extra dependency (Constitution VII)
 * and to keep the JSON output 1:1 with the contract file.
 */
export function actionManifestJsonSchema(): Record<string, unknown> {
  return {
    type: "object",
    additionalProperties: false,
    required: [
      "schema_version",
      "generated_at",
      "model_snapshot",
      "input_hashes",
      "operation_count_total",
      "operation_count_in_scope",
      "source_openapi_path",
      "operations",
    ],
    properties: {
      schema_version: { type: "string", const: "1.0" },
      generated_at: { type: "string", format: "date-time" },
      model_snapshot: {
        type: "string",
        pattern: "^claude-(opus|sonnet|haiku)-[0-9]+-[0-9]+(-[0-9]{8})?$",
      },
      input_hashes: {
        type: "object",
        additionalProperties: false,
        required: ["openapi_sha256", "project_md_sha256"],
        properties: {
          openapi_sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
          project_md_sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
        },
      },
      operation_count_total: { type: "integer", minimum: 0 },
      operation_count_in_scope: { type: "integer", minimum: 0 },
      source_openapi_path: { type: "string", minLength: 1 },
      operations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "tool_name",
            "description",
            "summary_template",
            "requires_confirmation",
            "http",
            "input_schema",
            "citation",
          ],
          properties: {
            tool_name: { type: "string", pattern: "^[a-z][a-z0-9_]*$" },
            description: { type: "string", minLength: 1 },
            summary_template: { type: "string", minLength: 1 },
            requires_confirmation: { type: "boolean" },
            http: {
              type: "object",
              additionalProperties: false,
              required: ["method", "path_template"],
              properties: {
                method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
                path_template: { type: "string", minLength: 1 },
              },
            },
            input_schema: { type: "object" },
            citation: {
              type: "object",
              additionalProperties: false,
              required: ["operation_id"],
              properties: {
                operation_id: { type: "string", minLength: 1 },
                schema_ref: { type: "string" },
              },
            },
            rationale_excerpt: { type: "string" },
          },
        },
      },
    },
  };
}

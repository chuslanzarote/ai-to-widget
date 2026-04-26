/**
 * /atw.api ↔ /atw.classify — LLM-native action manifest emission.
 *
 * Single Anthropic `messages.create()` call per source OpenAPI document.
 * The LLM receives the full bundled spec + project.md and returns a
 * JSON-schema-validated manifest via `tool_use` mode (R2). Around the
 * call, parsing/bundling/validation/write stay deterministic
 * (Constitution VI). Retry is the helper from `lib/llm-retry.ts`
 * (FR-008a, R4); cost is surfaced via `lib/cost-estimator.ts`
 * (FR-006a, R5); the manifest is round-tripped through
 * `lib/manifest-io.ts` (FR-007).
 *
 * NB: this replaces the old "chunked-by-entity, multi-call,
 * pre-filter-then-classify" path. Constitution V (Anchored Generation)
 * is satisfied by the per-field citation requirement enforced server-
 * side via the tool-call `input_schema`.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { parseOpenAPI } from "./parse-openapi.js";
import {
  ActionManifestSchema,
  actionManifestJsonSchema,
  checkManifestInvariants,
  type ActionManifest,
  type ManifestInvariantIssue,
} from "./lib/schemas/action-manifest.js";
import { withLLMRetry, LLMRetryError } from "./lib/llm-retry.js";
import { writeActionManifest } from "./lib/manifest-io.js";
import {
  loadProjectConfig,
  ProjectConfigError,
} from "./lib/runtime-config.js";
import { computeCostUsd, MODEL_PRICING, type ModelSnapshot } from "./lib/pricing.js";
import {
  estimateLlmCallCost,
  formatPreCallAnnouncement,
  preCallCountdown,
} from "./lib/cost-estimator.js";

export interface ClassifyActionsOptions {
  /** Path to or URL of the source OpenAPI document. */
  source: string;
  /** Repository root containing `.atw/` (defaults to cwd). */
  projectRoot?: string;
  /** Target manifest path; defaults to `<projectRoot>/.atw/artifacts/action-manifest.md`. */
  outPath?: string;
  /** Skip the 2-second informational countdown (CI uses this). */
  skipCountdown?: boolean;
  /** Override the SDK key resolution (testing). */
  anthropicApiKey?: string;
}

export interface ClassifyActionsResult {
  manifest: ActionManifest;
  manifestPath: string;
  llm: {
    attempts: number;
    retry_delays_ms: number[];
    input_tokens: number;
    output_tokens: number;
    estimated_cost_usd: number;
    actual_cost_usd: number;
    cost_variance_pct: number;
    model_snapshot: ModelSnapshot;
  };
}

export class ClassifyValidationError extends Error {
  constructor(public readonly issues: ManifestInvariantIssue[]) {
    super(
      `LLM-emitted manifest failed validation:\n` +
        issues.map((i) => `  - ${i.path}: ${i.message}`).join("\n"),
    );
    this.name = "ClassifyValidationError";
  }
}

const SYSTEM_PROMPT = `You are an API-classification assistant for ai-to-widget.

You will receive:
  1. <project_md> — the Builder's project metadata (deployment, origins).
  2. <brief_md> — the Builder's business brief, including the agent's
     allowed and forbidden actions. (May be empty if the Builder has
     not run /atw.brief yet.)
  3. <openapi> — the bundled OpenAPI document.
  4. <output_schema> — the JSON schema your tool call must conform to.

Your job: emit a single tool call to \`emit_manifest\` whose arguments
form the action manifest for the operations the widget should expose.

Constraints (Constitution V — Anchored Generation):
  - Every operation you include MUST have \`citation.operation_id\`
    matching an operationId present in the source document.
  - When the source operation declares a request body, \`input_schema.properties\`
    MUST be non-empty and reflect the source body schema.
  - \`summary_template\` placeholders MUST be keys in
    \`input_schema.properties\` of the same operation.
  - Mark \`requires_confirmation: true\` for non-idempotent writes
    (POST/PUT/PATCH/DELETE) that mutate user-visible state.
  - Exclude operations the Builder's brief_md lists under "forbidden
    actions" or that project_md indicates are admin-only / out-of-scope;
    favor inclusion when in doubt and let the Builder edit the manifest.

No prose, no apology, no narrowing passes. One tool call. Done.`;

function buildUserMessage(
  projectMd: string,
  briefMd: string,
  openapiJson: string,
  outputSchemaJson: string,
): string {
  return [
    "<project_md>",
    projectMd,
    "</project_md>",
    "",
    "<brief_md>",
    briefMd,
    "</brief_md>",
    "",
    "<openapi>",
    openapiJson,
    "</openapi>",
    "",
    "<output_schema>",
    outputSchemaJson,
    "</output_schema>",
  ].join("\n");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function classifyActions(
  opts: ClassifyActionsOptions,
): Promise<ClassifyActionsResult> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  const cfg = loadProjectConfig({ projectRoot });
  const modelSnapshot = cfg.model_snapshot as ModelSnapshot;

  const { parsed, raw } = await parseOpenAPI({ source: opts.source });
  const bundledJson = JSON.stringify(raw, null, 2);
  const projectMdPath = path.join(projectRoot, ".atw/config/project.md");
  const projectMdRaw = readFileSync(projectMdPath, "utf8");
  const briefMdPath = path.join(projectRoot, ".atw/config/brief.md");
  let briefMdRaw = "";
  try {
    briefMdRaw = readFileSync(briefMdPath, "utf8");
  } catch {
    briefMdRaw = "";
  }

  const openapiSha = sha256(bundledJson);
  const projectMdSha = sha256(projectMdRaw);
  const outputSchema = actionManifestJsonSchema();
  const outputSchemaJson = JSON.stringify(outputSchema, null, 2);

  const userMessage = buildUserMessage(projectMdRaw, briefMdRaw, bundledJson, outputSchemaJson);

  const apiKey = opts.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing — set it in your environment.");
  }
  const anthropic = new Anthropic({ apiKey, maxRetries: 0 });

  // Pre-call cost estimate (FR-006a, R5, Q5). The 0.27 SDK does not
  // expose `messages.countTokens`, so `estimateLlmCallCost` falls back
  // to a chars/4 heuristic; once the SDK is bumped it will opt into the
  // server-side count automatically. The actual cost recorded below
  // remains the source of truth.
  const estimate = await estimateLlmCallCost({
    bundledOpenapi: bundledJson,
    projectMd: projectMdRaw,
    operationCount: parsed.operations.length,
    modelSnapshot,
    systemPrompt: SYSTEM_PROMPT,
  });
  const estimatedCostUsd = estimate.estimatedCostUsd;

  process.stdout.write(
    `${formatPreCallAnnouncement({
      phase: "CLASSIFY",
      operationCount: parsed.operations.length,
      modelSnapshot,
      estimate,
    })}\n`,
  );
  if (!opts.skipCountdown) {
    await preCallCountdown(2000);
  }

  const seed = `${modelSnapshot}|${openapiSha}|${projectMdSha}`;
  const retryResult = await withLLMRetry(
    async () => {
      // claude-opus-4-7 deprecated `temperature`; omit it for that snapshot.
      const supportsTemperature = !modelSnapshot.startsWith("claude-opus-4-7");
      return await anthropic.messages.create({
        model: modelSnapshot,
        max_tokens: 16_000,
        ...(supportsTemperature ? { temperature: 0 } : {}),
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: "emit_manifest",
            description:
              "Emit the validated action manifest for the source OpenAPI document.",
            input_schema: outputSchema as unknown as Anthropic.Messages.Tool.InputSchema,
          },
        ],
        tool_choice: { type: "tool", name: "emit_manifest" },
        messages: [{ role: "user", content: userMessage }],
      });
    },
    { seed },
  ).catch((err) => {
    if (err instanceof LLMRetryError) throw err;
    throw err;
  });

  const message = retryResult.value;
  const toolUse = message.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("LLM did not emit a tool_use block — refusing to write manifest.");
  }
  const llmArgs = toolUse.input as Record<string, unknown>;

  // Inject server-side fields. The LLM cannot reliably stamp the wall-clock
  // and input hashes — we own those.
  const manifestCandidate = {
    ...llmArgs,
    schema_version: "1.0",
    generated_at: new Date().toISOString(),
    model_snapshot: modelSnapshot,
    input_hashes: { openapi_sha256: openapiSha, project_md_sha256: projectMdSha },
    operation_count_total: parsed.operations.length,
    source_openapi_path: opts.source,
  };

  const parsedManifest = ActionManifestSchema.safeParse(manifestCandidate);
  if (!parsedManifest.success) {
    const issues = parsedManifest.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new ClassifyValidationError(issues);
  }

  // Cross-field invariants: cite-back to source ops, write-body shape.
  const sourceOpIds = new Set(parsed.operations.map((o) => o.id));
  const sourceWriteBodies = new Map<string, boolean>();
  for (const op of parsed.operations) {
    sourceWriteBodies.set(op.id, op.requestBody !== null);
  }
  const invariantIssues = checkManifestInvariants(parsedManifest.data, {
    sourceOperationIdExists: (id) => sourceOpIds.has(id),
    hasSourceRequestBodyByOperationId: (id) => sourceWriteBodies.get(id) ?? false,
  });
  if (invariantIssues.length > 0) {
    throw new ClassifyValidationError(invariantIssues);
  }

  // Operation count in scope = LLM output cardinality.
  const finalManifest: ActionManifest = {
    ...parsedManifest.data,
    operation_count_in_scope: parsedManifest.data.operations.length,
  };

  const manifestPath =
    opts.outPath ?? path.join(projectRoot, ".atw/artifacts/action-manifest.md");
  writeActionManifest(manifestPath, finalManifest);

  const usage = message.usage;
  const actualCostUsd = computeCostUsd(
    { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens },
    modelSnapshot,
  );
  const variancePct =
    estimatedCostUsd === 0
      ? 0
      : Math.round(((actualCostUsd - estimatedCostUsd) / estimatedCostUsd) * 10_000) / 100;

  return {
    manifest: finalManifest,
    manifestPath,
    llm: {
      attempts: retryResult.attempts.length,
      retry_delays_ms: retryResult.attempts.map((a) => a.delayMs).filter((d) => d > 0),
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      estimated_cost_usd: estimatedCostUsd,
      actual_cost_usd: actualCostUsd,
      cost_variance_pct: variancePct,
      model_snapshot: modelSnapshot,
    },
  };
}

/* ================================================================== CLI === */

export async function runClassifyActions(argv: string[]): Promise<number> {
  let source: string | null = null;
  let outPath: string | null = null;
  let skipCountdown = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") source = argv[++i] ?? null;
    else if (a === "--out") outPath = argv[++i] ?? null;
    else if (a === "--no-countdown") skipCountdown = true;
  }
  if (!source) {
    process.stderr.write("atw-classify-actions: --source <path|url> required\n");
    return 3;
  }
  try {
    const result = await classifyActions({
      source,
      outPath: outPath ?? undefined,
      skipCountdown,
    });
    process.stdout.write(
      `[classify] Manifest validated: ${result.manifest.operations.length} operations in scope.\n` +
        `[classify] Wrote ${result.manifestPath}\n`,
    );
    return 0;
  } catch (err) {
    if (err instanceof ClassifyValidationError) {
      process.stderr.write(`atw-classify-actions: ${err.message}\n`);
      return 23;
    }
    if (err instanceof LLMRetryError) {
      process.stderr.write(
        `atw-classify-actions: ${err.message} (attempts: ${err.attempts.length})\n`,
      );
      return 4;
    }
    // FR-031 / T048: when the upstream artifact is missing, name the
    // missing precondition AND the actual next required command.
    if (err instanceof ProjectConfigError) {
      process.stderr.write(
        `atw-classify-actions: ${err.message}\n` +
          `Missing precondition: .atw/config/project.md. Run /atw.init first.\n`,
      );
      return 3;
    }
    const e = err as Error & { issues?: unknown[] };
    process.stderr.write(`atw-classify-actions: ${e.message}\n`);
    if (e.issues) process.stderr.write(`${JSON.stringify(e.issues, null, 2)}\n`);
    return 1;
  }
}

// Suppress unused-import of MODEL_PRICING (re-exported indirectly via other
// callers). Referenced symbolically here so future callers can pull pricing
// for non-classify phases without re-importing.
export { MODEL_PRICING };
export { ProjectConfigError };

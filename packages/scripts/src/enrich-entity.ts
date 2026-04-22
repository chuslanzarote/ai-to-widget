import { promises as fs } from "node:fs";
import { parseArgs } from "node:util";
import Debug from "debug";
import {
  AssembledEntityInputSchema,
  EnrichmentResponseSchema,
  type AssembledEntityInput,
  type EnrichmentResponse,
} from "./lib/types.js";
import { computeCostUsd, OPUS_PRICING, type TokenUsage } from "./lib/pricing.js";
import {
  validateEnrichment,
  type ValidatorRule,
} from "./lib/enrichment-validator.js";

const log = Debug("atw:enrich-entity");

export const PROMPT_TEMPLATE_VERSION = "enrich-v1";
export const ENRICH_V1_SYSTEM = `You are an enrichment assistant for a retrieval-augmented AI widget.
You MUST ONLY use facts present in the structured input below. Every fact.source you emit MUST be a key in the input JSON. You MUST NOT invent facts not present in the input.
Respond with ONE JSON object. Two shapes are valid:

(A) kind: "enriched" with:
- document: a single natural-language paragraph (>= 40 characters) describing the entity.
- facts: a list of { claim, source } items where "source" is a dotted-key path into the input JSON.
- categories: a record mapping category axis -> list of string labels.

(B) insufficient_data: true with "reason" when the input lacks enough signal.

Return no text other than the JSON object.`;

export interface EnrichOptions {
  input: AssembledEntityInput;
  opusClient?: OpusClient;
  retryStrategy?: "aggressive" | "conservative";
  model?: string;
  systemPrompt?: string;
  apiKey?: string;
  categoryVocabularies?: Record<string, Record<string, readonly string[]>>;
  /**
   * When `true` (default), run the Principle V validator on the response
   * and retry once with a sharpening prompt on rejection. When `false`,
   * behave as the MVP path did: only zod-validate the shape.
   */
  anchorValidation?: boolean;
  /**
   * T099 / US9 — observer hook invoked for each HTTP status surfaced by
   * the SDK call path (via `callWithHttpRetries`). The orchestrator uses
   * this to track sustained 429 pressure and auto-reduce concurrency.
   * Fired exactly once per HTTP response — including retries.
   */
  onHttpStatus?: (status: number) => void;
}

export interface OpusCallResult {
  response: EnrichmentResponse;
  tokens: TokenUsage;
  costUsd: number;
  promptTemplateVersion: string;
  modelId: string;
  /** Set when the validator rejected the response twice and we gave up. */
  validationFailedTwice?: true;
  /** The rule that failed on the first rejection (and second, if present). */
  rejectedRules?: ValidatorRule[];
}

/**
 * Subset of the Anthropic SDK surface we consume. Lets tests inject a
 * fake client without pulling in the real SDK.
 */
export interface OpusClient {
  createMessage(args: {
    model: string;
    system: string;
    user: string;
  }): Promise<{
    contentText: string;
    usage: { input_tokens: number; output_tokens: number };
  }>;
}

/**
 * Full enrichment path: one Opus call, parse JSON, zod-validate shape, then
 * apply the Principle V structural validator. On rejection, invoke a
 * sharpening retry with the offending rule cited. A second rejection flags
 * the entity as `validation_failed_twice`; the orchestrator skips it.
 *
 * When `anchorValidation: false`, behaves as the MVP path did: a parse
 * failure or shape mismatch throws `OPUS_INVALID_JSON` / `VALIDATION_FAILED`.
 *
 * Contract: contracts/scripts.md §5, contracts/enrichment.md §§1, 2, 3.
 */
export async function enrichEntity(opts: EnrichOptions): Promise<OpusCallResult> {
  const model = opts.model ?? OPUS_PRICING.model;
  const system = opts.systemPrompt ?? ENRICH_V1_SYSTEM;
  const client = opts.opusClient ?? (await defaultOpusClient(model, opts.apiKey));
  const anchorValidation = opts.anchorValidation !== false;

  const user = JSON.stringify(opts.input);
  log("sending entity %s/%s to %s", opts.input.entity_type, opts.input.entity_id, model);

  if (!anchorValidation) {
    // MVP path: one call, zod-validate; throw on parse/shape failures.
    const raw = await callWithHttpRetries(
      () => client.createMessage({ model, system, user }),
      { onHttpStatus: opts.onHttpStatus },
    );
    const parsed = safeParseJson(raw.contentText);
    if (!parsed.ok) {
      const e = new Error(`Opus returned non-JSON content: ${parsed.message}`);
      (e as { code?: string }).code = "OPUS_INVALID_JSON";
      throw e;
    }
    const zodRes = EnrichmentResponseSchema.safeParse(parsed.value);
    if (!zodRes.success) {
      const e = new Error(
        `Opus response failed schema validation: ${zodRes.error.issues[0]?.message ?? "unknown"}`,
      );
      (e as { code?: string }).code = "VALIDATION_FAILED";
      throw e;
    }
    const tokens: TokenUsage = {
      input_tokens: raw.usage.input_tokens,
      output_tokens: raw.usage.output_tokens,
    };
    return {
      response: zodRes.data,
      tokens,
      costUsd: computeCostUsd(tokens),
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      modelId: model,
    };
  }

  // Anchor-validation path (default): the validator is authoritative for
  // every rule including `invalid_shape`. Parse failures on NON-JSON throw
  // OPUS_INVALID_JSON (the model truly fell apart); parsed-but-shape-invalid
  // goes to the validator as `invalid_shape` so sharpening can recover.
  const first = await callAndParseRaw(client, model, system, user, opts.onHttpStatus);
  const firstCheck = validateEnrichment({
    rawResponse: first.raw,
    input: opts.input,
    categoryVocabularies: opts.categoryVocabularies,
  });
  if (firstCheck.ok) {
    return {
      response: firstCheck.response,
      tokens: first.tokens,
      costUsd: computeCostUsd(first.tokens),
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      modelId: model,
    };
  }

  log(
    "validator rejected first response for %s/%s: %s",
    opts.input.entity_type,
    opts.input.entity_id,
    firstCheck.rule,
  );
  const sharpen = buildSharpeningUser(user, firstCheck.rule, firstCheck.detail);
  const second = await callAndParseRaw(client, model, system, sharpen, opts.onHttpStatus);
  const combined: TokenUsage = {
    input_tokens: first.tokens.input_tokens + second.tokens.input_tokens,
    output_tokens: first.tokens.output_tokens + second.tokens.output_tokens,
  };

  const secondCheck = validateEnrichment({
    rawResponse: second.raw,
    input: opts.input,
    categoryVocabularies: opts.categoryVocabularies,
  });
  if (secondCheck.ok) {
    return {
      response: secondCheck.response,
      tokens: combined,
      costUsd: computeCostUsd(combined),
      promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
      modelId: model,
      rejectedRules: [firstCheck.rule],
    };
  }

  // Second rejection: flag and skip (orchestrator handles persistence).
  const placeholder: EnrichmentResponse = {
    insufficient_data: true,
    reason: `validation_failed_twice: ${firstCheck.rule} → ${secondCheck.rule}`,
  };
  return {
    response: placeholder,
    tokens: combined,
    costUsd: computeCostUsd(combined),
    promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
    modelId: model,
    validationFailedTwice: true,
    rejectedRules: [firstCheck.rule, secondCheck.rule],
  };
}

/**
 * Single Opus call + JSON parse (no zod). Throws OPUS_INVALID_JSON only
 * when the response body is not parseable JSON at all. A parsed-but-shape-
 * invalid object is returned so the validator can treat it as invalid_shape.
 */
async function callAndParseRaw(
  client: OpusClient,
  model: string,
  system: string,
  user: string,
  onHttpStatus?: (status: number) => void,
): Promise<{ raw: unknown; tokens: TokenUsage }> {
  // T078 / T099 — wrap the SDK call with the HTTP failure-mode matrix.
  // Observers see every HTTP status including transient 429s (used by
  // the orchestrator's concurrency auto-reduce in US9).
  const raw = await callWithHttpRetries(
    () => client.createMessage({ model, system, user }),
    { onHttpStatus },
  );
  const parsed = safeParseJson(raw.contentText);
  if (!parsed.ok) {
    const e = new Error(`Opus returned non-JSON content: ${parsed.message}`);
    (e as { code?: string }).code = "OPUS_INVALID_JSON";
    throw e;
  }
  return {
    raw: parsed.value,
    tokens: {
      input_tokens: raw.usage.input_tokens,
      output_tokens: raw.usage.output_tokens,
    },
  };
}

/**
 * Render the sharpening follow-up prompt as a JSON-wrapped user message.
 * Opus ignores the sugar; the important bits are the rule name and the
 * offending string. We keep this inline (no Handlebars engine) because the
 * template is tiny and the engine would pull a dep into orchestrator land.
 */
export function buildSharpeningUser(
  originalUser: string,
  rule: ValidatorRule,
  detail: string,
): string {
  const lines = [
    "Your previous response was rejected by the enrichment validator.",
    `Rule that failed: ${rule}`,
    `Details: ${detail}`,
    "",
    "Re-read the original input JSON below and produce a corrected response",
    "in the same schema. Pick sources only from keys present in the input.",
    "If the input does not support a grounded description, return",
    '{"insufficient_data": true, "reason": "..."}.',
    "",
    "Return ONLY the JSON object. No prose outside the JSON.",
    "",
    "Original input:",
    originalUser,
  ];
  return lines.join("\n");
}

function safeParseJson(raw: string): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

export async function defaultOpusClient(_model: string, apiKey?: string): Promise<OpusClient> {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    const e = new Error("ANTHROPIC_API_KEY is not set");
    (e as { code?: string }).code = "OPUS_AUTH";
    throw e;
  }
  const mod = await import("@anthropic-ai/sdk");
  const sdk = (mod as unknown as { default: new (args: { apiKey: string }) => unknown }).default;
  const anthropic = new sdk({ apiKey: key }) as unknown as {
    messages: {
      create: (args: {
        model: string;
        max_tokens: number;
        system: string;
        messages: Array<{ role: "user"; content: string }>;
      }) => Promise<{
        content: Array<{ type: string; text?: string }>;
        usage: { input_tokens: number; output_tokens: number };
      }>;
    };
  };
  return {
    async createMessage(args) {
      return callWithHttpRetries(() =>
        anthropic.messages.create({
          model: args.model,
          max_tokens: 4096,
          system: args.system,
          messages: [{ role: "user", content: args.user }],
        }),
      ).then((msg) => {
        const text = msg.content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n");
        return { contentText: text, usage: msg.usage };
      });
    },
  };
}

/**
 * T078 / US6 — HTTP failure-mode matrix (enrichment.md §5).
 *
 *   200  → pass through.
 *   400  → throw `OPUS_400` once, orchestrator flags the entity.
 *   401/403 → throw `OPUS_AUTH` once, orchestrator halts (FR-085).
 *   408/409 → retry once with jittered delay, then throw.
 *   429  → exponential backoff (base 1 s, max 32 s, ±25 % jitter),
 *          up to 3 attempts, then throw `OPUS_RATE_LIMIT`.
 *   5xx  → retry once, second failure throws `OPUS_5XX_TWICE`.
 *
 * The orchestrator layer is responsible for 429-triggered auto-reduce
 * of `--concurrency` (US9 / T099) — this wrapper handles per-call
 * backoff only.
 */
export async function callWithHttpRetries<T>(
  fn: () => Promise<T>,
  opts?: {
    /** Overridable for tests */
    sleep?: (ms: number) => Promise<void>;
    rng?: () => number;
    /** T099 — fired for every observed HTTP status (success or error). */
    onHttpStatus?: (status: number) => void;
  },
): Promise<T> {
  const sleep = opts?.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const rng = opts?.rng ?? Math.random;
  const onHttpStatus = opts?.onHttpStatus;
  let attempt429 = 0;
  let retried408or409 = false;
  let retried5xx = false;
  // Outer loop: only 429 retries via `continue`; 408/409/5xx use a single
  // retry and any subsequent failure is propagated.
  // eslint-disable-next-line no-constant-condition -- intentional retry loop; every branch either `return`s or `throw`s.
  while (true) {
    try {
      const out = await fn();
      onHttpStatus?.(200);
      return out;
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (typeof status === "number") onHttpStatus?.(status);
      if (status === 400) {
        const e = new Error(
          `Opus returned HTTP 400: ${(err as Error).message ?? "bad request"}`,
        );
        (e as { code?: string }).code = "OPUS_400";
        throw e;
      }
      if (status === 401 || status === 403) {
        const e = new Error(`Opus authentication failed (HTTP ${status})`);
        (e as { code?: string }).code = "OPUS_AUTH";
        throw e;
      }
      if (status === 408 || status === 409) {
        if (retried408or409) throw err;
        retried408or409 = true;
        const jitter = 1 + (rng() - 0.5) * 0.5;
        await sleep(500 * jitter);
        continue;
      }
      if (status === 429) {
        attempt429 += 1;
        if (attempt429 >= 3) {
          const e = new Error(`Opus rate limit exhausted (HTTP 429)`);
          (e as { code?: string }).code = "OPUS_RATE_LIMIT";
          throw e;
        }
        const base = Math.min(32_000, 1000 * 2 ** (attempt429 - 1));
        const jitter = 1 + (rng() - 0.5) * 0.5;
        await sleep(base * jitter);
        continue;
      }
      if (typeof status === "number" && status >= 500) {
        if (retried5xx) {
          const e = new Error(`Opus returned HTTP ${status} twice`);
          (e as { code?: string }).code = "OPUS_5XX_TWICE";
          throw e;
        }
        retried5xx = true;
        const jitter = 1 + (rng() - 0.5) * 0.5;
        await sleep(750 * jitter);
        continue;
      }
      // Non-HTTP or unknown error → re-throw untouched.
      throw err;
    }
  }
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  input?: string;
  buildPlan?: string;
  retryStrategy: "aggressive" | "conservative";
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      input: { type: "string" },
      "build-plan": { type: "string" },
      "retry-strategy": { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  const rs = String(values["retry-strategy"] ?? "conservative");
  if (rs !== "aggressive" && rs !== "conservative") {
    throw new Error("--retry-strategy must be aggressive|conservative");
  }
  return {
    input: values.input ? String(values.input) : undefined,
    buildPlan: values["build-plan"] ? String(values["build-plan"]) : undefined,
    retryStrategy: rs as "aggressive" | "conservative",
    json: Boolean(values.json),
  };
}

async function readInput(p?: string): Promise<unknown> {
  if (p) {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  }
  // read stdin
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

export async function runEnrichEntity(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-enrich-entity: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-enrich-entity --input <path-or-stdin> --build-plan <path> [--retry-strategy aggressive|conservative] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-enrich-entity 0.1.0\n");
    return 0;
  }

  try {
    const raw = await readInput(opts.input);
    const input = AssembledEntityInputSchema.parse(raw);
    const result = await enrichEntity({ input });
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({
          response: result.response,
          tokens: result.tokens,
          cost_usd: result.costUsd,
        }) + "\n",
      );
    } else {
      process.stdout.write(
        `kind=${"kind" in result.response ? result.response.kind : "insufficient_data"} cost=$${result.costUsd.toFixed(4)}\n`,
      );
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "OPUS_AUTH") {
      process.stderr.write(`atw-enrich-entity: ${(err as Error).message}\n`);
      return 12;
    }
    if (code === "OPUS_RATE_LIMIT") {
      process.stderr.write(`atw-enrich-entity: ${(err as Error).message}\n`);
      return 13;
    }
    if (code === "VALIDATION_FAILED" || code === "OPUS_INVALID_JSON") {
      process.stderr.write(`atw-enrich-entity: ${(err as Error).message}\n`);
      return 11;
    }
    process.stderr.write(`atw-enrich-entity: ${(err as Error).message}\n`);
    return 1;
  }
}

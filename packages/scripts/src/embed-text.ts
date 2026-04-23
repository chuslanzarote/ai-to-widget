import { parseArgs } from "node:util";
import Debug from "debug";

const log = Debug("atw:embed-text");

const DEFAULT_MODEL = "Xenova/bge-small-en-v1.5";
const EMBEDDING_DIM = 384;

let _extractorCache: { id: string; extractor: unknown } | null = null;

/**
 * Produce a 384-dimensional embedding via @xenova/transformers running
 * locally on CPU. The extractor is cached after the first load so callers
 * can invoke `embedText` many times in a loop without reloading weights.
 *
 * Contract: contracts/scripts.md §6, FR-062–FR-064.
 */
export async function embedText(text: string, modelId: string = DEFAULT_MODEL): Promise<number[]> {
  const extractor = await getExtractor(modelId);
  // The extractor returns a Tensor; we need a plain number[].
  const out = await (extractor as (input: string, options: unknown) => Promise<{
    data: Float32Array | Float64Array | number[];
  }>)(text, { pooling: "mean", normalize: true });
  const raw = out.data;
  const vec = Array.from(raw as ArrayLike<number>);
  if (vec.length !== EMBEDDING_DIM) {
    const e = new Error(
      `Embedding dimension mismatch: got ${vec.length}, expected ${EMBEDDING_DIM}`,
    );
    (e as { code?: string }).code = "EMBED_DIM_MISMATCH";
    throw e;
  }
  return vec;
}

async function getExtractor(modelId: string): Promise<unknown> {
  if (_extractorCache && _extractorCache.id === modelId) {
    return _extractorCache.extractor;
  }
  log("loading embedding model %s", modelId);
  try {
    // Dynamic import so that help/version don't pay the load cost.
    const mod = (await import("@xenova/transformers")) as unknown as {
      pipeline: (task: string, model: string) => Promise<unknown>;
    };
    const extractor = await mod.pipeline("feature-extraction", modelId);
    _extractorCache = { id: modelId, extractor };
    return extractor;
  } catch (err) {
    const e = new Error(
      `Failed to load ${modelId}: ${(err as Error).message}. ` +
        `See https://huggingface.co/${modelId} for manual download if offline.`,
    );
    (e as { code?: string }).code = "MODEL_LOAD_FAILED";
    (e as { cause?: unknown }).cause = err;
    throw e;
  }
}

export function clearExtractorCache(): void {
  _extractorCache = null;
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  text: string;
  model: string;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      text: { type: "string" },
      model: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  if (!values.text) throw new Error("--text <string> is required");
  return {
    text: String(values.text),
    model: String(values.model ?? DEFAULT_MODEL),
    json: Boolean(values.json),
  };
}

export async function runEmbedText(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-embed-text: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write("atw-embed-text --text <string> [--model <id>] [--json]\n");
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-embed-text 0.1.0\n");
    return 0;
  }

  try {
    const vec = await embedText(opts.text, opts.model);
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({ embedding: vec, dimensions: vec.length }) + "\n",
      );
    } else {
      process.stdout.write(`dimensions=${vec.length}\n`);
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "MODEL_LOAD_FAILED") {
      process.stderr.write(`atw-embed-text: ${(err as Error).message}\n`);
      return 14;
    }
    process.stderr.write(`atw-embed-text: ${(err as Error).message}\n`);
    return 1;
  }
}

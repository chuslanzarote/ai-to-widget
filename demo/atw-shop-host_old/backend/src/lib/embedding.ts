/**
 * Runtime embedding wrapper. Reuses the @xenova/transformers cache baked
 * into the atw_backend image (Feature 002 Dockerfile pre-caches
 * bge-small-en-v1.5 during build).
 *
 * We keep the pipeline instance in module scope so it is loaded once per
 * process and reused for every /v1/chat request.
 */
type Pipeline = (input: string, opts?: Record<string, unknown>) => Promise<{ data: Float32Array }>;

let cachedPipeline: Pipeline | null = null;

export const EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
export const EMBEDDING_DIM = 384;

export async function embed(text: string): Promise<number[]> {
  if (!cachedPipeline) {
    const mod = (await import("@xenova/transformers")) as unknown as {
      pipeline: (task: string, model: string) => Promise<Pipeline>;
    };
    cachedPipeline = await mod.pipeline("feature-extraction", EMBEDDING_MODEL);
  }
  const output = await cachedPipeline(text, { pooling: "mean", normalize: true });
  return Array.from(output.data);
}

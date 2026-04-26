/**
 * Logger redaction paths shared between the rendered backend
 * (`packages/backend/src/lib/logger.ts.hbs`) and its unit tests
 * (T110). The pino serializer itself is constructed in the rendered
 * file so we don't need pino here.
 *
 * Source: specs/003-runtime/research §13.
 */
export const REDACTION_PATHS = [
  'req.headers["authorization"]',
  'req.headers["cookie"]',
  'req.headers["set-cookie"]',
  "*.authorization",
  "*.cookie",
] as const;

export const REDACTION_CENSOR = "[redacted]";

/**
 * Lightweight redact function used by the unit tests. Applies the same
 * censor value as pino's `redact` option. This is NOT the production
 * code path — pino does the real work — but a functional equivalent
 * that lets us test the path selection without booting a fastify+pino
 * pipeline.
 */
export function redactObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  const out: Record<string, unknown> = { ...(obj as Record<string, unknown>) };
  if (out.req && typeof out.req === "object") {
    const req = out.req as { headers?: Record<string, unknown> };
    if (req.headers) {
      const h = { ...req.headers };
      for (const key of Object.keys(h)) {
        const lower = key.toLowerCase();
        if (lower === "authorization" || lower === "cookie" || lower === "set-cookie") {
          h[key] = REDACTION_CENSOR;
        }
      }
      out.req = { ...req, headers: h };
    }
  }
  for (const key of Object.keys(out)) {
    if (key === "req") continue;
    const lower = key.toLowerCase();
    if (lower === "authorization" || lower === "cookie") {
      out[key] = REDACTION_CENSOR;
    }
  }
  return out;
}

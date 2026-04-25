/**
 * Logger redaction paths shared between the rendered backend
 * (`packages/backend/src/lib/logger.ts.hbs`) and its unit tests
 * (T110). The pino serializer itself is constructed in the rendered
 * file so we don't need pino here.
 *
 * Source: specs/003-runtime/research §13.
 */
export declare const REDACTION_PATHS: readonly ["req.headers[\"authorization\"]", "req.headers[\"cookie\"]", "req.headers[\"set-cookie\"]", "*.authorization", "*.cookie"];
export declare const REDACTION_CENSOR = "[redacted]";
/**
 * Lightweight redact function used by the unit tests. Applies the same
 * censor value as pino's `redact` option. This is NOT the production
 * code path — pino does the real work — but a functional equivalent
 * that lets us test the path selection without booting a fastify+pino
 * pipeline.
 */
export declare function redactObject(obj: unknown): unknown;
//# sourceMappingURL=runtime-logger.d.ts.map
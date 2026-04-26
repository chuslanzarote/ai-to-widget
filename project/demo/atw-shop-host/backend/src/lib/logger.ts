import pino from "pino";
import type { FastifyBaseLogger } from "fastify";

/**
 * Pino logger with header redaction. Any stray authentication-bearing
 * header that reached the log path is masked before stdout (Principle I,
 * specs/003-runtime/research §13). The credential-strip onRequest hook
 * should prevent these from ever surfacing in the first place — this is
 * defence in depth.
 *
 * Return type is widened to `FastifyBaseLogger` so every downstream
 * `app: FastifyInstance` signature (which defaults to `FastifyBaseLogger`)
 * remains assignable — avoids pino vs. fastify-type-provider-zod generic
 * variance under strict mode.
 */
export function buildLogger(level: string, nodeEnv: string): FastifyBaseLogger {
  const isDev = nodeEnv !== "production";
  return pino({
    level,
    redact: {
      paths: [
        'req.headers["authorization"]',
        'req.headers["cookie"]',
        'req.headers["set-cookie"]',
        'req.headers["x-atw-session-id"]',
        "*.authorization",
        "*.cookie",
      ],
      censor: "[redacted]",
    },
    transport: isDev
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l" },
        }
      : undefined,
  });
}

export type Logger = FastifyBaseLogger;

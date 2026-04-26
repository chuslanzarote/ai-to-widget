import type { FastifyInstance, FastifyRequest } from "fastify";
import fastifyRateLimit from "@fastify/rate-limit";

/**
 * Per-session rate limit. Keys on the widget-issued X-Atw-Session-Id
 * header; falls back to the remote IP when the session header is absent.
 * Contract: specs/003-runtime/research §3 + chat-endpoint.md §9.
 */
export async function registerRateLimit(
  app: FastifyInstance,
  opts: { max: number; windowMs: number },
): Promise<void> {
  await app.register(fastifyRateLimit, {
    max: opts.max,
    timeWindow: opts.windowMs,
    keyGenerator: (req: FastifyRequest) => {
      const sessionId = req.headers["x-atw-session-id"];
      if (typeof sessionId === "string" && sessionId.length > 0) {
        return `session:${sessionId}`;
      }
      return `ip:${req.ip}`;
    },
    errorResponseBuilder: (req, ctx) => ({
      error_code: "rate_limited",
      message: "You're sending messages too quickly. Try again in a moment.",
      request_id: req.id,
      retry_after_seconds: Math.ceil(ctx.ttl / 1000),
    }),
  });
}

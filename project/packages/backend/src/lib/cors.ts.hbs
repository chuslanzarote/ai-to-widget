import type { FastifyInstance } from "fastify";
import fastifyCors from "@fastify/cors";

/**
 * CORS allowlist. Reads comma-separated origins from config and registers
 * @fastify/cors. Requests whose Origin is not in the list are rejected.
 * Contract: specs/003-runtime/contracts/chat-endpoint.md §9.
 */
export async function registerCors(
  app: FastifyInstance,
  allowedOrigins: string[],
): Promise<void> {
  await app.register(fastifyCors, {
    origin: allowedOrigins,
    credentials: false,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Atw-Session-Id"],
    exposedHeaders: ["X-Request-Id"],
  });
}

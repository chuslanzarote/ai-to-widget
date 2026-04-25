import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";

/**
 * Liveness probe. Returns 200 when the catalog index is reachable within
 * 250 ms; 503 otherwise. Docker's healthcheck and orchestration systems
 * consume this endpoint. Contract:
 * specs/003-runtime/contracts/chat-endpoint.md §8.
 */
export function registerHealth(app: FastifyInstance, pool: Pool): void {
  app.get("/health", async (_req, reply) => {
    const start = Date.now();
    try {
      const client = await pool.connect();
      try {
        await client.query("SELECT 1");
      } finally {
        client.release();
      }
      const elapsed = Date.now() - start;
      if (elapsed > 250) {
        reply.code(503);
        return { status: "degraded", reason: "postgres_slow", elapsed_ms: elapsed };
      }
      return { status: "ok" };
    } catch (err) {
      reply.code(503);
      return {
        status: "degraded",
        reason: "postgres_unreachable",
        detail: (err as Error).message,
      };
    }
  });
}

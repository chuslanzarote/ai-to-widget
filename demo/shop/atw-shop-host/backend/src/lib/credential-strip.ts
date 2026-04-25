import type { FastifyInstance, FastifyRequest } from "fastify";
import { stripCredentialHeaders } from "@atw/scripts/dist/lib/runtime-credential-strip.js";

/**
 * Principle I enforcement: strip every credential-bearing header before
 * any route handler sees it. The count is logged (never the value).
 * Predicate lives in @atw/scripts so unit tests can assert on it (T084).
 *
 * Invariant: the backend MUST NOT receive shopper cookies or tokens
 * (specs/003-runtime/contracts/chat-endpoint.md §4 step 2, §6).
 */
export function registerCredentialStrip(app: FastifyInstance): void {
  app.addHook("onRequest", async (req: FastifyRequest) => {
    const headers = req.headers as Record<string, unknown>;
    const stripped = stripCredentialHeaders(headers);
    if (stripped > 0) {
      req.log.warn(
        { credential_strip_total: stripped, req_id: req.id },
        "stripped credential-bearing headers from incoming request",
      );
    }
  });
}

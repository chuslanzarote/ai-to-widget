import type { FastifyInstance } from "fastify";
import { RUNTIME_TOOLS } from "../tools.js";

/**
 * GET /tools — runtime tool catalogue (Feature 009 / FR-015).
 *
 * The widget fetches this at boot to populate its allowlist; there is
 * no `data-allowed-tools` attribute anymore. The response is the
 * minimal projection the widget needs:
 *   { tools: [{ name, requires_confirmation, summary_template }] }
 *
 * Cache for 60 s on the edge so repeated page loads do not stampede
 * the backend; the catalogue only changes on `/atw.build`.
 */
export function registerTools(app: FastifyInstance): void {
  app.get("/tools", async (_req, reply) => {
    reply.header("Cache-Control", "public, max-age=60");
    return {
      tools: RUNTIME_TOOLS.map((t) => ({
        name: t.name,
        requires_confirmation: t.requires_confirmation,
        summary_template: t.summary_template,
      })),
    };
  });
}

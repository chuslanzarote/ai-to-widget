import type { FastifyInstance } from "fastify";
import { UserSummary } from "../schemas/entities.js";
import { requireAuth } from "../auth/jwt.js";
import { prisma } from "../db.js";

export async function registerCustomerRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    "/customers/me",
    {
      schema: {
        tags: ["customers"],
        operationId: "getMyProfile",
        summary: "Return the authenticated shopper's profile.",
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "UserSummary#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const jwt = await requireAuth(req);
      const user = await prisma.user.findUnique({ where: { id: jwt.sub } });
      if (!user) {
        return reply.code(401).send({ error: "User no longer exists" });
      }
      return {
        id: user.id,
        email: user.email,
        display_name: user.displayName,
      };
    },
  );

  void UserSummary;
}

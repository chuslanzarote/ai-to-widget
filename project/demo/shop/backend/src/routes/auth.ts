import type { FastifyInstance } from "fastify";
import {
  LoginRequest,
  LoginResponse,
  ErrorResponse,
  type LoginRequestT,
} from "../schemas/entities.js";
import { comparePassword } from "../auth/bcrypt.js";
import { signJwt } from "../auth/jwt.js";
import { prisma } from "../db.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: LoginRequestT }>(
    "/auth/login",
    {
      schema: {
        tags: ["auth"],
        operationId: "loginShopper",
        summary: "Authenticate a shopper and return a bearer JWT.",
        body: { $ref: "LoginRequest#" },
        response: {
          200: { $ref: "LoginResponse#" },
          401: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const { email, password } = req.body;
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (!user) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      const ok = await comparePassword(password, user.passwordHash);
      if (!ok) {
        return reply.code(401).send({ error: "Invalid credentials" });
      }
      const token = signJwt(app, { sub: user.id, email: user.email });
      return reply.code(200).send({
        token,
        user: {
          id: user.id,
          email: user.email,
          display_name: user.displayName,
        },
      });
    },
  );

  // Ensure schemas referenced above are registered on the app.
  void LoginRequest;
  void LoginResponse;
  void ErrorResponse;
}

import type { FastifyInstance, FastifyRequest } from "fastify";

export interface JwtPayload {
  sub: string;
  email: string;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export function signJwt(app: FastifyInstance, payload: JwtPayload): string {
  return app.jwt.sign(payload, { expiresIn: "24h" });
}

export async function requireAuth(req: FastifyRequest): Promise<JwtPayload> {
  await req.jwtVerify();
  return req.user as JwtPayload;
}

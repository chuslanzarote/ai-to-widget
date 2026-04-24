import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __atwShopPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.__atwShopPrisma ?? new PrismaClient({ log: ["warn", "error"] });

if (process.env.NODE_ENV !== "production") {
  global.__atwShopPrisma = prisma;
}

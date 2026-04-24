/**
 * ATW Reference Shop — Fastify bootstrap.
 * Contract: specs/007-widget-tool-loop/contracts/shop-openapi.md.
 */
import Fastify, { type FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";

import { ALL_SCHEMAS } from "./schemas/entities.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerProductRoutes } from "./routes/products.js";
import { registerCartRoutes } from "./routes/cart.js";
import { registerOrderRoutes } from "./routes/orders.js";
import { registerCustomerRoutes } from "./routes/customers.js";

const PORT = Number.parseInt(process.env.PORT ?? "3200", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const JWT_SECRET = process.env.JWT_SECRET;
const LOG_LEVEL = process.env.LOG_LEVEL ?? "info";

if (!JWT_SECRET || JWT_SECRET.length < 16) {
  console.error(
    "JWT_SECRET env var is required and must be at least 16 characters.",
  );
  process.exit(1);
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: LOG_LEVEL },
    ajv: {
      customOptions: {
        removeAdditional: "all",
        useDefaults: true,
        coerceTypes: "array",
        allErrors: false,
      },
    },
  });

  for (const schema of ALL_SCHEMAS) {
    app.addSchema(schema);
  }

  await app.register(fastifyJwt, { secret: JWT_SECRET as string });

  await app.register(fastifySwagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "ATW Reference Shop",
        version: "1.0.0",
        description:
          "Minimal reference ecommerce consumed by the ATW toolchain (Feature 007).",
      },
      servers: [{ url: `http://localhost:${PORT}` }],
      tags: [
        { name: "auth" },
        { name: "products" },
        { name: "cart" },
        { name: "orders" },
        { name: "customers" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(fastifySwaggerUi, { routePrefix: "/docs" });

  app.setErrorHandler((err, _req, reply) => {
    const status =
      typeof err.statusCode === "number" && err.statusCode >= 400
        ? err.statusCode
        : 500;
    reply.code(status).send({ error: err.message });
  });

  app.get("/health", { schema: { hide: true } }, async () => ({ ok: true }));

  app.get(
    "/openapi.json",
    { schema: { hide: true } },
    async () => app.swagger(),
  );

  await app.register(registerAuthRoutes);
  await app.register(registerProductRoutes);
  await app.register(registerCartRoutes);
  await app.register(registerOrderRoutes);
  await app.register(registerCustomerRoutes);

  return app;
}

async function main(): Promise<void> {
  const app = await buildApp();
  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info({ port: PORT }, "ATW Reference Shop listening");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

const invokedDirectly =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("index.js") === true ||
  process.argv[1]?.endsWith("index.ts") === true;

if (invokedDirectly) {
  void main();
}

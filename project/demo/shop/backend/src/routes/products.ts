import type { FastifyInstance } from "fastify";
import {
  Product,
  ProductListQuery,
  ProductListResponse,
  UuidPathParam,
  ErrorResponse,
  type ProductListQueryT,
} from "../schemas/entities.js";
import { prisma } from "../db.js";

function toProductDto(p: {
  id: string;
  handle: string;
  name: string;
  description: string;
  priceCents: number;
  imageUrl: string;
  inStock: boolean;
  createdAt: Date;
}): Record<string, unknown> {
  return {
    id: p.id,
    handle: p.handle,
    name: p.name,
    description: p.description,
    price_cents: p.priceCents,
    image_url: p.imageUrl,
    in_stock: p.inStock,
    created_at: p.createdAt.toISOString(),
  };
}

export async function registerProductRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get<{ Querystring: ProductListQueryT }>(
    "/products",
    {
      schema: {
        tags: ["products"],
        operationId: "listProducts",
        summary: "List all products, optionally filtered by q substring.",
        querystring: { $ref: "ProductListQuery#" },
        response: {
          200: { $ref: "ProductListResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req) => {
      const q = req.query.q?.trim();
      const rows = q
        ? await prisma.product.findMany({
            where: {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { name: "asc" },
          })
        : await prisma.product.findMany({ orderBy: { name: "asc" } });
      return { products: rows.map(toProductDto) };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/products/:id",
    {
      schema: {
        tags: ["products"],
        operationId: "getProduct",
        summary: "Get one product by its UUID.",
        params: { $ref: "UuidPathParam#" },
        response: {
          200: { $ref: "Product#" },
          404: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const row = await prisma.product.findUnique({
        where: { id: req.params.id },
      });
      if (!row) {
        return reply.code(404).send({ error: "Product not found" });
      }
      return toProductDto(row);
    },
  );

  void Product;
  void ProductListQuery;
  void ProductListResponse;
  void UuidPathParam;
  void ErrorResponse;
}

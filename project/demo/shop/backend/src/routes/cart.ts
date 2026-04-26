import type { FastifyInstance } from "fastify";
import {
  Cart,
  CartItem,
  AddCartItemRequest,
  UpdateCartItemRequest,
  UuidPathParam,
  ErrorResponse,
  type AddCartItemRequestT,
  type UpdateCartItemRequestT,
} from "../schemas/entities.js";
import { requireAuth } from "../auth/jwt.js";
import { prisma } from "../db.js";

interface CartRow {
  id: string;
  items: Array<{
    id: string;
    productId: string;
    quantity: number;
    product: { name: string; priceCents: number };
  }>;
}

function toCartDto(cart: CartRow): Record<string, unknown> {
  const items = cart.items.map((it) => ({
    id: it.id,
    product_id: it.productId,
    product_name: it.product.name,
    quantity: it.quantity,
    unit_price_cents: it.product.priceCents,
  }));
  const total = items.reduce(
    (acc, it) => acc + it.quantity * it.unit_price_cents,
    0,
  );
  return { id: cart.id, items, total_cents: total };
}

async function getOrCreateCart(userId: string): Promise<CartRow> {
  const existing = await prisma.cart.findUnique({
    where: { userId },
    include: {
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });
  if (existing) return existing as unknown as CartRow;
  const created = await prisma.cart.create({
    data: { userId },
    include: {
      items: {
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });
  return created as unknown as CartRow;
}

export async function registerCartRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/cart",
    {
      schema: {
        tags: ["cart"],
        operationId: "getCart",
        summary: "Get the shopper's active cart (lazy-created).",
        security: [{ bearerAuth: [] }],
        response: { 200: { $ref: "Cart#" } },
      } as unknown as Record<string, unknown>,
    },
    async (req) => {
      const jwt = await requireAuth(req);
      const cart = await getOrCreateCart(jwt.sub);
      return toCartDto(cart);
    },
  );

  app.post<{ Body: AddCartItemRequestT }>(
    "/cart/items",
    {
      schema: {
        tags: ["cart"],
        operationId: "addCartItem",
        summary: "Add a product to the cart (merge-by-product).",
        security: [{ bearerAuth: [] }],
        body: { $ref: "AddCartItemRequest#" },
        response: {
          201: { $ref: "Cart#" },
          404: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const jwt = await requireAuth(req);
      const { product_id, quantity } = req.body;
      const product = await prisma.product.findUnique({
        where: { id: product_id },
      });
      if (!product) {
        return reply.code(404).send({ error: "Product not found" });
      }
      const cart = await getOrCreateCart(jwt.sub);
      await prisma.cartItem.upsert({
        where: {
          cartId_productId: { cartId: cart.id, productId: product_id },
        },
        update: { quantity: { increment: quantity } },
        create: { cartId: cart.id, productId: product_id, quantity },
      });
      const fresh = await getOrCreateCart(jwt.sub);
      return reply.code(201).send(toCartDto(fresh));
    },
  );

  app.patch<{ Params: { id: string }; Body: UpdateCartItemRequestT }>(
    "/cart/items/:id",
    {
      schema: {
        tags: ["cart"],
        operationId: "updateCartItem",
        summary:
          "Set the quantity of a cart line item. Quantity 0 removes the line.",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidPathParam#" },
        body: { $ref: "UpdateCartItemRequest#" },
        response: {
          200: { $ref: "Cart#" },
          404: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const jwt = await requireAuth(req);
      const cart = await getOrCreateCart(jwt.sub);
      const item = await prisma.cartItem.findFirst({
        where: { id: req.params.id, cartId: cart.id },
      });
      if (!item) {
        return reply.code(404).send({ error: "Cart item not found" });
      }
      if (req.body.quantity === 0) {
        await prisma.cartItem.delete({ where: { id: item.id } });
      } else {
        await prisma.cartItem.update({
          where: { id: item.id },
          data: { quantity: req.body.quantity },
        });
      }
      const fresh = await getOrCreateCart(jwt.sub);
      return toCartDto(fresh);
    },
  );

  app.delete<{ Params: { id: string } }>(
    "/cart/items/:id",
    {
      schema: {
        tags: ["cart"],
        operationId: "removeCartItem",
        summary: "Remove a line item from the cart.",
        security: [{ bearerAuth: [] }],
        params: { $ref: "UuidPathParam#" },
        response: {
          200: { $ref: "Cart#" },
          404: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const jwt = await requireAuth(req);
      const cart = await getOrCreateCart(jwt.sub);
      const item = await prisma.cartItem.findFirst({
        where: { id: req.params.id, cartId: cart.id },
      });
      if (!item) {
        return reply.code(404).send({ error: "Cart item not found" });
      }
      await prisma.cartItem.delete({ where: { id: item.id } });
      const fresh = await getOrCreateCart(jwt.sub);
      return toCartDto(fresh);
    },
  );

  void Cart;
  void CartItem;
  void AddCartItemRequest;
  void UpdateCartItemRequest;
  void UuidPathParam;
  void ErrorResponse;
}

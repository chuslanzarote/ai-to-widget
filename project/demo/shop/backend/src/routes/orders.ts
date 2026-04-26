import type { FastifyInstance } from "fastify";
import {
  Order,
  OrderItem,
  OrderListResponse,
  PlaceOrderRequest,
  ErrorResponse,
} from "../schemas/entities.js";
import { requireAuth } from "../auth/jwt.js";
import { prisma } from "../db.js";

interface OrderRow {
  id: string;
  userId: string;
  totalCents: number;
  status: string;
  createdAt: Date;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
  }>;
}

function toOrderDto(o: OrderRow): Record<string, unknown> {
  return {
    id: o.id,
    user_id: o.userId,
    total_cents: o.totalCents,
    status: o.status,
    created_at: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      product_id: i.productId,
      product_name: i.productName,
      quantity: i.quantity,
      unit_price_cents: i.unitPriceCents,
    })),
  };
}

export async function registerOrderRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    "/orders",
    {
      schema: {
        tags: ["orders"],
        operationId: "placeOrder",
        summary: "Place an order from the shopper's current cart (atomic).",
        security: [{ bearerAuth: [] }],
        body: { $ref: "PlaceOrderRequest#" },
        response: {
          201: { $ref: "Order#" },
          409: { $ref: "ErrorResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req, reply) => {
      const jwt = await requireAuth(req);
      const cart = await prisma.cart.findUnique({
        where: { userId: jwt.sub },
        include: { items: { include: { product: true } } },
      });
      if (!cart || cart.items.length === 0) {
        return reply.code(409).send({ error: "Cart is empty" });
      }

      const order = await prisma.$transaction(async (tx) => {
        const total = cart.items.reduce(
          (acc, it) => acc + it.quantity * it.product.priceCents,
          0,
        );
        const created = await tx.order.create({
          data: {
            userId: jwt.sub,
            totalCents: total,
            status: "placed",
            items: {
              create: cart.items.map((it) => ({
                productId: it.productId,
                productName: it.product.name,
                unitPriceCents: it.product.priceCents,
                quantity: it.quantity,
              })),
            },
          },
          include: { items: true },
        });
        await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
        return created as unknown as OrderRow;
      });

      return reply.code(201).send(toOrderDto(order));
    },
  );

  app.get(
    "/orders",
    {
      schema: {
        tags: ["orders"],
        operationId: "listMyOrders",
        summary: "List the shopper's past orders, newest first.",
        security: [{ bearerAuth: [] }],
        response: {
          200: { $ref: "OrderListResponse#" },
        },
      } as unknown as Record<string, unknown>,
    },
    async (req) => {
      const jwt = await requireAuth(req);
      const rows = await prisma.order.findMany({
        where: { userId: jwt.sub },
        orderBy: { createdAt: "desc" },
        include: { items: true },
      });
      return { orders: rows.map((o) => toOrderDto(o as unknown as OrderRow)) };
    },
  );

  void Order;
  void OrderItem;
  void OrderListResponse;
  void PlaceOrderRequest;
  void ErrorResponse;
}

/**
 * TypeBox schemas for the ATW Reference Shop.
 *
 * These schemas drive:
 *   1. Fastify runtime validation on request bodies, params, and query strings.
 *   2. OpenAPI 3.0 emission via @fastify/swagger.
 *
 * Matches the shapes declared in
 *   specs/007-widget-tool-loop/data-model.md and
 *   specs/007-widget-tool-loop/contracts/shop-openapi.md.
 */
import { Type, Static } from "@sinclair/typebox";

export const ErrorResponse = Type.Object(
  { error: Type.String() },
  { $id: "ErrorResponse" },
);
export type ErrorResponseT = Static<typeof ErrorResponse>;

export const UserSummary = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    email: Type.String({ format: "email" }),
    display_name: Type.String(),
  },
  { $id: "UserSummary" },
);
export type UserSummaryT = Static<typeof UserSummary>;

export const LoginRequest = Type.Object(
  {
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 1 }),
  },
  { $id: "LoginRequest" },
);
export type LoginRequestT = Static<typeof LoginRequest>;

export const LoginResponse = Type.Object(
  {
    token: Type.String(),
    user: UserSummary,
  },
  { $id: "LoginResponse" },
);
export type LoginResponseT = Static<typeof LoginResponse>;

export const Product = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    handle: Type.String(),
    name: Type.String(),
    description: Type.String(),
    price_cents: Type.Integer({ minimum: 0 }),
    image_url: Type.String(),
    in_stock: Type.Boolean(),
    created_at: Type.String({ format: "date-time" }),
  },
  { $id: "Product" },
);
export type ProductT = Static<typeof Product>;

export const ProductListQuery = Type.Object(
  {
    q: Type.Optional(Type.String()),
  },
  { $id: "ProductListQuery" },
);
export type ProductListQueryT = Static<typeof ProductListQuery>;

export const ProductListResponse = Type.Object(
  { products: Type.Array(Type.Ref(Product)) },
  { $id: "ProductListResponse" },
);
export type ProductListResponseT = Static<typeof ProductListResponse>;

export const CartItem = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    product_id: Type.String({ format: "uuid" }),
    product_name: Type.String(),
    quantity: Type.Integer({ minimum: 1 }),
    unit_price_cents: Type.Integer({ minimum: 0 }),
  },
  { $id: "CartItem" },
);
export type CartItemT = Static<typeof CartItem>;

export const Cart = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    items: Type.Array(Type.Ref(CartItem)),
    total_cents: Type.Integer({ minimum: 0 }),
  },
  { $id: "Cart" },
);
export type CartT = Static<typeof Cart>;

export const AddCartItemRequest = Type.Object(
  {
    product_id: Type.String({ format: "uuid" }),
    quantity: Type.Integer({ minimum: 1 }),
  },
  { $id: "AddCartItemRequest" },
);
export type AddCartItemRequestT = Static<typeof AddCartItemRequest>;

export const UpdateCartItemRequest = Type.Object(
  {
    quantity: Type.Integer({ minimum: 0 }),
  },
  { $id: "UpdateCartItemRequest" },
);
export type UpdateCartItemRequestT = Static<typeof UpdateCartItemRequest>;

export const UuidPathParam = Type.Object(
  { id: Type.String({ format: "uuid" }) },
  { $id: "UuidPathParam" },
);

export const OrderItem = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    product_id: Type.String({ format: "uuid" }),
    product_name: Type.String(),
    quantity: Type.Integer({ minimum: 1 }),
    unit_price_cents: Type.Integer({ minimum: 0 }),
  },
  { $id: "OrderItem" },
);
export type OrderItemT = Static<typeof OrderItem>;

export const Order = Type.Object(
  {
    id: Type.String({ format: "uuid" }),
    user_id: Type.String({ format: "uuid" }),
    total_cents: Type.Integer({ minimum: 0 }),
    status: Type.Union([
      Type.Literal("placed"),
      Type.Literal("shipped"),
      Type.Literal("delivered"),
    ]),
    created_at: Type.String({ format: "date-time" }),
    items: Type.Array(Type.Ref(OrderItem)),
  },
  { $id: "Order" },
);
export type OrderT = Static<typeof Order>;

export const PlaceOrderRequest = Type.Object({}, { $id: "PlaceOrderRequest" });

export const OrderListResponse = Type.Object(
  { orders: Type.Array(Type.Ref(Order)) },
  { $id: "OrderListResponse" },
);
export type OrderListResponseT = Static<typeof OrderListResponse>;

/** All named schemas registered with fastify for $ref reuse in OpenAPI. */
export const ALL_SCHEMAS = [
  ErrorResponse,
  UserSummary,
  LoginRequest,
  LoginResponse,
  Product,
  ProductListQuery,
  ProductListResponse,
  CartItem,
  Cart,
  AddCartItemRequest,
  UpdateCartItemRequest,
  UuidPathParam,
  OrderItem,
  Order,
  PlaceOrderRequest,
  OrderListResponse,
] as const;

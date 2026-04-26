import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import { apiRequest } from "./client";
import { setToken } from "../auth/token";

// ---- Types mirror the shop OpenAPI shapes. --------------------------------

export interface Product {
  id: string;
  handle: string;
  name: string;
  description: string;
  price_cents: number;
  image_url: string;
  in_stock: boolean;
  created_at: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Cart {
  id: string;
  items: CartItem[];
  total_cents: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price_cents: number;
}

export interface Order {
  id: string;
  user_id: string;
  total_cents: number;
  status: "placed" | "shipped" | "delivered";
  created_at: string;
  items: OrderItem[];
}

export interface UserSummary {
  id: string;
  email: string;
  display_name: string;
}

// ---- Auth ------------------------------------------------------------------

export function useLogin(): UseMutationResult<
  { token: string; user: UserSummary },
  Error,
  { email: string; password: string }
> {
  return useMutation({
    mutationFn: async (args) =>
      apiRequest<{ token: string; user: UserSummary }>("/auth/login", {
        method: "POST",
        body: args,
      }),
    onSuccess: (res) => {
      setToken(res.token);
    },
  });
}

export function useMe(): UseQueryResult<UserSummary> {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => apiRequest<UserSummary>("/customers/me"),
    retry: false,
  });
}

// ---- Products --------------------------------------------------------------

export function useProducts(q: string | undefined): UseQueryResult<Product[]> {
  return useQuery({
    queryKey: ["products", q ?? ""],
    queryFn: async () => {
      const suffix = q && q.trim().length > 0 ? `?q=${encodeURIComponent(q.trim())}` : "";
      const res = await apiRequest<{ products: Product[] }>("/products" + suffix);
      return res.products;
    },
  });
}

export function useProduct(id: string | undefined): UseQueryResult<Product> {
  return useQuery({
    queryKey: ["product", id],
    queryFn: () => apiRequest<Product>(`/products/${id}`),
    enabled: Boolean(id),
  });
}

// ---- Cart ------------------------------------------------------------------

export function useCart(): UseQueryResult<Cart> {
  return useQuery({
    queryKey: ["cart"],
    queryFn: () => apiRequest<Cart>("/cart"),
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useAddCartItem(): UseMutationResult<
  Cart,
  Error,
  { product_id: string; quantity: number }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args) =>
      apiRequest<Cart>("/cart/items", { method: "POST", body: args }),
    onSuccess: (cart) => {
      qc.setQueryData(["cart"], cart);
    },
  });
}

export function useUpdateCartItem(): UseMutationResult<
  Cart,
  Error,
  { id: string; quantity: number }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, quantity }) =>
      apiRequest<Cart>(`/cart/items/${id}`, {
        method: "PATCH",
        body: { quantity },
      }),
    onSuccess: (cart) => {
      qc.setQueryData(["cart"], cart);
    },
  });
}

export function useRemoveCartItem(): UseMutationResult<Cart, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiRequest<Cart>(`/cart/items/${id}`, { method: "DELETE" }),
    onSuccess: (cart) => {
      qc.setQueryData(["cart"], cart);
    },
  });
}

// ---- Orders ----------------------------------------------------------------

export function usePlaceOrder(): UseMutationResult<Order, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest<Order>("/orders", { method: "POST", body: {} }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cart"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useOrders(): UseQueryResult<Order[]> {
  return useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const res = await apiRequest<{ orders: Order[] }>("/orders");
      return res.orders;
    },
  });
}

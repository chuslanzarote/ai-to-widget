import { useNavigate } from "react-router-dom";
import {
  useCart,
  usePlaceOrder,
  useRemoveCartItem,
  useUpdateCartItem,
} from "../api/hooks";

function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-EU", {
    style: "currency",
    currency: "EUR",
  });
}

export function Cart(): JSX.Element {
  const cart = useCart();
  const update = useUpdateCartItem();
  const remove = useRemoveCartItem();
  const place = usePlaceOrder();
  const nav = useNavigate();

  if (cart.isLoading) return <p>Loading…</p>;
  if (cart.isError) return <p className="text-red-700">{cart.error.message}</p>;

  const items = cart.data?.items ?? [];
  if (items.length === 0) return <p>Your cart is empty.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Cart</h1>
      <ul className="space-y-3">
        {items.map((it) => (
          <li
            key={it.id}
            className="bg-white rounded shadow p-3 flex items-center gap-4"
          >
            <div className="flex-1">
              <p className="font-medium">{it.product_name}</p>
              <p className="text-sm font-mono text-coffee-700">
                {fmtPrice(it.unit_price_cents)} ×{" "}
                <input
                  type="number"
                  min={0}
                  value={it.quantity}
                  onChange={(e) => {
                    const n = Number.parseInt(e.target.value, 10);
                    if (Number.isFinite(n) && n >= 0) {
                      update.mutate({ id: it.id, quantity: n });
                    }
                  }}
                  className="w-16 px-2 py-1 border rounded"
                />
              </p>
            </div>
            <span className="font-mono">
              {fmtPrice(it.quantity * it.unit_price_cents)}
            </span>
            <button
              type="button"
              onClick={() => remove.mutate(it.id)}
              className="text-sm text-red-700 underline"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <span className="text-lg">
          Total:{" "}
          <span className="font-mono font-semibold">
            {fmtPrice(cart.data?.total_cents ?? 0)}
          </span>
        </span>
        <button
          type="button"
          disabled={place.isPending}
          onClick={() =>
            place.mutate(undefined, {
              onSuccess: () => nav("/orders"),
            })
          }
          className="px-4 py-2 rounded bg-coffee-700 text-coffee-50 disabled:opacity-60"
        >
          {place.isPending ? "Placing…" : "Place order"}
        </button>
      </div>
      {place.isError && (
        <p className="mt-2 text-red-700">{place.error.message}</p>
      )}
    </div>
  );
}

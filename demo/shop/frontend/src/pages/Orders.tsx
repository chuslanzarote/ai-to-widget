import { useOrders } from "../api/hooks";

function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-EU", {
    style: "currency",
    currency: "EUR",
  });
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function Orders(): JSX.Element {
  const orders = useOrders();

  if (orders.isLoading) return <p>Loading…</p>;
  if (orders.isError)
    return <p className="text-red-700">{orders.error.message}</p>;

  const list = orders.data ?? [];
  if (list.length === 0) return <p>No orders yet.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Past orders</h1>
      <ul className="space-y-4">
        {list.map((o) => (
          <li key={o.id} className="bg-white rounded shadow p-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm">#{o.id.slice(0, 8)}</span>
              <span className="text-sm">{fmtDate(o.created_at)}</span>
              <span className="text-sm uppercase tracking-wide">
                {o.status}
              </span>
              <span className="font-mono font-semibold">
                {fmtPrice(o.total_cents)}
              </span>
            </div>
            <ul className="mt-2 text-sm text-coffee-700 space-y-1">
              {o.items.map((it) => (
                <li key={it.id}>
                  {it.quantity} × {it.product_name} —{" "}
                  {fmtPrice(it.unit_price_cents)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

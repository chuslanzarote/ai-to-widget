import { useSearchParams, Link } from "react-router-dom";
import { useProducts } from "../api/hooks";

function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-EU", {
    style: "currency",
    currency: "EUR",
  });
}

export function ProductList(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const products = useProducts(q);

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const input = e.currentTarget.elements.namedItem(
            "q",
          ) as HTMLInputElement;
          const v = input.value.trim();
          if (v.length > 0) setParams({ q: v });
          else setParams({});
        }}
        className="mb-6 flex gap-2"
      >
        <input
          name="q"
          defaultValue={q}
          placeholder="Search coffee, gear, accessories…"
          className="flex-1 px-3 py-2 border rounded"
        />
        <button
          type="submit"
          className="px-4 py-2 rounded bg-coffee-700 text-coffee-50"
        >
          Search
        </button>
      </form>
      {products.isLoading && <p>Loading…</p>}
      {products.isError && (
        <p className="text-red-700">Failed to load products.</p>
      )}
      {products.data && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.data.map((p) => (
            <li key={p.id} className="bg-white p-4 rounded shadow">
              <div className="aspect-square bg-coffee-50 rounded mb-3 flex items-center justify-center overflow-hidden">
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="object-cover w-full h-full"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.visibility =
                      "hidden";
                  }}
                />
              </div>
              <h2 className="font-semibold">{p.name}</h2>
              <p className="text-sm text-coffee-700 line-clamp-2">
                {p.description}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-mono">{fmtPrice(p.price_cents)}</span>
                <Link
                  to={`/products/${p.handle}`}
                  className="text-sm underline"
                >
                  View
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      {products.data?.length === 0 && <p>No products match your search.</p>}
    </div>
  );
}

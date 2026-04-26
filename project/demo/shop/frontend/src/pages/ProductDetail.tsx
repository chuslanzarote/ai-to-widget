import { useParams, Link } from "react-router-dom";
import { useAddCartItem, useProducts } from "../api/hooks";
import { isAuthenticated } from "../auth/token";

function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString("en-EU", {
    style: "currency",
    currency: "EUR",
  });
}

export function ProductDetail(): JSX.Element {
  const { handle } = useParams<{ handle: string }>();
  const products = useProducts(undefined);
  const add = useAddCartItem();
  const product = products.data?.find((p) => p.handle === handle);
  const authed = isAuthenticated();

  if (products.isLoading) return <p>Loading…</p>;
  if (!product) return <p>Product not found.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      <div className="bg-white rounded shadow p-4">
        <div className="aspect-square bg-coffee-50 rounded overflow-hidden flex items-center justify-center">
          <img
            src={product.image_url}
            alt={product.name}
            className="object-cover w-full h-full"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.visibility =
                "hidden";
            }}
          />
        </div>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">{product.name}</h1>
        <p className="mt-2 text-coffee-700">{product.description}</p>
        <p className="mt-4 text-xl font-mono">
          {fmtPrice(product.price_cents)}
        </p>
        {authed ? (
          <button
            type="button"
            onClick={() =>
              add.mutate({ product_id: product.id, quantity: 1 })
            }
            disabled={add.isPending}
            className="mt-6 px-4 py-2 rounded bg-coffee-700 text-coffee-50 disabled:opacity-60"
          >
            {add.isPending ? "Adding…" : "Add to cart"}
          </button>
        ) : (
          <Link to="/login" className="mt-6 inline-block underline">
            Log in to add to cart
          </Link>
        )}
        {add.isError && (
          <p className="mt-2 text-red-700">{add.error.message}</p>
        )}
      </div>
    </div>
  );
}

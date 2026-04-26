import { useCart } from "../api/hooks";
import { isAuthenticated } from "../auth/token";

export function CartIndicator(): JSX.Element {
  const authed = isAuthenticated();
  const cart = useCart();
  const count = authed && cart.data
    ? cart.data.items.reduce((acc, it) => acc + it.quantity, 0)
    : 0;
  return (
    <span
      className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-2 rounded-full bg-coffee-700 text-coffee-50 text-sm font-semibold"
      aria-label={`Cart: ${count} item${count === 1 ? "" : "s"}`}
    >
      {count}
    </span>
  );
}

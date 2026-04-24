import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { CartIndicator } from "./CartIndicator";
import { clearToken, isAuthenticated } from "../auth/token";
import { useMe } from "../api/hooks";

export function Layout(): JSX.Element {
  const authed = isAuthenticated();
  const me = useMe();
  const nav = useNavigate();

  const logout = () => {
    clearToken();
    nav("/login", { replace: true });
  };

  return (
    <div className="min-h-full flex flex-col">
      <header className="bg-coffee-900 text-coffee-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link to="/" className="font-semibold text-lg tracking-wide">
            ATW Coffee
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                isActive ? "underline" : "hover:underline"
              }
            >
              Products
            </NavLink>
            {authed && (
              <NavLink
                to="/orders"
                className={({ isActive }) =>
                  isActive ? "underline" : "hover:underline"
                }
              >
                Orders
              </NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <Link to="/cart" className="flex items-center gap-2 text-sm">
              <span>Cart</span>
              <CartIndicator />
            </Link>
            {authed ? (
              <>
                {me.data && (
                  <span className="text-sm opacity-80">
                    {me.data.display_name}
                  </span>
                )}
                <button
                  className="text-sm underline"
                  onClick={logout}
                  type="button"
                >
                  Log out
                </button>
              </>
            ) : (
              <Link to="/login" className="text-sm underline">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

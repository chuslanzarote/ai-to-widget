import { FormEvent, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLogin } from "../api/hooks";

export function Login(): JSX.Element {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useLogin();
  const nav = useNavigate();
  const location = useLocation();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    login.mutate(
      { email, password },
      {
        onSuccess: () => {
          const next =
            (location.state as { from?: string } | null)?.from ?? "/";
          nav(next, { replace: true });
        },
      },
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white p-6 rounded shadow">
      <h1 className="text-2xl font-semibold mb-4">Log in</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <label className="block">
          <span className="text-sm">Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full px-3 py-2 border rounded"
          />
        </label>
        <button
          type="submit"
          disabled={login.isPending}
          className="w-full py-2 rounded bg-coffee-700 text-coffee-50 font-semibold disabled:opacity-60"
        >
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
        {login.isError && (
          <p className="text-sm text-red-700">{login.error.message}</p>
        )}
        <p className="text-xs text-coffee-700">
          Seeded accounts are documented in <code>demo/shop/README.md</code>.
        </p>
      </form>
    </div>
  );
}

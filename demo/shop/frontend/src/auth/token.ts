/**
 * Single ownership point for the bearer-JWT storage contract (FR-006).
 * The widget reads the same key to attach Authorization headers client-side.
 */
const KEY = "shop_auth_token";

export function getToken(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(jwt: string): void {
  window.localStorage.setItem(KEY, jwt);
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isAuthenticated(): boolean {
  const t = getToken();
  return typeof t === "string" && t.length > 0;
}

/**
 * Returns true when the header must be stripped before any route handler
 * sees it. `X-Atw-Session-Id` is intentionally allowed through so the
 * rate limiter can key on it (it is a widget-issued UUID, not a
 * shopper credential).
 */
export declare function isCredentialBearing(headerName: string): boolean;
/**
 * Strip credential-bearing headers from a plain header bag in place.
 * Returns the number of headers stripped so callers can log the count.
 */
export declare function stripCredentialHeaders(headers: Record<string, unknown>): number;
//# sourceMappingURL=runtime-credential-strip.d.ts.map
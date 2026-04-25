/**
 * Credential-bearing-header predicate shared between the backend's
 * Fastify onRequest hook (`packages/backend/src/lib/credential-strip.ts.hbs`)
 * and its unit tests (T084).
 *
 * Source: specs/003-runtime/contracts/chat-endpoint.md §4 step 2, §6.
 */
const FORBIDDEN_EXACT = new Set(["authorization", "cookie", "set-cookie"]);
const FORBIDDEN_PATTERN = /^x-.*-(token|auth|session)$/i;
const ALLOW_EXACT = new Set(["x-atw-session-id"]);
/**
 * Returns true when the header must be stripped before any route handler
 * sees it. `X-Atw-Session-Id` is intentionally allowed through so the
 * rate limiter can key on it (it is a widget-issued UUID, not a
 * shopper credential).
 */
export function isCredentialBearing(headerName) {
    const lower = headerName.toLowerCase();
    if (ALLOW_EXACT.has(lower))
        return false;
    if (FORBIDDEN_EXACT.has(lower))
        return true;
    return FORBIDDEN_PATTERN.test(lower);
}
/**
 * Strip credential-bearing headers from a plain header bag in place.
 * Returns the number of headers stripped so callers can log the count.
 */
export function stripCredentialHeaders(headers) {
    let stripped = 0;
    for (const key of Object.keys(headers)) {
        if (isCredentialBearing(key)) {
            delete headers[key];
            stripped += 1;
        }
    }
    return stripped;
}
//# sourceMappingURL=runtime-credential-strip.js.map
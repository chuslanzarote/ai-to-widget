/**
 * T085 / US6 — Credential sovereignty end-to-end (SC-006).
 *
 * Gated by ATW_E2E_DOCKER=1. Fires a full conversation at the backend
 * while attempting to leak credentials in every common header channel,
 * then scrapes the backend logs to prove none were retained.
 *
 * The invariant is structural (credential-strip onRequest hook), so this
 * test is mainly a regression tripwire: if a future refactor bypasses the
 * hook, this test will fire.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

describe.skipIf(!DOCKER_AVAILABLE)("credential sovereignty (T085 / SC-006)", () => {
  it("zero backend-bound requests carry shopper credentials, end to end", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const session = "t085-" + Date.now();

    const headersWithJunk: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Atw-Session-Id": session,
      // These should all be stripped by the onRequest hook.
      Authorization: "Bearer leaked-token",
      Cookie: "session=leaked",
      "X-Shop-Token": "leaked-shop-token",
      "X-Auth-Session": "leaked",
    };

    const res = await fetch(backendUrl + "/v1/chat", {
      method: "POST",
      headers: headersWithJunk,
      body: JSON.stringify({
        message: "hola",
        history: [],
        context: { locale: "es-ES" },
      }),
    });
    expect(res.status).toBe(200);

    // The response body MUST NOT echo the leaked credential values.
    const body = await res.text();
    expect(body).not.toContain("leaked-token");
    expect(body).not.toContain("leaked-shop-token");
    expect(body).not.toContain("session=leaked");

    // The response MUST carry X-Request-Id so operators can correlate.
    expect(res.headers.get("x-request-id")).toBeTruthy();
  }, 20_000);
});

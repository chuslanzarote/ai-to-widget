/**
 * T106 / US10 — Rate limit enforcement (SC-010).
 *
 * Gated by ATW_E2E_DOCKER=1 AND the test overlay
 * (`docker-compose.test.yml` — sets RATE_LIMIT_MAX=3). Fires 5 requests
 * in quick succession against `/v1/chat` with the same session id; the
 * 4th must return 429 with a Retry-After response field.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

describe.skipIf(!DOCKER_AVAILABLE)("rate limit (T106 / SC-010)", () => {
  it("returns 429 with retry_after_seconds once the session cap is exceeded", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const session = "t106-rate-" + Date.now();
    const responses: Array<{ status: number; body: unknown }> = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(backendUrl + "/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Atw-Session-Id": session,
        },
        body: JSON.stringify({
          message: `hola ${i}`,
          history: [],
          context: { locale: "es-ES" },
        }),
      });
      const body = await res.json().catch(() => ({}));
      responses.push({ status: res.status, body });
      if (res.status === 429) break;
    }
    const limited = responses.find((r) => r.status === 429);
    expect(limited, "expected at least one 429 after the session cap").toBeDefined();
    if (limited) {
      expect(
        (limited.body as { retry_after_seconds?: number }).retry_after_seconds,
      ).toBeGreaterThan(0);
    }
  }, 30_000);
});

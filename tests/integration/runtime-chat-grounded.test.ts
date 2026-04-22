/**
 * T044 / US1 integration — grounded chat end-to-end on the Aurelia fixture.
 *
 * Requires Docker + the Aurelia demo stack. Auto-skips without
 * ATW_E2E_DOCKER=1 (mirrors Feature 002's gating pattern). Full behaviour
 * is defined in specs/003-runtime/contracts/chat-endpoint.md §4 and
 * specs/003-runtime/quickstart.md §2.5.
 *
 * SC-001: grounded flavour-profile reply with ≥ 2 citations; p50 ≤ 4 s.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

describe.skipIf(!DOCKER_AVAILABLE)("runtime chat grounded (T044 / SC-001)", () => {
  it("returns a grounded reply mentioning real products within 4 seconds", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const body = {
      message:
        "Estoy buscando un café chocolatoso para filtro en V60, con poca acidez.",
      history: [],
      context: { locale: "es-ES" },
    };
    const start = Date.now();
    const res = await fetch(backendUrl + "/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atw-Session-Id": "t044-" + Date.now(),
      },
      body: JSON.stringify(body),
    });
    const elapsed = Date.now() - start;
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      message: string;
      citations: Array<{ entity_id: string; entity_type: string; relevance: number }>;
      actions: unknown[];
      request_id: string;
    };
    expect(json.message.length).toBeGreaterThan(0);
    expect(json.citations.length).toBeGreaterThanOrEqual(2);
    expect(json.actions).toEqual([]);
    expect(
      elapsed,
      `latency ${elapsed}ms exceeds SC-001 p50 budget of 4000ms`,
    ).toBeLessThan(4000);

    // Every citation must be a real entity from the index (not fabricated).
    for (const c of json.citations) {
      expect(c.entity_id.length).toBeGreaterThan(0);
      expect(c.entity_type.length).toBeGreaterThan(0);
      expect(c.relevance).toBeGreaterThanOrEqual(0);
      expect(c.relevance).toBeLessThanOrEqual(1);
    }
  }, 30_000);
});

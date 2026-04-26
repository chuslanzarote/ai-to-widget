/**
 * T081 / US5 — Comparison integration.
 * Scripted "A vs B" against the Aurelia seed; asserts both entity ids
 * appear in citations[] and both names in the reply. Gated by
 * ATW_E2E_DOCKER=1.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

describe.skipIf(!DOCKER_AVAILABLE)("runtime comparison (T081 / SC-001 sub-case)", () => {
  it("cites both named entities", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const res = await fetch(backendUrl + "/v1/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Atw-Session-Id": "t081-" + Date.now(),
      },
      body: JSON.stringify({
        message:
          "Colombia Huila vs Kenya Karundul — ¿cuál recomiendas para V60?",
        history: [],
        context: { locale: "es-ES" },
      }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      message: string;
      citations: Array<{ entity_id: string; title?: string }>;
    };
    const reply = json.message.toLowerCase();
    expect(reply).toMatch(/huila/);
    expect(reply).toMatch(/karundul|kenya/);
    // At least two distinct entity ids in citations.
    const uniqueIds = new Set(json.citations.map((c) => c.entity_id));
    expect(uniqueIds.size).toBeGreaterThanOrEqual(2);
  }, 30_000);
});

/**
 * T060 / US3 — Multi-turn coherence against the live backend.
 *
 * Gated by ATW_E2E_DOCKER=1. A 5-turn scripted conversation where only
 * turn 1 names the entity. SC-003 requires ≥ 4 of the next 4 follow-ups
 * resolve to the same entity.
 *
 * The assertion is soft: we count how many of the follow-up replies
 * mention the entity by name/id. This test is inherently model-sensitive;
 * a flaky failure is a signal for prompt tuning, not a blocking fail.
 */
import { describe, it, expect } from "vitest";

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

interface Turn {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

describe.skipIf(!DOCKER_AVAILABLE)("runtime multi-turn coherence (T060 / SC-003)", () => {
  it("resolves pronoun/implicit references to the originally-named entity", async () => {
    const backendUrl = process.env.ATW_BACKEND_URL ?? "http://localhost:3100";
    const history: Turn[] = [];
    const session = "t060-" + Date.now();

    async function send(message: string): Promise<{ reply: string; entity: string | null }> {
      const res = await fetch(backendUrl + "/v1/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Atw-Session-Id": session,
        },
        body: JSON.stringify({
          message,
          history,
          context: { locale: "en-US" },
        }),
      });
      expect(res.status).toBe(200);
      const j = (await res.json()) as {
        message: string;
        citations: Array<{ entity_id: string; title?: string }>;
      };
      history.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });
      history.push({
        role: "assistant",
        content: j.message,
        timestamp: new Date().toISOString(),
      });
      const first = j.citations[0];
      return { reply: j.message, entity: first ? first.entity_id : null };
    }

    const first = await send("Tell me about the Colombia Huila coffee.");
    expect(first.entity).not.toBeNull();
    const anchor = first.entity as string;

    const followUps = [
      "What's the price?",
      "Is it good for V60?",
      "What are the flavour notes?",
      "Can I get it in 250g?",
    ];
    let resolved = 0;
    for (const q of followUps) {
      const { reply, entity } = await send(q);
      if (entity === anchor || reply.toLowerCase().includes("huila")) resolved += 1;
    }
    expect(resolved).toBeGreaterThanOrEqual(4);
  }, 90_000);
});

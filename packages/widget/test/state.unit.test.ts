import { describe, it, expect, beforeEach } from "vitest";
import {
  turns,
  appendTurn,
  trimHistoryForRequest,
  resetConversation,
  MAX_CONVERSATION_TURNS,
} from "../src/state.js";

describe("conversation state (T059 / US3 / FR-019)", () => {
  beforeEach(() => {
    resetConversation();
  });

  it("appends turns up to the cap without dropping", () => {
    for (let i = 0; i < 5; i++) {
      appendTurn({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `turn ${i}`,
        timestamp: new Date().toISOString(),
      });
    }
    expect(turns.value).toHaveLength(5);
    expect(turns.value[0].content).toBe("turn 0");
  });

  it("drops the oldest turns FIFO once over the cap", () => {
    for (let i = 0; i < MAX_CONVERSATION_TURNS + 5; i++) {
      appendTurn({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `turn ${i}`,
        timestamp: new Date().toISOString(),
      });
    }
    expect(turns.value).toHaveLength(MAX_CONVERSATION_TURNS);
    // Oldest retained turn is #5 (we dropped 0..4).
    expect(turns.value[0].content).toBe("turn 5");
    expect(turns.value[turns.value.length - 1].content).toBe(
      `turn ${MAX_CONVERSATION_TURNS + 4}`,
    );
  });

  it("trimHistoryForRequest keeps only the last N entries", () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
      content: `t${i}`,
      timestamp: "2026-04-22T00:00:00Z",
    }));
    const out = trimHistoryForRequest(history);
    expect(out).toHaveLength(MAX_CONVERSATION_TURNS);
    expect(out[0].content).toBe("t5");
  });

  it("trimHistoryForRequest is a no-op when within cap", () => {
    const history = Array.from({ length: 5 }, (_, i) => ({
      role: "user" as const,
      content: `t${i}`,
      timestamp: "2026-04-22T00:00:00Z",
    }));
    const out = trimHistoryForRequest(history);
    expect(out).toEqual(history);
  });
});

import { describe, it, expect } from "vitest";
import {
  ChatRequestSchema,
  ChatResponseSchema,
  ActionIntentSchema,
  CitationSchema,
  SessionContextSchema,
  ConversationTurnSchema,
  ActionFollowUpSchema,
} from "../src/lib/types.js";

/**
 * T026 — zod round-trip for every runtime wire shape defined in
 * specs/003-runtime/data-model.md §1.
 */
describe("runtime wire types (T026 / data-model §1)", () => {
  it("ChatRequest accepts a minimal valid payload", () => {
    const parsed = ChatRequestSchema.parse({
      message: "Hello",
      history: [],
      context: { locale: "es-ES" },
    });
    expect(parsed.message).toBe("Hello");
  });

  it("ChatRequest rejects empty message", () => {
    expect(() =>
      ChatRequestSchema.parse({ message: "", history: [], context: { locale: "en-US" } }),
    ).toThrow();
  });

  it("ChatRequest rejects message longer than 4000 chars", () => {
    expect(() =>
      ChatRequestSchema.parse({
        message: "a".repeat(4001),
        history: [],
        context: { locale: "en-US" },
      }),
    ).toThrow();
  });

  it("ChatRequest rejects history longer than 20 turns", () => {
    const turn = { role: "user" as const, content: "x", timestamp: new Date().toISOString() };
    expect(() =>
      ChatRequestSchema.parse({
        message: "ok",
        history: Array.from({ length: 21 }, () => turn),
        context: { locale: "en-US" },
      }),
    ).toThrow();
  });

  it("ActionIntent accepts confirmation_required as a boolean (Feature 007)", () => {
    // Feature 007 collapsed the safe-read / action split — reads emit
    // intents with `confirmation_required: false`, writes with `true`.
    const base = {
      id: "a1",
      tool: "add_to_cart",
      arguments: {},
      description: "Add 1 item",
      http: { method: "POST" as const, path: "/store/carts/c1/line-items" },
    };
    ActionIntentSchema.parse({ ...base, confirmation_required: true });
    ActionIntentSchema.parse({ ...base, confirmation_required: false });
    expect(() =>
      ActionIntentSchema.parse({ ...base, confirmation_required: "yes" as unknown as boolean }),
    ).toThrow();
  });

  it("Citation enforces relevance in [0,1]", () => {
    CitationSchema.parse({
      entity_id: "p1",
      entity_type: "product",
      relevance: 0.5,
    });
    expect(() =>
      CitationSchema.parse({
        entity_id: "p1",
        entity_type: "product",
        relevance: 1.1,
      }),
    ).toThrow();
  });

  it("ChatResponse round-trips with minimal fields", () => {
    const parsed = ChatResponseSchema.parse({
      message: "hello",
      citations: [],
      actions: [],
      request_id: "req-1",
    });
    expect(parsed.citations).toEqual([]);
    expect(parsed.suggestions).toBeUndefined();
  });

  it("SessionContext allows page_context with nested ActionFollowUp", () => {
    SessionContextSchema.parse({
      locale: "en-US",
      page_context: {
        atw_action_follow_up: ActionFollowUpSchema.parse({
          action_id: "a1",
          outcome: "succeeded",
        }),
        page: "home",
      },
    });
  });

  it("ConversationTurn schema accepts user and assistant roles", () => {
    ConversationTurnSchema.parse({
      role: "user",
      content: "hi",
      timestamp: "2026-04-22T00:00:00Z",
    });
    ConversationTurnSchema.parse({
      role: "assistant",
      content: "hi back",
      timestamp: "2026-04-22T00:00:01Z",
    });
    expect(() =>
      ConversationTurnSchema.parse({ role: "system", content: "x", timestamp: "x" }),
    ).toThrow();
  });
});

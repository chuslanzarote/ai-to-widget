import { describe, it, expect } from "vitest";
import { detectContradictions } from "../src/lib/contradiction-check.js";

describe("detectContradictions", () => {
  it("flags a price-negotiation use case against a 'never discuss price' forbidden rule", () => {
    const report = detectContradictions({
      allowedActions: ["Answer product questions"],
      forbiddenActions: ["Never discuss price or negotiate discounts"],
      primaryUseCases: ["Customer wants to negotiate a lower price on a mug"],
      tone: "warm",
    });
    expect(report.contradictions.length).toBeGreaterThan(0);
    expect(report.contradictions[0].kind).toBe("use-case-vs-forbidden");
    expect(report.disambiguationPrompt).toMatch(/contradiction/i);
  });

  it("flags 'discuss competitors' in both allowed and forbidden lists", () => {
    const report = detectContradictions({
      allowedActions: ["Discuss competitors when the customer asks"],
      forbiddenActions: ["Never discuss competitors"],
      primaryUseCases: [],
      tone: "warm",
    });
    expect(report.contradictions.some((c) => c.kind === "allowed-vs-forbidden")).toBe(true);
  });

  it("surfaces a tone/action conflict between 'terse' tone and 'explain' actions", () => {
    const report = detectContradictions({
      allowedActions: ["Explain the slip-casting technique in detail"],
      forbiddenActions: [],
      primaryUseCases: [],
      tone: "terse and concise",
    });
    expect(report.contradictions.some((c) => c.kind === "tone-vs-action")).toBe(true);
  });

  it("returns no contradictions when allowed and forbidden lists are orthogonal", () => {
    const report = detectContradictions({
      allowedActions: ["Answer product questions", "Check in-stock quantity"],
      forbiddenActions: ["Process payments", "Share customer personal information"],
      primaryUseCases: ["Help a customer pick a housewarming gift"],
      tone: "warm but precise",
    });
    expect(report.contradictions).toEqual([]);
    expect(report.disambiguationPrompt).toBe("");
  });
});

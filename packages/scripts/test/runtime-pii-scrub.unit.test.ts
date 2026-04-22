import { describe, it, expect } from "vitest";
import { scrubPii } from "../src/lib/runtime-pii-scrub.js";

/**
 * T111 — defence-in-depth PII scrubber unit test.
 * Contract: specs/003-runtime/research §7 + FR-038.
 */
describe("scrubPii (T111 / FR-038)", () => {
  it("redacts emails", () => {
    const r = scrubPii("Email me at ava.jensen@example.com please");
    expect(r.text).toBe("Email me at [redacted] please");
    expect(r.redactions).toBe(1);
  });

  it("redacts international phone numbers", () => {
    const r = scrubPii("Call +1-555-202-4412 or +39 02 555-8821");
    expect(r.redactions).toBe(2);
    expect(r.text).not.toMatch(/555-202-4412/);
    expect(r.text).not.toMatch(/02 555-8821/);
  });

  it("redacts card-like runs", () => {
    const r = scrubPii("Card: 4242 4242 4242 4242 on file");
    expect(r.text).toContain("[redacted]");
    expect(r.text).not.toMatch(/4242 4242/);
  });

  it("redacts IBANs", () => {
    const r = scrubPii("IBAN GB29NWBK60161331926819 to wire");
    expect(r.text).toContain("[redacted]");
    expect(r.text).not.toMatch(/GB29NWBK/);
  });

  it("leaves legitimate product copy untouched", () => {
    const input =
      "Colombia Huila pulped natural, 250g bag, tasting notes cocoa cherry panela";
    const r = scrubPii(input);
    expect(r.text).toBe(input);
    expect(r.redactions).toBe(0);
  });

  it("counts multiple redactions across patterns", () => {
    const r = scrubPii(
      "Contact ava.jensen@example.com at +1-555-202-4412, IBAN GB29NWBK60161331926819.",
    );
    expect(r.redactions).toBeGreaterThanOrEqual(3);
  });
});

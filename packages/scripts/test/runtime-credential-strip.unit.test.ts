import { describe, it, expect } from "vitest";
import {
  isCredentialBearing,
  stripCredentialHeaders,
} from "../src/lib/runtime-credential-strip.js";

describe("isCredentialBearing (T084 / Principle I)", () => {
  it("flags Authorization / Cookie / Set-Cookie (case-insensitive)", () => {
    expect(isCredentialBearing("Authorization")).toBe(true);
    expect(isCredentialBearing("authorization")).toBe(true);
    expect(isCredentialBearing("Cookie")).toBe(true);
    expect(isCredentialBearing("COOKIE")).toBe(true);
    expect(isCredentialBearing("Set-Cookie")).toBe(true);
  });

  it("flags X-*-Token / X-*-Auth / X-*-Session variants", () => {
    expect(isCredentialBearing("X-Shop-Token")).toBe(true);
    expect(isCredentialBearing("X-My-Auth")).toBe(true);
    expect(isCredentialBearing("x-custom-session")).toBe(true);
  });

  it("does NOT flag X-Atw-Session-Id (widget-issued UUID for rate limit)", () => {
    expect(isCredentialBearing("X-Atw-Session-Id")).toBe(false);
    expect(isCredentialBearing("x-atw-session-id")).toBe(false);
  });

  it("does NOT flag unrelated headers", () => {
    for (const h of [
      "Content-Type",
      "Accept",
      "X-Request-Id",
      "User-Agent",
      "Referer",
      "Origin",
      "X-Forwarded-For",
    ]) {
      expect(isCredentialBearing(h), `${h} should not be flagged`).toBe(false);
    }
  });
});

describe("stripCredentialHeaders (T084)", () => {
  it("returns the count of removed headers", () => {
    const h: Record<string, unknown> = {
      "content-type": "application/json",
      authorization: "Bearer leaked",
      cookie: "session=leaked",
      "x-shop-token": "leaked",
      "x-request-id": "req-1",
      "x-atw-session-id": "sid-1",
    };
    const n = stripCredentialHeaders(h);
    expect(n).toBe(3);
    expect(h["content-type"]).toBe("application/json");
    expect(h["x-request-id"]).toBe("req-1");
    expect(h["x-atw-session-id"]).toBe("sid-1");
    expect(h["authorization"]).toBeUndefined();
    expect(h["cookie"]).toBeUndefined();
    expect(h["x-shop-token"]).toBeUndefined();
  });

  it("is a no-op when no credential headers are present", () => {
    const h: Record<string, unknown> = {
      "content-type": "application/json",
      "x-atw-session-id": "abc",
    };
    expect(stripCredentialHeaders(h)).toBe(0);
    expect(Object.keys(h)).toHaveLength(2);
  });
});

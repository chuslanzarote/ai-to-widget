import { describe, it, expect } from "vitest";
import {
  loadRuntimeConfig,
  ConfigError,
} from "../src/lib/runtime-config.js";

/**
 * T099 / U2 — contract test for the runtime config loader.
 * Asserts FR-039: missing required env vars produce a clear error
 * naming every missing variable; the backend exits fast at startup.
 */
describe("loadRuntimeConfig (T099 / FR-039 / U2)", () => {
  it("throws ConfigError naming every missing required var", () => {
    try {
      loadRuntimeConfig({});
      throw new Error("expected ConfigError");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const ce = err as ConfigError;
      expect(ce.missing).toEqual(
        expect.arrayContaining([
          "DATABASE_URL",
          "ANTHROPIC_API_KEY",
          "ALLOWED_ORIGINS",
        ]),
      );
      expect(ce.message).toMatch(/DATABASE_URL/);
      expect(ce.message).toMatch(/ANTHROPIC_API_KEY/);
      expect(ce.message).toMatch(/ALLOWED_ORIGINS/);
    }
  });

  it("reports a single missing var when only one is absent", () => {
    try {
      loadRuntimeConfig({
        DATABASE_URL: "postgres://u:p@h:5432/d",
        ANTHROPIC_API_KEY: "sk-123",
      });
      throw new Error("expected ConfigError");
    } catch (err) {
      expect((err as ConfigError).missing).toEqual(["ALLOWED_ORIGINS"]);
    }
  });

  it("parses comma-separated ALLOWED_ORIGINS", () => {
    const cfg = loadRuntimeConfig({
      DATABASE_URL: "postgres://u:p@h:5432/d",
      ANTHROPIC_API_KEY: "sk-123",
      ALLOWED_ORIGINS: "https://a.com, https://b.com ,https://c.com",
    });
    expect(cfg.allowedOrigins).toEqual([
      "https://a.com",
      "https://b.com",
      "https://c.com",
    ]);
  });

  it("rejects non-numeric overrides with ConfigError", () => {
    expect(() =>
      loadRuntimeConfig({
        DATABASE_URL: "x",
        ANTHROPIC_API_KEY: "x",
        ALLOWED_ORIGINS: "http://x",
        RETRIEVAL_TOP_K: "not-a-number",
      }),
    ).toThrow(ConfigError);
  });

  it("applies documented defaults", () => {
    const cfg = loadRuntimeConfig({
      DATABASE_URL: "x",
      ANTHROPIC_API_KEY: "x",
      ALLOWED_ORIGINS: "http://x",
    });
    expect(cfg.port).toBe(3100);
    expect(cfg.retrievalThreshold).toBeCloseTo(0.55);
    expect(cfg.retrievalTopK).toBe(8);
    expect(cfg.maxConversationTurns).toBe(20);
    expect(cfg.rateLimitMax).toBe(60);
    expect(cfg.rateLimitWindowMs).toBe(600_000);
  });

  it("detects production NODE_ENV and defaults log level to info", () => {
    const cfg = loadRuntimeConfig({
      DATABASE_URL: "x",
      ANTHROPIC_API_KEY: "x",
      ALLOWED_ORIGINS: "http://x",
      NODE_ENV: "production",
    });
    expect(cfg.logLevel).toBe("info");
    expect(cfg.nodeEnv).toBe("production");
  });
});

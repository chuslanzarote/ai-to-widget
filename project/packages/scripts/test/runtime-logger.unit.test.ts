import { describe, it, expect } from "vitest";
import {
  REDACTION_PATHS,
  REDACTION_CENSOR,
  redactObject,
} from "../src/lib/runtime-logger.js";

describe("logger redaction paths (T110 / FR-012)", () => {
  it("includes the headers pino must mask", () => {
    expect(REDACTION_PATHS).toContain('req.headers["authorization"]');
    expect(REDACTION_PATHS).toContain('req.headers["cookie"]');
    expect(REDACTION_PATHS).toContain('req.headers["set-cookie"]');
    expect(REDACTION_PATHS).toContain("*.authorization");
    expect(REDACTION_PATHS).toContain("*.cookie");
  });

  it("uses a stable censor string", () => {
    expect(REDACTION_CENSOR).toBe("[redacted]");
  });
});

describe("redactObject (T110 / defence in depth)", () => {
  it("masks req.headers.authorization and cookie", () => {
    const masked = redactObject({
      req: {
        id: "r1",
        headers: {
          authorization: "Bearer leaked",
          cookie: "session=leaked",
          "content-type": "application/json",
        },
      },
      msg: "ok",
    }) as { req: { headers: Record<string, string> } };
    expect(masked.req.headers["authorization"]).toBe(REDACTION_CENSOR);
    expect(masked.req.headers["cookie"]).toBe(REDACTION_CENSOR);
    expect(masked.req.headers["content-type"]).toBe("application/json");
  });

  it("masks top-level authorization / cookie fields too", () => {
    const masked = redactObject({
      authorization: "Bearer top-level",
      cookie: "top=level",
      other: 42,
    }) as Record<string, unknown>;
    expect(masked.authorization).toBe(REDACTION_CENSOR);
    expect(masked.cookie).toBe(REDACTION_CENSOR);
    expect(masked.other).toBe(42);
  });

  it("is a no-op on primitives", () => {
    expect(redactObject(null)).toBeNull();
    expect(redactObject("x")).toBe("x");
    expect(redactObject(42)).toBe(42);
  });
});

import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseOpenAPI,
  runParseOpenAPI,
  Swagger20DetectedError,
} from "../../packages/scripts/src/parse-openapi.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SWAGGER_20 = path.resolve(__dirname, "..", "fixtures", "malformed", "swagger-2.0.yaml");

describe("atw.api Swagger 2.0 fallback (T078 / FR-033)", () => {
  it("surfaces Swagger20DetectedError with a conversion hint", async () => {
    try {
      await parseOpenAPI({ source: SWAGGER_20 });
      expect.fail("expected Swagger 2.0 detection to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Swagger20DetectedError);
      const e = err as Swagger20DetectedError;
      expect(e.sourceVersion).toBe("2.0");
      expect(e.message).toMatch(/swagger2openapi|convert/i);
    }
  });

  it("CLI exits with code 3 (refusal), not a crash", async () => {
    const exit = await runParseOpenAPI(["--source", SWAGGER_20]);
    expect(exit).toBe(3);
  });
});

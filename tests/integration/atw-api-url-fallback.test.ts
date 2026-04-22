import { describe, it, expect } from "vitest";
import {
  parseOpenAPI,
  runParseOpenAPI,
  OpenAPIFetchError,
} from "../../packages/scripts/src/parse-openapi.js";

describe("atw.api URL-unreachable fallback (T079 / FR-033)", () => {
  it("raises OpenAPIFetchError programmatically", async () => {
    try {
      await parseOpenAPI({ source: "http://127.0.0.1:1/openapi.json" });
      expect.fail("expected fetch to fail");
    } catch (err) {
      expect(err).toBeInstanceOf(OpenAPIFetchError);
      expect((err as OpenAPIFetchError).url).toBe("http://127.0.0.1:1/openapi.json");
    }
  });

  it("CLI exits with code 2 and does not loop or retry indefinitely", async () => {
    const start = Date.now();
    const exit = await runParseOpenAPI(["--source", "http://127.0.0.1:1/openapi.json"]);
    const elapsed = Date.now() - start;
    expect(exit).toBe(2);
    // should fail fast — < 10s is generous even on slow Windows CI
    expect(elapsed).toBeLessThan(10_000);
  });
});

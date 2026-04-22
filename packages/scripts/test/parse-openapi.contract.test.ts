import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  parseOpenAPI,
  runParseOpenAPI,
  Swagger20DetectedError,
} from "../src/parse-openapi.js";
import { ParsedOpenAPISchema } from "../src/lib/types.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const AURELIA_OPENAPI = path.join(REPO_ROOT, "tests", "fixtures", "aurelia", "openapi.json");
const SWAGGER_20 = path.join(REPO_ROOT, "tests", "fixtures", "malformed", "swagger-2.0.yaml");

describe("parse-openapi contract (T075)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-openapi-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("emits a ParsedOpenAPI that validates against the zod contract", async () => {
    const { parsed } = await parseOpenAPI({ source: AURELIA_OPENAPI });
    const v = ParsedOpenAPISchema.safeParse(parsed);
    expect(v.success).toBe(true);
    expect(parsed.sourceVersion).toBe("3.1");
    expect(parsed.operations.length).toBeGreaterThan(10);
    // tags + servers propagate
    expect(parsed.tags.some((t) => t.name === "admin")).toBe(true);
    expect(parsed.servers.length).toBe(1);
  });

  it("detects Swagger 2.0 and refuses via exit code 3 (FR-033)", async () => {
    const exit = await runParseOpenAPI(["--source", SWAGGER_20]);
    expect(exit).toBe(3);
  });

  it("throws Swagger20DetectedError from the programmatic entry point", async () => {
    await expect(parseOpenAPI({ source: SWAGGER_20 })).rejects.toBeInstanceOf(Swagger20DetectedError);
  });

  it("returns exit 2 when the URL is unreachable and suggests a file fallback", async () => {
    // 127.0.0.1:1 is reserved and will refuse quickly on all platforms.
    const exit = await runParseOpenAPI(["--source", "http://127.0.0.1:1/openapi.json"]);
    expect(exit).toBe(2);
  });

  it("returns exit 3 on missing --source argument", async () => {
    const exit = await runParseOpenAPI([]);
    expect(exit).toBe(3);
  });

  it("writes a parsed JSON artifact to --out and exits 0", async () => {
    const out = path.join(tmp, "api.json");
    const exit = await runParseOpenAPI(["--source", AURELIA_OPENAPI, "--out", out]);
    expect(exit).toBe(0);
    const written = JSON.parse(await fs.readFile(out, "utf8"));
    expect(ParsedOpenAPISchema.safeParse(written).success).toBe(true);
  });

  it("returns exit 1 for file not found", async () => {
    const exit = await runParseOpenAPI(["--source", path.join(tmp, "nope.json")]);
    expect(exit).toBe(1);
  });
});

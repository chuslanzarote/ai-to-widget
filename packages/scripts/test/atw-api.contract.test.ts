/**
 * Contract tests for `/atw.api` — T016 (happy path) + T017 (rejection).
 * Enforces contracts/atw-api-command.md §3, §4, §8.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  runAtwApi,
  runAtwApiCli,
  canonicaliseOpenAPI,
} from "../src/atw-api.js";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const FIXTURES = path.join(__dirname, "fixtures", "openapi");
const SWAGGER_20_FIXTURE = path.join(
  REPO_ROOT,
  "tests",
  "fixtures",
  "malformed",
  "swagger-2.0.yaml",
);

function rel(p: string): string {
  return p.replace(/\\/g, "/");
}

describe("atw-api contract — happy path (T016)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-api-happy-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("ingests tiny.json → writes canonical .atw/artifacts/openapi.json + meta + ledger", async () => {
    const source = path.join(FIXTURES, "tiny.json");
    const result = await runAtwApi({ source, projectRoot: tmp });

    expect(result.action).toBe("created");
    expect(rel(result.path)).toBe(".atw/artifacts/openapi.json");
    expect(result.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);

    const artifact = await fs.readFile(
      path.join(tmp, ".atw/artifacts/openapi.json"),
      "utf8",
    );
    expect(artifact.endsWith("\n")).toBe(true);
    // Canonicalisation is idempotent.
    expect(canonicaliseOpenAPI(JSON.parse(artifact))).toBe(artifact);

    const meta = JSON.parse(
      await fs.readFile(path.join(tmp, ".atw/state/openapi-meta.json"), "utf8"),
    ) as { sha256: string; source: string; fetchedAt: string };
    expect(meta.sha256).toBe(result.sha256);
    expect(meta.source).toBe(source);
    expect(meta.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const ledger = JSON.parse(
      await fs.readFile(path.join(tmp, ".atw/state/input-hashes.json"), "utf8"),
    ) as { files: Record<string, string> };
    expect(ledger.files[".atw/artifacts/openapi.json"]).toBe(result.sha256);
  });

  it("CLI invocation exits 0 and prints status line on --source", async () => {
    const exit = await runCli([
      "--source",
      path.join(FIXTURES, "tiny.json"),
    ], tmp);
    expect(exit).toBe(0);
    // openapi.json exists under tmp.
    const stat = await fs.stat(path.join(tmp, ".atw/artifacts/openapi.json"));
    expect(stat.isFile()).toBe(true);
  });
});

describe("atw-api contract — rejection (T017)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-api-reject-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("Swagger 2.0 fixture exits 3 with a diagnostic naming the version", async () => {
    const exit = await runCli(["--source", SWAGGER_20_FIXTURE], tmp);
    expect(exit).toBe(3);
    // The openapi.json artefact must NOT have been written.
    await expect(
      fs.stat(path.join(tmp, ".atw/artifacts/openapi.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("duplicate operationId fixture exits 1 and diagnostic names both occurrences", async () => {
    const exit = await runCli(
      ["--source", path.join(FIXTURES, "duplicate-operation-id.json")],
      tmp,
    );
    expect(exit).toBe(1);
    await expect(
      fs.stat(path.join(tmp, ".atw/artifacts/openapi.json")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("duplicate operationId throws a named, structured error from programmatic entry", async () => {
    await expect(
      runAtwApi({
        source: path.join(FIXTURES, "duplicate-operation-id.json"),
        projectRoot: tmp,
      }),
    ).rejects.toMatchObject({
      code: "DUPLICATE_OPERATION_ID",
      message: expect.stringMatching(/duplicate operationId ".+" at .+ and .+/),
    });
  });

  it("unresolved external $ref fixture exits 1", async () => {
    const exit = await runCli(
      ["--source", path.join(FIXTURES, "external-ref.json")],
      tmp,
    );
    expect(exit).toBe(1);
  });

  it("URL fetch failure (connection refused on 127.0.0.1:1) exits 2", async () => {
    const exit = await runCli(
      ["--source", "http://127.0.0.1:1/openapi.json"],
      tmp,
    );
    expect(exit).toBe(2);
  });

  it("missing --source exits 3", async () => {
    const exit = await runCli([], tmp);
    expect(exit).toBe(3);
  });

  it("file not found exits 1", async () => {
    const exit = await runCli(
      ["--source", path.join(tmp, "definitely-missing.json")],
      tmp,
    );
    expect(exit).toBe(1);
  });
});

/** Run the CLI entry point with `tmp` as cwd (restored after). */
async function runCli(argv: string[], cwd: string): Promise<number> {
  const prevCwd = process.cwd();
  process.chdir(cwd);
  try {
    return await runAtwApiCli(argv);
  } finally {
    process.chdir(prevCwd);
  }
}

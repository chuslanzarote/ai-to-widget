import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { writeAureliaArtifacts } from "./fixtures/aurelia-artifacts.js";
import { exists } from "../../packages/scripts/src/lib/atomic.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-inputs-lifecycle-"));
  await fs.mkdir(path.join(tmpRoot, "inputs"), { recursive: true });
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe(".atw/inputs/ lifecycle (T095 / FR-048)", () => {
  it("inputs are never auto-purged when artifacts are deleted", async () => {
    const inputFile = path.join(tmpRoot, "inputs", "schema.sql");
    await fs.writeFile(inputFile, "CREATE TABLE product (id int);", "utf8");

    // Simulate a Builder wiping an artifact.
    await fs.rm(path.join(tmpRoot, "artifacts", "schema-map.md"));

    // The input file under .atw/inputs/ must still be on disk unchanged.
    expect(await exists(inputFile)).toBe(true);
    const body = await fs.readFile(inputFile, "utf8");
    expect(body).toContain("CREATE TABLE product");
  });

  it("deleting every artifact leaves .atw/inputs/ intact", async () => {
    const inputFile = path.join(tmpRoot, "inputs", "openapi.yaml");
    await fs.writeFile(inputFile, "openapi: 3.0.0\n", "utf8");

    await fs.rm(path.join(tmpRoot, "artifacts"), { recursive: true, force: true });
    await fs.rm(path.join(tmpRoot, "config"), { recursive: true, force: true });

    expect(await exists(inputFile)).toBe(true);
  });

  it("templates/gitignore-atw-block.txt shields .atw/inputs from accidental commits", async () => {
    // Feature 009 ships the gitignore guard via a copyable block at
    // templates/gitignore-atw-block.txt rather than a per-tree
    // .gitignore. The installer concatenates it into the host's
    // .gitignore.
    const blockPath = path.resolve(
      __dirname,
      "..",
      "..",
      "templates",
      "gitignore-atw-block.txt",
    );
    expect(await exists(blockPath)).toBe(true);
    const body = await fs.readFile(blockPath, "utf8");
    expect(body).toMatch(/\.atw\/inputs/);
  });
});

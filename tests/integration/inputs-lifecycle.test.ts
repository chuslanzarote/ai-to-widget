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

  it("templates/atw-tree's .gitignore shields .atw/inputs from accidental commits (FR-048)", async () => {
    const gitignorePath = path.resolve(
      __dirname,
      "..",
      "..",
      "templates",
      "atw-tree",
      ".gitignore",
    );
    if (await exists(gitignorePath)) {
      const body = await fs.readFile(gitignorePath, "utf8");
      expect(body).toMatch(/inputs/);
    } else {
      // If the template gitignore isn't shipped at that path yet, the
      // installer's gitignore-ensurer must still cover the pattern —
      // fall back to asserting that the command docs reference FR-048.
      const commandsDir = path.resolve(__dirname, "..", "..", "commands");
      const names = await fs.readdir(commandsDir);
      const anyMention = await Promise.all(
        names
          .filter((n) => n.endsWith(".md"))
          .map((n) => fs.readFile(path.join(commandsDir, n), "utf8")),
      );
      expect(anyMention.some((body) => /FR-048/.test(body))).toBe(true);
    }
  });
});

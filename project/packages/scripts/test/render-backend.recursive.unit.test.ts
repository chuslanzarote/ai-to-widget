/**
 * T006 / US1 — unit test for recursive walk in render-backend.
 *
 * Contract (contracts/render-backend-recursive.md §Ordering guarantee):
 *   - Templates under subdirectories are rendered, not ignored.
 *   - Emission order: top-level files first (byte-sorted), then subdirs
 *     (byte-sorted), recursively.
 *   - Output paths use `/` separators on all platforms.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderBackend } from "../src/render-backend.js";

describe("render-backend recursive walk (T006 / US1)", () => {
  let tmp: string;
  const ctx = {
    projectName: "demo",
    embeddingModel: "Xenova/bge-small-multilingual-v1.5",
    anthropicModel: "claude-opus-4-7",
    generatedAt: "2026-04-22T00:00:00Z",
    defaultLocale: "en",
    briefSummary: "",
  };

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-render-recursive-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("walks subdirectories and emits sources sorted files-then-dirs at each level", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");

    // Fixture tree:
    //   tpl/
    //     index.ts.hbs
    //     config.ts.hbs
    //     lib/
    //       cors.ts.hbs
    //       logger.ts.hbs
    //     routes/
    //       chat.ts.hbs
    await fs.mkdir(path.join(templatesDir, "lib"), { recursive: true });
    await fs.mkdir(path.join(templatesDir, "routes"), { recursive: true });
    await fs.writeFile(path.join(templatesDir, "index.ts.hbs"), "// i {{projectName}}\n");
    await fs.writeFile(path.join(templatesDir, "config.ts.hbs"), "// c {{projectName}}\n");
    await fs.writeFile(path.join(templatesDir, "lib", "cors.ts.hbs"), "// lc {{projectName}}\n");
    await fs.writeFile(path.join(templatesDir, "lib", "logger.ts.hbs"), "// ll\n");
    await fs.writeFile(path.join(templatesDir, "routes", "chat.ts.hbs"), "// rc\n");

    const results = await renderBackend({ templatesDir, outputDir, context: ctx });

    const paths = results.map((r) => r.path);
    // Expect top-level files first (byte-sorted: config < index), then
    // subdirs byte-sorted (lib < routes), with each subdir's files sorted.
    // `path` is relative to parent(outputDir), i.e. starts with "out/".
    expect(paths).toEqual([
      "out/config.ts",
      "out/index.ts",
      "out/lib/cors.ts",
      "out/lib/logger.ts",
      "out/routes/chat.ts",
    ]);
  });

  it("emits `/` separators on all platforms", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(path.join(templatesDir, "sub", "deeper"), { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, "sub", "deeper", "x.ts.hbs"),
      "// x\n",
    );
    const results = await renderBackend({ templatesDir, outputDir, context: ctx });
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("out/sub/deeper/x.ts");
    expect(results[0].path.includes("\\")).toBe(false);
  });

  it("creates target parent directories before writing", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(path.join(templatesDir, "routes"), { recursive: true });
    await fs.writeFile(path.join(templatesDir, "routes", "health.ts.hbs"), "// h\n");
    const results = await renderBackend({ templatesDir, outputDir, context: ctx });
    expect(results[0].action).toBe("created");
    const written = await fs.readFile(path.join(outputDir, "routes", "health.ts"), "utf8");
    expect(written).toBe("// h\n");
  });
});

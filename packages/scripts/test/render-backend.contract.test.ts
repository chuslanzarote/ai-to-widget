import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderBackend, runRenderBackend } from "../src/render-backend.js";

describe("atw-render-backend contract (T046)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-render-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("CLI exit 0 on --help", async () => {
    const code = await runRenderBackend(["--help"]);
    expect(code).toBe(0);
  });

  it("CLI exit 0 on --version", async () => {
    const code = await runRenderBackend(["--version"]);
    expect(code).toBe(0);
  });

  it("library: creates output file with sha256 + bytes + action on first run", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, "index.ts.hbs"),
      "export const project = {{json projectName}};\n",
    );
    // register no helper — use a simpler template
    await fs.writeFile(
      path.join(templatesDir, "index.ts.hbs"),
      "export const project = '{{projectName}}';\n",
    );
    const results = await renderBackend({
      templatesDir,
      outputDir,
      context: {
        projectName: "demo",
        embeddingModel: "Xenova/bge-small-multilingual-v1.5",
        anthropicModel: "claude-opus-4-7",
        generatedAt: "2026-04-22T00:00:00Z",
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0].action).toBe("created");
    expect(results[0].sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(results[0].bytes).toBeGreaterThan(0);
    const written = await fs.readFile(path.join(outputDir, "index.ts"), "utf8");
    expect(written).toBe("export const project = 'demo';\n");
  });

  it("library: second run on unchanged template is idempotent (unchanged)", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, "x.ts.hbs"),
      "// {{projectName}}\n",
    );
    const opts = {
      templatesDir,
      outputDir,
      context: {
        projectName: "demo",
        embeddingModel: "x",
        anthropicModel: "y",
        generatedAt: "z",
      },
    };
    const first = await renderBackend(opts);
    const second = await renderBackend(opts);
    expect(first[0].action).toBe("created");
    expect(second[0].action).toBe("unchanged");
    expect(second[0].sha256).toBe(first[0].sha256);
  });
});

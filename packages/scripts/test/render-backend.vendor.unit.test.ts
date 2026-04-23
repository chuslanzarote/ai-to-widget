/**
 * T007 / US1 — unit test for import-rewriting in render-backend.
 *
 * Contract (contracts/render-backend-recursive.md §Behaviour change 2):
 *   - `@atw/scripts/dist/lib/<name>.js` specifiers in templates are
 *     rewritten to `./_shared/<name>.js` at depth 0 and `../_shared/<name>.js`
 *     at depth 1 (file lives one level under backend/src).
 *   - A non-allowlisted name raises `VENDOR_IMPORT_UNRESOLVED`.
 *   - Post-render output contains no `@atw/scripts` specifiers.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { renderBackend } from "../src/render-backend.js";

describe("render-backend vendor import rewrite (T007 / US1)", () => {
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
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-render-vendor-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("rewrites depth-0 imports to ./_shared/ and depth-1 to ../_shared/", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(path.join(templatesDir, "lib"), { recursive: true });
    await fs.mkdir(path.join(templatesDir, "routes"), { recursive: true });
    // Top-level file (depth 0) importing a helper
    await fs.writeFile(
      path.join(templatesDir, "index.ts.hbs"),
      [
        `import { buildLogger } from "@atw/scripts/dist/lib/runtime-logger.js";`,
        `import { Types } from "@atw/scripts/dist/lib/types.js";`,
        `// {{projectName}}`,
        "",
      ].join("\n"),
    );
    // Depth-1 files (inside lib/ and routes/)
    await fs.writeFile(
      path.join(templatesDir, "lib", "cors.ts.hbs"),
      [
        `import { scrub } from "@atw/scripts/dist/lib/runtime-pii-scrub.js";`,
        "",
      ].join("\n"),
    );
    await fs.writeFile(
      path.join(templatesDir, "routes", "chat.ts.hbs"),
      [
        `import { strip } from "@atw/scripts/dist/lib/runtime-credential-strip.js";`,
        "",
      ].join("\n"),
    );

    await renderBackend({ templatesDir, outputDir, context: ctx });

    const idx = await fs.readFile(path.join(outputDir, "index.ts"), "utf8");
    expect(idx).toContain(`from "./_shared/runtime-logger.js"`);
    expect(idx).toContain(`from "./_shared/types.js"`);

    const cors = await fs.readFile(path.join(outputDir, "lib", "cors.ts"), "utf8");
    expect(cors).toContain(`from "../_shared/runtime-pii-scrub.js"`);

    const chat = await fs.readFile(path.join(outputDir, "routes", "chat.ts"), "utf8");
    expect(chat).toContain(`from "../_shared/runtime-credential-strip.js"`);

    // Post-render: no `@atw/scripts` specifier remains anywhere.
    for (const rel of ["index.ts", "lib/cors.ts", "routes/chat.ts"]) {
      const txt = await fs.readFile(path.join(outputDir, rel), "utf8");
      expect(txt.includes("@atw/scripts")).toBe(false);
    }
  });

  it("throws VENDOR_IMPORT_UNRESOLVED for non-allowlisted names", async () => {
    const templatesDir = path.join(tmp, "tpl");
    const outputDir = path.join(tmp, "out");
    await fs.mkdir(templatesDir, { recursive: true });
    await fs.writeFile(
      path.join(templatesDir, "a.ts.hbs"),
      `import x from "@atw/scripts/dist/lib/not-in-allowlist.js";\n`,
    );
    await expect(
      renderBackend({ templatesDir, outputDir, context: ctx }),
    ).rejects.toMatchObject({ code: "VENDOR_IMPORT_UNRESOLVED" });
  });
});

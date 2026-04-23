/**
 * T021 / US2 — loud-failure taxonomy contract test.
 *
 * Contract (contracts/orchestrator-cli.md §IMAGE-step failure taxonomy,
 * §Exit codes):
 *   - TEMPLATE_COMPILE  → exit 17, step "render"
 *   - VENDOR_IMPORT_UNRESOLVED → exit 17, step "render"
 *   - DOCKER_UNREACHABLE → exit 3, step "image"
 *   - DOCKER_BUILD → exit 19, step "image"
 *   - SECRET_IN_CONTEXT → exit 20, step "image"
 *
 * This test exercises the exit-code map directly (the helper that
 * orchestrator.ts consults) plus the end-to-end render-backend path for
 * TEMPLATE_COMPILE / VENDOR_IMPORT_UNRESOLVED — both of which CAN fire
 * without a running Docker daemon. The Docker-daemon-reachability arm
 * lives in the integration test at `tests/integration/build-docker-down.test.ts`
 * which is the corresponding DOCKER_UNREACHABLE coverage already in the
 * suite.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  EXIT_GENERIC,
  EXIT_ENV,
  EXIT_TEMPLATE_COMPILE,
  EXIT_DOCKER_BUILD,
  EXIT_SECRET_IN_CONTEXT,
  exitCodeForErrorCode,
} from "../src/lib/exit-codes.js";
import { renderBackend } from "../src/render-backend.js";

describe("loud failure taxonomy (T021 / US2)", () => {
  describe("exit-code map (contracts/orchestrator-cli.md §Exit codes)", () => {
    it("maps TEMPLATE_COMPILE → 17", () => {
      expect(exitCodeForErrorCode("TEMPLATE_COMPILE")).toBe(EXIT_TEMPLATE_COMPILE);
    });
    it("maps VENDOR_IMPORT_UNRESOLVED → 17", () => {
      expect(exitCodeForErrorCode("VENDOR_IMPORT_UNRESOLVED")).toBe(
        EXIT_TEMPLATE_COMPILE,
      );
    });
    it("maps DOCKER_UNREACHABLE → 3", () => {
      expect(exitCodeForErrorCode("DOCKER_UNREACHABLE")).toBe(EXIT_ENV);
    });
    it("maps DOCKER_BUILD → 19", () => {
      expect(exitCodeForErrorCode("DOCKER_BUILD")).toBe(EXIT_DOCKER_BUILD);
    });
    it("maps SECRET_IN_CONTEXT → 20", () => {
      expect(exitCodeForErrorCode("SECRET_IN_CONTEXT")).toBe(
        EXIT_SECRET_IN_CONTEXT,
      );
    });
    it("maps unknown codes → 1 (generic)", () => {
      expect(exitCodeForErrorCode(undefined)).toBe(EXIT_GENERIC);
      expect(exitCodeForErrorCode("NOT_A_REAL_CODE")).toBe(EXIT_GENERIC);
    });
  });

  describe("render-backend failure arms", () => {
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
      tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-loud-fail-"));
    });
    afterEach(async () => {
      await fs.rm(tmp, { recursive: true, force: true });
    });

    it("throws TEMPLATE_COMPILE for a broken Handlebars expression", async () => {
      const templatesDir = path.join(tmp, "tpl");
      const outputDir = path.join(tmp, "out");
      await fs.mkdir(templatesDir, { recursive: true });
      // Unclosed helper block → Handlebars.compile throws.
      await fs.writeFile(
        path.join(templatesDir, "x.ts.hbs"),
        "{{#if projectName}}broken",
      );
      await expect(
        renderBackend({ templatesDir, outputDir, context: ctx }),
      ).rejects.toMatchObject({ code: "TEMPLATE_COMPILE" });
    });

    it("throws VENDOR_IMPORT_UNRESOLVED for a non-allowlisted vendor import", async () => {
      const templatesDir = path.join(tmp, "tpl");
      const outputDir = path.join(tmp, "out");
      await fs.mkdir(templatesDir, { recursive: true });
      await fs.writeFile(
        path.join(templatesDir, "a.ts.hbs"),
        `import x from "@atw/scripts/dist/lib/not-a-real-helper.js";\n`,
      );
      await expect(
        renderBackend({ templatesDir, outputDir, context: ctx }),
      ).rejects.toMatchObject({ code: "VENDOR_IMPORT_UNRESOLVED" });
    });
  });
});

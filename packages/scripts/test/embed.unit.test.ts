import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import os from "node:os";
import {
  parseAnswersMarkdown,
  formatAnswersMarkdown,
  renderEmbedGuide,
  SUPPORTED_FRAMEWORKS,
  type EmbedAnswers,
} from "../src/embed.js";

/**
 * T098 — embed.unit.test
 */
describe("embed-answers parser (T098)", () => {
  it("parses required fields", () => {
    const source = [
      "---",
      "framework: next-app-router",
      "backend_url: https://atw.example.com",
      "auth_mode: cookie",
      "---",
      "",
      "# ok",
    ].join("\n");
    const a = parseAnswersMarkdown(source);
    expect(a.framework).toBe("next-app-router");
    expect(a.backendUrl).toBe("https://atw.example.com");
    expect(a.authMode).toBe("cookie");
  });

  it("rejects an invalid framework", () => {
    const source = ["---", "framework: angular", "backend_url: https://x", "auth_mode: cookie", "---"].join("\n");
    expect(() => parseAnswersMarkdown(source)).toThrow(/framework/);
  });

  it("rejects a missing backend_url", () => {
    const source = ["---", "framework: plain-html", "auth_mode: cookie", "---"].join("\n");
    expect(() => parseAnswersMarkdown(source)).toThrow(/backend_url/);
  });

  it("rejects a non-http backend_url", () => {
    const source = [
      "---",
      "framework: plain-html",
      "backend_url: ftp://x",
      "auth_mode: cookie",
      "---",
    ].join("\n");
    expect(() => parseAnswersMarkdown(source)).toThrow(/absolute http/);
  });

  it("requires auth_token_key when auth_mode=bearer", () => {
    const source = [
      "---",
      "framework: plain-html",
      "backend_url: https://x",
      "auth_mode: bearer",
      "---",
    ].join("\n");
    expect(() => parseAnswersMarkdown(source)).toThrow(/auth_token_key/);
  });

  it("parses theme block", () => {
    const source = [
      "---",
      "framework: next-app-router",
      "backend_url: https://x",
      "auth_mode: cookie",
      "theme:",
      '  primary: "#8B4513"',
      '  radius: "4px"',
      '  font: "Aurelia Sans"',
      "---",
    ].join("\n");
    const a = parseAnswersMarkdown(source);
    expect(a.themePrimary).toBe("#8B4513");
    expect(a.themeRadius).toBe("4px");
    expect(a.themeFont).toBe("Aurelia Sans");
  });

  it("formatAnswersMarkdown round-trips", () => {
    const ans: EmbedAnswers = {
      framework: "plain-html",
      backendUrl: "https://x.example.com",
      authMode: "bearer",
      authTokenKey: "site.token",
    };
    const md = formatAnswersMarkdown(ans, "2026-04-22T10:00:00Z");
    const parsed = parseAnswersMarkdown(md);
    expect(parsed).toMatchObject(ans);
  });
});

describe("renderEmbedGuide (T098 / FR-032 determinism)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-embed-"));
    // Seed preconditions: dist/widget.{js,css}, build-manifest.json,
    // action-manifest.md.
    await fs.mkdir(path.join(tmp, "dist"), { recursive: true });
    await fs.writeFile(path.join(tmp, "dist", "widget.js"), "/*w*/");
    await fs.writeFile(path.join(tmp, "dist", "widget.css"), "/*c*/");
    await fs.mkdir(path.join(tmp, ".atw", "state"), { recursive: true });
    await fs.mkdir(path.join(tmp, ".atw", "artifacts"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".atw", "state", "build-manifest.json"),
      JSON.stringify({ result: "success" }),
    );
    await fs.writeFile(path.join(tmp, ".atw", "artifacts", "action-manifest.md"), "# AM\n");
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("produces byte-identical output for the same answers", async () => {
    const answers: EmbedAnswers = {
      framework: "next-app-router",
      backendUrl: "https://atw.example.com",
      authMode: "cookie",
      apiBaseUrl: "https://shop.example.com",
      locale: "es-ES",
    };
    const a = await renderEmbedGuide({
      projectRoot: tmp,
      answers,
      frozenTime: "2026-04-22T10:00:00.000Z",
    });
    const b = await renderEmbedGuide({
      projectRoot: tmp,
      answers,
      frozenTime: "2026-04-22T10:00:00.000Z",
    });
    expect(a.sha256).toBe(b.sha256);
    // Extra assertion: inspect the rendered content on disk.
    const rendered = await fs.readFile(
      path.join(tmp, ".atw", "artifacts", "embed-guide.md"),
      "utf8",
    );
    expect(rendered).toMatch(/Embed Guide — Next\.js App Router/);
    expect(rendered).toMatch(/https:\/\/atw\.example\.com/);
    expect(rendered).toMatch(/es-ES/);
    expect(createHash("sha256").update(rendered).digest("hex")).toBe(a.sha256);
  });

  it("produces a material diff when the framework answer changes", async () => {
    const base: EmbedAnswers = {
      framework: "plain-html",
      backendUrl: "https://atw.example.com",
      authMode: "cookie",
    };
    const a = await renderEmbedGuide({
      projectRoot: tmp,
      answers: base,
      frozenTime: "2026-04-22T10:00:00.000Z",
    });
    const b = await renderEmbedGuide({
      projectRoot: tmp,
      answers: { ...base, framework: "custom" },
      frozenTime: "2026-04-22T10:00:00.000Z",
    });
    expect(a.sha256).not.toBe(b.sha256);
  });

  it("halts with PRECONDITIONS_MISSING when widget.js is absent", async () => {
    await fs.rm(path.join(tmp, "dist", "widget.js"));
    await expect(
      renderEmbedGuide({
        projectRoot: tmp,
        answers: {
          framework: "next-app-router",
          backendUrl: "https://x",
          authMode: "cookie",
        },
        frozenTime: "2026-04-22T10:00:00Z",
      }),
    ).rejects.toMatchObject({ code: "PRECONDITIONS_MISSING" });
  });

  it("all four frameworks render without throwing", async () => {
    for (const framework of SUPPORTED_FRAMEWORKS) {
      const res = await renderEmbedGuide({
        projectRoot: tmp,
        answers: {
          framework,
          backendUrl: "https://x.example.com",
          authMode: "cookie",
        },
        frozenTime: "2026-04-22T10:00:00Z",
      });
      expect(res.bytesWritten).toBeGreaterThan(100);
    }
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runEmbedCli } from "../src/embed.js";

/**
 * T099 — CLI surface contract for /atw.embed.
 * Exit code vocabulary: specs/003-runtime/contracts/embed-command.md §4.
 */
describe("atw-embed CLI (T099)", () => {
  let tmp: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-embed-cli-"));
  });
  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("exit 0 on --help", async () => {
    expect(await runEmbedCli(["--help"])).toBe(0);
  });

  it("exit 0 on --version", async () => {
    expect(await runEmbedCli(["--version"])).toBe(0);
  });

  it("exit 3 when preconditions are missing", async () => {
    const code = await runEmbedCli(["--project-root", tmp]);
    expect(code).toBe(3);
  });

  async function seed(): Promise<void> {
    await fs.mkdir(path.join(tmp, "dist"), { recursive: true });
    await fs.writeFile(path.join(tmp, "dist", "widget.js"), "/*w*/");
    await fs.writeFile(path.join(tmp, "dist", "widget.css"), "/*c*/");
    await fs.mkdir(path.join(tmp, ".atw", "state"), { recursive: true });
    await fs.mkdir(path.join(tmp, ".atw", "artifacts"), { recursive: true });
    await fs.writeFile(
      path.join(tmp, ".atw", "state", "build-manifest.json"),
      JSON.stringify({ result: "success" }),
    );
    await fs.writeFile(
      path.join(tmp, ".atw", "artifacts", "action-manifest.md"),
      "# AM\n",
    );
  }

  it("exit 4 when answers-file is missing (non-interactive)", async () => {
    await seed();
    const code = await runEmbedCli(["--project-root", tmp]);
    expect(code).toBe(4);
  });

  it("exit 4 on malformed answers file", async () => {
    await seed();
    const answersPath = path.join(tmp, "answers.md");
    await fs.writeFile(answersPath, "no front matter here");
    const code = await runEmbedCli([
      "--project-root",
      tmp,
      "--answers-file",
      answersPath,
    ]);
    expect(code).toBe(4);
  });

  it("exit 0 with a valid answers file", async () => {
    await seed();
    const answersPath = path.join(tmp, "answers.md");
    await fs.writeFile(
      answersPath,
      [
        "---",
        "framework: plain-html",
        "backend_url: https://atw.example.com",
        "auth_mode: cookie",
        "---",
      ].join("\n"),
    );
    const code = await runEmbedCli([
      "--project-root",
      tmp,
      "--answers-file",
      answersPath,
      "--frozen-time",
      "2026-04-22T10:00:00Z",
    ]);
    expect(code).toBe(0);
    const guide = await fs.readFile(
      path.join(tmp, ".atw", "artifacts", "embed-guide.md"),
      "utf8",
    );
    expect(guide).toMatch(/Embed Guide — Plain HTML/);
  });
});

/**
 * T008 / US1 — unit test for seed-backend-meta.
 *
 * Contract (data-model.md Entity 3, contracts/build-manifest-extensions.md):
 *   - Copies Dockerfile, .dockerignore, package.json, tsconfig.json from a
 *     source backendPackageDir into `<projectRoot>/backend/`.
 *   - tsconfig.json with an `extends` pointing at a missing base path is
 *     inlined so the shipped config is standalone.
 *   - Diff pipeline: created / unchanged / rewritten, optional .bak.
 *   - Return records have path `backend/<name>` + sha256/bytes/action.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { seedBackendMeta } from "../src/seed-backend-meta.js";

async function sha256(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

describe("seed-backend-meta (T008 / US1)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-seed-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function makeSrc(files: Record<string, string>): Promise<string> {
    const srcDir = path.join(tmp, "src-backend");
    await fs.mkdir(srcDir, { recursive: true });
    for (const [k, v] of Object.entries(files)) {
      await fs.writeFile(path.join(srcDir, k), v);
    }
    return srcDir;
  }

  it("copies meta files byte-identically on first run (action created)", async () => {
    const srcDir = await makeSrc({
      Dockerfile: "FROM node:20\nCOPY . .\n",
      ".dockerignore": "node_modules\n",
      "package.json": JSON.stringify({ name: "x" }, null, 2),
      "tsconfig.json": JSON.stringify({ compilerOptions: { strict: true } }, null, 2),
    });
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    const results = await seedBackendMeta({ projectRoot, backendPackageDir: srcDir });
    expect(results.map((r) => r.path).sort()).toEqual([
      "backend/.dockerignore",
      "backend/Dockerfile",
      "backend/package.json",
      "backend/tsconfig.json",
    ]);
    for (const r of results) expect(r.action).toBe("created");

    // Byte-identical (modulo \r\n → \n normalisation; our inputs are LF).
    const dfSrc = await sha256(path.join(srcDir, "Dockerfile"));
    const dfDst = await sha256(path.join(projectRoot, "backend", "Dockerfile"));
    expect(dfDst).toBe(dfSrc);
  });

  it("tags unchanged on byte-identical second run", async () => {
    const srcDir = await makeSrc({
      Dockerfile: "FROM node:20\n",
      ".dockerignore": "node_modules\n",
      "package.json": "{}",
      "tsconfig.json": "{}",
    });
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    await seedBackendMeta({ projectRoot, backendPackageDir: srcDir });
    const second = await seedBackendMeta({ projectRoot, backendPackageDir: srcDir });
    for (const r of second) expect(r.action).toBe("unchanged");
    for (const r of second) expect(r.backup).toBeUndefined();
  });

  it("writes .bak on rewrite when backup=true", async () => {
    const srcDir = await makeSrc({
      Dockerfile: "FROM node:20\n",
      ".dockerignore": "node_modules\n",
      "package.json": "{}",
      "tsconfig.json": "{}",
    });
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(path.join(projectRoot, "backend"), { recursive: true });
    await fs.writeFile(path.join(projectRoot, "backend", "Dockerfile"), "FROM node:18\n");
    const results = await seedBackendMeta({
      projectRoot,
      backendPackageDir: srcDir,
      backup: true,
    });
    const df = results.find((r) => r.path === "backend/Dockerfile")!;
    expect(df.action).toBe("rewritten");
    expect(df.backup).toBeDefined();
    const bak = await fs.readFile(
      path.join(projectRoot, "backend", "Dockerfile.bak"),
      "utf8",
    );
    expect(bak).toBe("FROM node:18\n");
    const cur = await fs.readFile(
      path.join(projectRoot, "backend", "Dockerfile"),
      "utf8",
    );
    expect(cur).toBe("FROM node:20\n");
  });

  it("inlines a tsconfig.json that extends a missing base", async () => {
    // tsconfig extends ../../tsconfig.base.json which only exists in the src
    // backend package's repo root. When seeding into a throwaway project, the
    // base won't exist, so seed-backend-meta inlines the compilerOptions.
    const repoRoot = path.join(tmp, "repo");
    await fs.mkdir(repoRoot, { recursive: true });
    await fs.writeFile(
      path.join(repoRoot, "tsconfig.base.json"),
      JSON.stringify({ compilerOptions: { target: "es2022", strict: true } }),
    );
    const srcDir = path.join(repoRoot, "packages", "backend");
    await fs.mkdir(srcDir, { recursive: true });
    await fs.writeFile(path.join(srcDir, "Dockerfile"), "FROM node:20\n");
    await fs.writeFile(path.join(srcDir, ".dockerignore"), "node_modules\n");
    await fs.writeFile(path.join(srcDir, "package.json"), "{}");
    await fs.writeFile(
      path.join(srcDir, "tsconfig.json"),
      JSON.stringify({
        extends: "../../tsconfig.base.json",
        compilerOptions: { outDir: "dist" },
        include: ["src/**/*.ts"],
      }),
    );
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    await seedBackendMeta({ projectRoot, backendPackageDir: srcDir });
    const emitted = JSON.parse(
      await fs.readFile(path.join(projectRoot, "backend", "tsconfig.json"), "utf8"),
    );
    expect(emitted.extends).toBeUndefined();
    expect(emitted.compilerOptions.target).toBe("es2022");
    expect(emitted.compilerOptions.strict).toBe(true);
    expect(emitted.compilerOptions.outDir).toBe("dist");
    expect(emitted.include).toEqual(["src/**/*.ts"]);
  });
});

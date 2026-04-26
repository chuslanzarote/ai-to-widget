import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runBuildBackendImage } from "../src/build-backend-image.js";

describe("atw-build-backend-image contract (T048)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("exit 0 on --help", async () => {
    const code = await runBuildBackendImage(["--help"]);
    expect(code).toBe(0);
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    expect(out).toContain("--tag");
  });

  it("exit 0 on --version", async () => {
    const code = await runBuildBackendImage(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 on unknown flag", async () => {
    const code = await runBuildBackendImage(["--bogus"]);
    expect(code).toBe(3);
  });
});

/**
 * T026 / US2 — SECRET_IN_CONTEXT guard fires before dockerode runs.
 *
 * Contract (contracts/orchestrator-cli.md §IMAGE-step failure taxonomy):
 *   A `.env` (or `*.pem`, `id_rsa`, etc.) in the build context → exit 20
 *   with a "secret-shaped files" diagnostic. The guard runs BEFORE
 *   `docker.ping()`, so the check is reachable without a live daemon.
 */
describe("atw-build-backend-image SECRET_IN_CONTEXT guard (T026 / US2)", () => {
  let tmp: string;
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-image-secret-"));
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("exits 20 when a .env sits in the build context", async () => {
    await fs.writeFile(path.join(tmp, "Dockerfile"), "FROM node:20\n");
    await fs.writeFile(path.join(tmp, ".env"), "SECRET=nope\n");
    const code = await runBuildBackendImage([
      "--context-dir",
      tmp,
      "--tag",
      "atw_test_nope:latest",
    ]);
    expect(code).toBe(20);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toMatch(/secret-shaped/);
    expect(err).toMatch(/\.env/);
  });

  it("exits 20 when a .pem sits in the build context", async () => {
    await fs.writeFile(path.join(tmp, "Dockerfile"), "FROM node:20\n");
    await fs.mkdir(path.join(tmp, "certs"));
    await fs.writeFile(path.join(tmp, "certs", "server.pem"), "-----BEGIN\n");
    const code = await runBuildBackendImage([
      "--context-dir",
      tmp,
      "--tag",
      "atw_test_nope:latest",
    ]);
    expect(code).toBe(20);
  });
});

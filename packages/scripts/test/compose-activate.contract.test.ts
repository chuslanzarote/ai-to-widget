import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  composeActivate,
  runComposeActivate,
  BEGIN_MARK,
  END_MARK,
} from "../src/compose-activate.js";

const COMMENTED_BLOCK = `services:
  # ----- atw:begin -----
  # atw-postgres:
  #   image: pgvector/pgvector:pg16
  # atw-backend:
  #   image: atw_backend:latest
  # ----- atw:end -----
`;

describe("atw-compose-activate contract (T049)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let tmp: string;

  beforeEach(async () => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-compose-"));
  });

  afterEach(async () => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("CLI exit 0 on --help", async () => {
    const code = await runComposeActivate(["--help"]);
    expect(code).toBe(0);
  });

  it("CLI exit 0 on --version", async () => {
    const code = await runComposeActivate(["--version"]);
    expect(code).toBe(0);
  });

  it("CLI exit 21 when compose file is missing", async () => {
    const missing = path.join(tmp, "nope.yml");
    const code = await runComposeActivate(["--compose-file", missing]);
    expect(code).toBe(21);
  });

  it("library: uncomments block on first run, no-op on second", async () => {
    const file = path.join(tmp, "docker-compose.yml");
    await fs.writeFile(file, COMMENTED_BLOCK, "utf8");
    const first = await composeActivate(file);
    expect(first.action).toBe("activated");
    expect(first.services).toEqual(expect.arrayContaining(["atw-postgres", "atw-backend"]));
    const second = await composeActivate(file);
    expect(second.action).toBe("unchanged");
    const after = await fs.readFile(file, "utf8");
    expect(after).toContain(BEGIN_MARK);
    expect(after).toContain(END_MARK);
    expect(after).toContain("atw-postgres:");
    expect(after).toContain("atw-backend:");
  });

  it("library: throws COMPOSE_NOT_FOUND on missing file", async () => {
    await expect(composeActivate(path.join(tmp, "missing.yml"))).rejects.toMatchObject({
      code: "COMPOSE_NOT_FOUND",
    });
  });

  it("library: returns no-markers (FR-029, Q3) when markers missing and integrator declines", async () => {
    const bad = path.join(tmp, "bad.yml");
    await fs.writeFile(bad, "services:\n  foo:\n    image: bar\n", "utf8");
    // No `confirmAppend` supplied → declines by default (FR-029).
    const result = await composeActivate(bad);
    expect(result.action).toBe("no-markers");
    expect(result.skipped_reason).toMatch(/markers/);
    expect(result.proposed_diff).toContain(BEGIN_MARK);
    expect(result.proposed_diff).toContain(END_MARK);
    // The host file MUST be left untouched until the integrator says yes.
    const after = await fs.readFile(bad, "utf8");
    expect(after).toBe("services:\n  foo:\n    image: bar\n");
  });

  it("library: appends marker block when integrator confirms [y/N]", async () => {
    const bad = path.join(tmp, "bad.yml");
    await fs.writeFile(bad, "services:\n  foo:\n    image: bar\n", "utf8");
    const result = await composeActivate(bad, {
      confirmAppend: async () => true,
    });
    expect(result.action).toBe("activated");
    const after = await fs.readFile(bad, "utf8");
    expect(after).toContain(BEGIN_MARK);
    expect(after).toContain(END_MARK);
  });
});

/**
 * Contract test — /atw.api determinism (T018).
 *
 * Enforces contracts/atw-api-command.md §6 (Determinism contract):
 *   - Same `--source` bytes → same `openapi.json` bytes.
 *   - Re-run on identical source → action `unchanged`, no disk write.
 *   - Re-run with different source → action `rewritten`; prior file
 *     backed up when `--backup` is passed.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { runAtwApi } from "../src/atw-api.js";

const FIXTURES = path.join(__dirname, "fixtures", "openapi");

describe("atw-api determinism (T018)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-api-det-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("re-run with identical source returns action: unchanged and preserves bytes + mtime", async () => {
    const source = path.join(FIXTURES, "tiny.json");
    const first = await runAtwApi({ source, projectRoot: tmp });
    expect(first.action).toBe("created");

    const artifactPath = path.join(tmp, first.path);
    const firstBytes = await fs.readFile(artifactPath, "utf8");
    const firstMtime = (await fs.stat(artifactPath)).mtimeMs;

    // Re-run.
    const second = await runAtwApi({ source, projectRoot: tmp });
    expect(second.action).toBe("unchanged");
    expect(second.sha256).toBe(first.sha256);

    const secondBytes = await fs.readFile(artifactPath, "utf8");
    expect(secondBytes).toBe(firstBytes);
    const secondMtime = (await fs.stat(artifactPath)).mtimeMs;
    // mtime preservation is the determinism contract's tell: we MUST
    // skip the write entirely when the hash matches.
    expect(secondMtime).toBe(firstMtime);
  });

  it("ledger openapi hash matches across re-runs", async () => {
    const source = path.join(FIXTURES, "tiny.json");
    await runAtwApi({ source, projectRoot: tmp });
    const l1 = JSON.parse(
      await fs.readFile(path.join(tmp, ".atw/state/input-hashes.json"), "utf8"),
    ) as { files: Record<string, string> };
    await runAtwApi({ source, projectRoot: tmp });
    const l2 = JSON.parse(
      await fs.readFile(path.join(tmp, ".atw/state/input-hashes.json"), "utf8"),
    ) as { files: Record<string, string> };
    expect(l2.files[".atw/artifacts/openapi.json"]).toBe(
      l1.files[".atw/artifacts/openapi.json"],
    );
  });

  it("different source overwrites with action: rewritten and creates a .bak when --backup set", async () => {
    const tinySource = path.join(FIXTURES, "tiny.json");
    const adminSource = path.join(FIXTURES, "admin-only.json");

    const first = await runAtwApi({ source: tinySource, projectRoot: tmp });
    expect(first.action).toBe("created");

    const second = await runAtwApi({
      source: adminSource,
      projectRoot: tmp,
      backup: true,
    });
    expect(second.action).toBe("rewritten");
    expect(second.sha256).not.toBe(first.sha256);
    expect(second.backupPath).toBe(".atw/artifacts/openapi.json.bak");

    const bak = await fs.readFile(
      path.join(tmp, ".atw/artifacts/openapi.json.bak"),
      "utf8",
    );
    // The backup holds the original tiny-fixture canonical bytes.
    const original = await computeCanonicalOpenApi(tinySource);
    expect(bak).toBe(original);
  });

  it("different source without --backup does NOT create a backup file", async () => {
    const tinySource = path.join(FIXTURES, "tiny.json");
    const adminSource = path.join(FIXTURES, "admin-only.json");

    await runAtwApi({ source: tinySource, projectRoot: tmp });
    await runAtwApi({ source: adminSource, projectRoot: tmp, backup: false });

    await expect(
      fs.stat(path.join(tmp, ".atw/artifacts/openapi.json.bak")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });
});

async function computeCanonicalOpenApi(source: string): Promise<string> {
  const { runAtwApi } = await import("../src/atw-api.js");
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-api-sep-"));
  try {
    await runAtwApi({ source, projectRoot: tmp });
    return await fs.readFile(
      path.join(tmp, ".atw/artifacts/openapi.json"),
      "utf8",
    );
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}

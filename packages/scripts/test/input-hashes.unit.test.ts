/**
 * T067 — unit tests for `.atw/state/input-hashes.json` reader/writer.
 *
 * Exercises round-trip, missing-file handling, and hash stability
 * guarantees that the orchestrator's US3 skip logic relies on.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  computeInputHashes,
  readInputHashes,
  writeInputHashes,
  diffInputHashes,
  DEFAULT_INPUT_HASHES_PATH,
} from "../src/lib/input-hashes.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-input-hashes-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedTrackedFiles(root: string, contents: Record<string, string>) {
  for (const [rel, body] of Object.entries(contents)) {
    const abs = path.join(root, rel);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, body, "utf8");
  }
}

describe("input-hashes round-trip", () => {
  it("writes then reads an identical snapshot", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "# project",
      ".atw/config/brief.md": "# brief",
      ".atw/artifacts/schema-map.md": "# schema",
      ".atw/artifacts/action-manifest.md": "# actions",
      ".atw/artifacts/build-plan.md": "# plan",
    });
    const h = computeInputHashes(tmpRoot, null, "enrich-v1");
    await writeInputHashes(tmpRoot, h);
    const round = readInputHashes(tmpRoot);
    expect(round).not.toBeNull();
    expect(round).toEqual(h);
  });

  it("returns null when input-hashes.json is missing", () => {
    expect(readInputHashes(tmpRoot)).toBeNull();
  });

  it("returns null when schema_version is wrong", async () => {
    const abs = path.join(tmpRoot, DEFAULT_INPUT_HASHES_PATH);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(
      abs,
      JSON.stringify({ schema_version: "2", files: {}, prompt_template_version: "x" }),
      "utf8",
    );
    expect(readInputHashes(tmpRoot)).toBeNull();
  });

  it("returns null when the file is corrupt JSON", async () => {
    const abs = path.join(tmpRoot, DEFAULT_INPUT_HASHES_PATH);
    await fs.mkdir(path.dirname(abs), { recursive: true });
    await fs.writeFile(abs, "{not json", "utf8");
    expect(readInputHashes(tmpRoot)).toBeNull();
  });

  it("writeInputHashes is atomic (no stray .tmp left behind)", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "# project",
    });
    const h = computeInputHashes(tmpRoot, null, "enrich-v1");
    await writeInputHashes(tmpRoot, h);
    const tmp = path.join(tmpRoot, DEFAULT_INPUT_HASHES_PATH + ".tmp");
    expect(existsSync(tmp)).toBe(false);
  });
});

describe("computeInputHashes stability", () => {
  it("same content → same hash across calls", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "stable body",
      ".atw/config/brief.md": "stable body",
    });
    const a = computeInputHashes(tmpRoot, null, "enrich-v1");
    const b = computeInputHashes(tmpRoot, null, "enrich-v1");
    expect(a).toEqual(b);
    for (const v of Object.values(a.files)) {
      expect(v).toMatch(/^sha256:[0-9a-f]{64}$/);
    }
  });

  it("mutating a tracked file changes exactly that file's hash", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "v1",
      ".atw/config/brief.md": "v1",
    });
    const a = computeInputHashes(tmpRoot, null, "enrich-v1");
    await fs.writeFile(path.join(tmpRoot, ".atw/config/brief.md"), "v2", "utf8");
    const b = computeInputHashes(tmpRoot, null, "enrich-v1");
    expect(a.files[".atw/config/project.md"]).toEqual(b.files[".atw/config/project.md"]);
    expect(a.files[".atw/config/brief.md"]).not.toEqual(b.files[".atw/config/brief.md"]);
  });

  it("omits tracked files that do not exist on disk", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "only-this",
    });
    const h = computeInputHashes(tmpRoot, null, "enrich-v1");
    expect(Object.keys(h.files)).toEqual([".atw/config/project.md"]);
  });

  it("captures SQL dump when provided and present", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/inputs/dump.sql": "CREATE TABLE t();",
    });
    const h = computeInputHashes(tmpRoot, ".atw/inputs/dump.sql", "enrich-v1");
    expect(h.files[".atw/inputs/dump.sql"]).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("prompt_template_version round-trips verbatim", async () => {
    const h = computeInputHashes(tmpRoot, null, "enrich-v42");
    expect(h.prompt_template_version).toBe("enrich-v42");
  });
});

describe("diffInputHashes", () => {
  it("null prior → everything is changed + promptVersionChanged=true", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "x",
    });
    const current = computeInputHashes(tmpRoot, null, "enrich-v1");
    const d = diffInputHashes(null, current);
    expect(d.sameTotal).toBe(false);
    expect(d.promptVersionChanged).toBe(true);
    expect(d.changedKeys).toEqual([".atw/config/project.md"]);
  });

  it("identical prior + current → sameTotal=true and no changedKeys", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "x",
    });
    const h = computeInputHashes(tmpRoot, null, "enrich-v1");
    const d = diffInputHashes(h, h);
    expect(d.sameTotal).toBe(true);
    expect(d.changedKeys).toEqual([]);
    expect(d.promptVersionChanged).toBe(false);
  });

  it("changed prompt version flips promptVersionChanged without moving file hashes", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "x",
    });
    const a = computeInputHashes(tmpRoot, null, "enrich-v1");
    const b = computeInputHashes(tmpRoot, null, "enrich-v2");
    const d = diffInputHashes(a, b);
    expect(d.promptVersionChanged).toBe(true);
    expect(d.changedKeys).toEqual([]);
    expect(d.sameTotal).toBe(false);
  });

  it("added or removed tracked files show up in changedKeys", async () => {
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/project.md": "x",
    });
    const a = computeInputHashes(tmpRoot, null, "enrich-v1");
    await seedTrackedFiles(tmpRoot, {
      ".atw/config/brief.md": "y",
    });
    const b = computeInputHashes(tmpRoot, null, "enrich-v1");
    const d = diffInputHashes(a, b);
    expect(d.changedKeys).toContain(".atw/config/brief.md");
  });
});

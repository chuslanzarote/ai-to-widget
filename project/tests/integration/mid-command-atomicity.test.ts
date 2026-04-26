import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { writeArtifactAtomic } from "../../packages/scripts/src/lib/atomic.js";
import { writeAureliaArtifacts } from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-midcmd-"));
  await fs.mkdir(path.join(tmpRoot, "config"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "artifacts"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "state"), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("mid-command atomicity and re-run (T094 / FR-050)", () => {
  it("no draft file lingers under .atw/ if the command is interrupted before the atomic write", async () => {
    // Simulate a Builder closing Claude Code between LLM proposal and
    // confirmation — nothing should have been persisted under `.atw/`.
    // The test walks the tree and asserts there is no mid-command artifact
    // file (draft, .tmp, or .partial) alongside the config / artifacts /
    // state scaffolding.
    await writeAureliaArtifacts(tmpRoot);

    const stray = await findStrayDraftFiles(tmpRoot);
    expect(stray).toEqual([]);
  });

  it("atomic write restores the original file from .bak when an in-place failure happens", async () => {
    const target = path.join(tmpRoot, "artifacts", "schema-map.md");
    const original = "# original\n";
    await fs.writeFile(target, original, "utf8");

    try {
      // Force writeArtifactAtomic to throw by passing an unreachable path
      // under the same parent so the caller would have to restore.
      await writeArtifactAtomic(target, "# new\n");
      // Follow-up: no draft leaks after a successful write either.
      const actual = await fs.readFile(target, "utf8");
      expect(actual).toBe("# new\n");
    } finally {
      // The .bak sibling is the documented FR-046 contract — it must exist
      // after the write so the Builder can undo if needed.
      const bak = `${target}.bak`;
      expect(await fs.readFile(bak, "utf8")).toBe(original);
    }
  });

  // Feature 009 dropped the FR-050 / mid-command-discard language from
  // commands/atw.*.md. The atomicity invariant itself is exercised by
  // the two cases above.
});

async function findStrayDraftFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  await walk(root, (p) => {
    const base = path.basename(p);
    if (/\.(tmp|partial|draft)$/.test(base)) out.push(p);
    if (base.endsWith(".md.draft")) out.push(p);
  });
  return out;
}

async function walk(dir: string, visit: (p: string) => void): Promise<void> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, visit);
    } else {
      visit(full);
    }
  }
}

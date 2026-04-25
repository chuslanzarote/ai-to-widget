import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { runCli } from "../../packages/installer/src/index.js";
import { initProject } from "../../packages/scripts/src/init-project.js";
import { parseMarkdown, parseArtifactFromMarkdown } from "../../packages/scripts/src/lib/markdown.js";

describe("atw-init: end-to-end artifact write", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-init-e2e-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("scaffolds then writes project.md atomically via initProject", async () => {
    const targetDir = path.join(tmp, "demo");
    const scaffoldCode = await runCli({ argv: [targetDir] });
    expect(scaffoldCode).toBe(0);

    const projectPath = path.join(targetDir, ".atw", "config", "project.md");
    await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en", "es"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });

    const raw = await fs.readFile(projectPath, "utf8");
    const loaded = parseArtifactFromMarkdown("project", parseMarkdown(raw));
    expect(loaded.name).toBe("aurelia");
    expect(loaded.languages).toEqual(["en", "es"]);
    expect(loaded.deploymentType).toBe("customer-facing-widget");
    expect(loaded.createdAt).toBe("2026-04-21T12:00:00.000Z");

    // No stale .bak on a brand-new write
    const bakExists = await fs
      .stat(`${projectPath}.bak`)
      .then(() => true)
      .catch(() => false);
    expect(bakExists).toBe(false);
  });

  it("re-run bumps updatedAt; a changed answer also rewrites with a .bak", async () => {
    // Per Feature 008 contracts/project-md-v2.md §Re-run behaviour: every
    // `/atw.init` re-run re-emits `updatedAt`, so `wrote: true` even when
    // the Builder accepts all pre-filled defaults. Unchanged captured
    // values round-trip byte-for-byte.
    const targetDir = path.join(tmp, "demo");
    await runCli({ argv: [targetDir] });
    const projectPath = path.join(targetDir, ".atw", "config", "project.md");
    await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });

    const sameResult = await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(sameResult.wrote).toBe(true);
    expect(sameResult.diff).toEqual([]);
    expect(sameResult.artifact.updatedAt).toBe("2026-04-22T12:00:00.000Z");

    const changedResult = await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en", "es"],
        deploymentType: "customer-facing-widget",
      },
    });
    expect(changedResult.wrote).toBe(true);
    expect(changedResult.diff.map((d) => d.field)).toContain("languages");
    const bakExists = await fs
      .stat(`${projectPath}.bak`)
      .then(() => true)
      .catch(() => false);
    expect(bakExists).toBe(true);
  });
});

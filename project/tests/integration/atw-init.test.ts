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

  const origins = {
    atwBackendOrigin: "https://atw.example.com",
    hostApiOrigin: "https://api.example.com",
    hostPageOrigin: "https://www.example.com",
  };

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
        ...origins,
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

  it("idempotent re-run with identical answers preserves the artifact (Feature 009)", async () => {
    // Feature 009 init-project is idempotent: same answers + existing
    // file → wrote=false, artifact unchanged. The 008 v2 "always bump
    // updatedAt" / per-field diff contract was dropped.
    const targetDir = path.join(tmp, "demo");
    await runCli({ argv: [targetDir] });
    const projectPath = path.join(targetDir, ".atw", "config", "project.md");
    const first = await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        ...origins,
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    expect(first.wrote).toBe(true);

    const sameResult = await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        ...origins,
      },
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(sameResult.wrote).toBe(false);
    expect(sameResult.artifact.createdAt).toBe(first.artifact.createdAt);

    const changedResult = await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en", "es"],
        deploymentType: "customer-facing-widget",
        ...origins,
      },
    });
    expect(changedResult.wrote).toBe(true);
    expect(changedResult.artifact.languages).toEqual(["en", "es"]);
    expect(changedResult.artifact.createdAt).toBe(first.artifact.createdAt);
  });
});

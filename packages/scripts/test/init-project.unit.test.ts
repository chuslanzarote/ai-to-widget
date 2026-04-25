import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initProject, loadExistingProject } from "../src/init-project.js";

describe("initProject", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-init-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes project.md on first run", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    const result = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en", "es"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    expect(result.wrote).toBe(true);
    const loaded = await loadExistingProject(target);
    expect(loaded?.name).toBe("aurelia");
    expect(loaded?.languages).toEqual(["en", "es"]);
    expect(loaded?.createdAt).toBe("2026-04-21T12:00:00.000Z");
  });

  it("preserves createdAt and bumps updatedAt on accept-all re-run (Feature 008 v2 re-run contract)", async () => {
    // Per contracts/project-md-v2.md §Re-run behaviour: every re-run
    // re-emits `updatedAt`; other captured values are preserved
    // byte-for-byte when the Builder accepts each pre-filled default.
    const target = path.join(tmp, ".atw", "config", "project.md");
    const common = {
      name: "aurelia",
      languages: ["en"],
      deploymentType: "customer-facing-widget" as const,
    };
    const first = await initProject({
      targetPath: target,
      answers: common,
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    const second = await initProject({
      targetPath: target,
      answers: common,
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(first.wrote).toBe(true);
    expect(second.wrote).toBe(true);
    expect(second.diff).toEqual([]);
    expect(second.artifact.createdAt).toBe(first.artifact.createdAt);
    expect(second.artifact.updatedAt).toBe("2026-04-22T12:00:00.000Z");
    expect(first.artifact.updatedAt).toBe("2026-04-21T12:00:00.000Z");
  });

  it("rewrites when a value changes, keeping createdAt", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    const first = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    const second = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en", "es"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(second.wrote).toBe(true);
    expect(second.artifact.createdAt).toBe(first.artifact.createdAt);
    expect(second.artifact.languages).toEqual(["en", "es"]);
  });

  it("rejects empty language list", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    await expect(
      initProject({
        targetPath: target,
        answers: {
          name: "aurelia",
          languages: [],
          deploymentType: "customer-facing-widget",
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects invalid deploymentType", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    await expect(
      initProject({
        targetPath: target,
        answers: {
          name: "aurelia",
          languages: ["en"],
          // @ts-expect-error — deliberate invalid value
          deploymentType: "typo",
        },
      }),
    ).rejects.toThrow();
  });
});

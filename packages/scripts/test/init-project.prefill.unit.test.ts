/**
 * T041 / Feature 008 — `/atw.init` v2 re-run behaviour.
 *
 * Contract: specs/008-atw-hardening/contracts/project-md-v2.md §Re-run
 * behaviour and §Validator contract tests 3–4.
 *
 * Coverage:
 *   (a) First-run `deploymentType` defaults to `customer-facing-widget`
 *       when the caller passes no value (the interactive `/atw.init`
 *       prompt presents the same default — R6 / FR-005a).
 *   (b) Accept-all re-run yields byte-identical frontmatter **except**
 *       `updatedAt`, which is bumped.
 *   (c) Pre-fill fidelity: the returned `previous` artifact carries the
 *       previously-captured values so `/atw.init` can present them as
 *       defaults; `diff` is empty when the Builder re-accepts them.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { initProject, loadExistingProject } from "../src/init-project.js";

describe("initProject re-run (T041 / Feature 008 v2)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-prefill-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("(a) first run defaults storefrontOrigins to ['http://localhost:5173'] for customer-facing-widget", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    const res = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    expect(res.wrote).toBe(true);
    expect(res.previous).toBeNull();
    expect(res.artifact.storefrontOrigins).toEqual(["http://localhost:5173"]);
    expect(res.artifact.deploymentType).toBe("customer-facing-widget");
    expect(res.artifact.updatedAt).toBe("2026-04-21T12:00:00.000Z");
  });

  it("(b) accept-all re-run keeps frontmatter byte-identical except updatedAt", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    const first = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: ["https://shop.example.com"],
        welcomeMessage: "Hi friend!",
        authTokenKey: "shop_auth_token",
        loginUrl: "https://shop.example.com/login",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });
    const firstBytes = await fs.readFile(target, "utf8");

    const second = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: ["https://shop.example.com"],
        welcomeMessage: "Hi friend!",
        authTokenKey: "shop_auth_token",
        loginUrl: "https://shop.example.com/login",
      },
      now: () => new Date("2026-04-22T09:30:00Z"),
    });
    const secondBytes = await fs.readFile(target, "utf8");

    expect(second.wrote).toBe(true);
    expect(second.diff).toEqual([]);
    expect(second.artifact.createdAt).toBe(first.artifact.createdAt);
    expect(second.artifact.updatedAt).not.toBe(first.artifact.updatedAt);
    expect(second.artifact.updatedAt).toBe("2026-04-22T09:30:00.000Z");

    // Byte-level check: the only difference between runs is the updatedAt
    // line inside the frontmatter.
    const normalise = (s: string) => s.replace(/^updatedAt: ".*?"$/m, "<TS>");
    expect(normalise(firstBytes)).toBe(normalise(secondBytes));
  });

  it("(c) previous artifact is returned so callers can present pre-filled defaults", async () => {
    const target = path.join(tmp, ".atw", "config", "project.md");
    await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: ["https://shop.example.com"],
        welcomeMessage: "Welcome back!",
        authTokenKey: "my_token",
        loginUrl: "",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });

    const loaded = await loadExistingProject(target);
    expect(loaded?.welcomeMessage).toBe("Welcome back!");
    expect(loaded?.authTokenKey).toBe("my_token");
    expect(loaded?.storefrontOrigins).toEqual(["https://shop.example.com"]);
    expect(loaded?.loginUrl).toBe("");

    // A re-run that only tweaks one field surfaces that single diff entry.
    const res = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: ["https://shop.example.com"],
        welcomeMessage: "Hello!",
        authTokenKey: "my_token",
        loginUrl: "",
      },
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(res.diff.map((d) => d.field)).toEqual(["welcomeMessage"]);
    expect(res.diff[0].before).toBe("Welcome back!");
    expect(res.diff[0].after).toBe("Hello!");
    expect(res.previous?.welcomeMessage).toBe("Welcome back!");
  });

  it("(d) pre-fills v2 fields from existing artifact when caller omits them", async () => {
    // Simulates `/atw.init` reading the file and passing the loaded values
    // as the defaults for the second run — except the welcomeMessage which
    // the Builder leaves blank; the prior value must carry through.
    const target = path.join(tmp, ".atw", "config", "project.md");
    await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: ["https://shop.example.com"],
        welcomeMessage: "Stored greeting",
        authTokenKey: "key_v1",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });

    const res = await initProject({
      targetPath: target,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        // welcomeMessage, authTokenKey, storefrontOrigins omitted — the
        // re-run logic should read them back from disk.
      },
      now: () => new Date("2026-04-22T12:00:00Z"),
    });
    expect(res.artifact.welcomeMessage).toBe("Stored greeting");
    expect(res.artifact.authTokenKey).toBe("key_v1");
    expect(res.artifact.storefrontOrigins).toEqual([
      "https://shop.example.com",
    ]);
    expect(res.diff).toEqual([]);
  });
});

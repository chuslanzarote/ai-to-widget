/**
 * T043 / Feature 008 — `/atw.embed` integration-snippet attributes.
 *
 * Contract: specs/008-atw-hardening/contracts/embed-snippet.md.
 *
 * Cases covered:
 *   (a) `data-auth-token-key="<authTokenKey>"` present; legacy
 *       `data-bearer-storage-key` absent.
 *   (b) `data-allowed-tools` is an alphabetically-sorted CSV derived
 *       from `action-executors.json#tool`.
 *   (c) Files-to-copy markdown task-list appears; the catalog bullet
 *       is present when non-empty and omitted when empty.
 *   (d) Host-requirements reminder appears iff
 *       `.atw/artifacts/host-requirements.md` exists.
 *   (e) `data-welcome-message` matches `project.md#welcomeMessage`.
 *   (f) A tool name containing a comma fails the build with
 *       `ToolNameCommaError` (FR-015).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  renderEmbedGuide,
  ToolNameCommaError,
  readAllowedTools,
} from "../src/embed.js";
import { initProject } from "../src/init-project.js";

async function seedBuildArtefacts(root: string): Promise<void> {
  await fs.mkdir(path.join(root, "dist"), { recursive: true });
  await fs.writeFile(path.join(root, "dist", "widget.js"), "/* w */");
  await fs.writeFile(path.join(root, "dist", "widget.css"), "/* c */");
  await fs.mkdir(path.join(root, ".atw", "state"), { recursive: true });
  await fs.mkdir(path.join(root, ".atw", "artifacts"), { recursive: true });
  await fs.writeFile(
    path.join(root, ".atw", "state", "build-manifest.json"),
    JSON.stringify({ result: "success" }),
  );
  await fs.writeFile(
    path.join(root, ".atw", "artifacts", "action-manifest.md"),
    "# AM\n",
  );
}

async function writeCatalog(root: string, tools: string[]): Promise<void> {
  await fs.writeFile(
    path.join(root, ".atw", "artifacts", "action-executors.json"),
    JSON.stringify(
      {
        version: 1,
        credentialMode: "bearer-localstorage",
        actions: tools.map((t) => ({
          tool: t,
          method: "POST",
          pathTemplate: `/${t}`,
          substitution: { path: {}, body: {}, query: {} },
          headers: { "content-type": "application/json" },
          responseHandling: {
            successStatuses: [200],
            summaryTemplate: "ok",
            summaryFields: [],
          },
        })),
      },
      null,
      2,
    ),
  );
}

async function writeProject(
  root: string,
  overrides: {
    welcomeMessage?: string;
    authTokenKey?: string;
  } = {},
): Promise<void> {
  await initProject({
    targetPath: path.join(root, ".atw", "config", "project.md"),
    answers: {
      name: "aurelia",
      languages: ["en"],
      deploymentType: "customer-facing-widget",
      storefrontOrigins: ["https://shop.example.com"],
      welcomeMessage: overrides.welcomeMessage ?? "Hi friend!",
      authTokenKey: overrides.authTokenKey ?? "shop_auth_token",
      loginUrl: "",
    },
    now: () => new Date("2026-04-21T12:00:00Z"),
  });
}

describe("embed: integration-snippet attributes (T043)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-embed-attrs-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("(a) emits data-auth-token-key and never data-bearer-storage-key", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp, { authTokenKey: "shop_auth_token" });
    await writeCatalog(tmp, ["listOrders", "addToCart"]);
    const res = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(res.snippet.pasteableSnippet).toContain(
      'data-auth-token-key="shop_auth_token"',
    );
    expect(res.snippet.full).not.toContain("data-bearer-storage-key");
    const guide = await fs.readFile(res.outputPath, "utf8");
    expect(guide).toContain('data-auth-token-key="shop_auth_token"');
    expect(guide).not.toContain("data-bearer-storage-key");
  });

  it("(b) derives data-allowed-tools as an alphabetically-sorted CSV", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp);
    await writeCatalog(tmp, ["listMyOrders", "addToCart", "getProduct"]);
    const res = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(res.snippet.allowedTools).toEqual([
      "addToCart",
      "getProduct",
      "listMyOrders",
    ]);
    expect(res.snippet.pasteableSnippet).toContain(
      'data-allowed-tools="addToCart,getProduct,listMyOrders"',
    );
  });

  it("(c) files-to-copy checklist includes catalog item when catalog is non-empty", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp);
    await writeCatalog(tmp, ["addToCart"]);
    const res = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(res.snippet.filesToCopy).toContain("- [ ] `dist/widget.js`");
    expect(res.snippet.filesToCopy).toContain("- [ ] `dist/widget.css`");
    expect(res.snippet.filesToCopy).toContain(
      "- [ ] `.atw/artifacts/action-executors.json`",
    );
  });

  it("(c') files-to-copy checklist omits the catalog bullet when the catalog is empty", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp);
    await writeCatalog(tmp, []);
    const res = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(res.snippet.filesToCopy).toContain("- [ ] `dist/widget.js`");
    expect(res.snippet.filesToCopy).toContain("- [ ] `dist/widget.css`");
    expect(res.snippet.filesToCopy).not.toContain("action-executors.json");
  });

  it("(d) host-requirements reminder appears iff host-requirements.md exists", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp);
    await writeCatalog(tmp, ["addToCart"]);

    // Without host-requirements.md
    const noReminder = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(noReminder.snippet.hostRequirementsReminder).toBeNull();
    expect(noReminder.snippet.full).not.toContain("host-requirements.md");

    // With host-requirements.md
    await fs.writeFile(
      path.join(tmp, ".atw", "artifacts", "host-requirements.md"),
      "# Host Requirements\n",
    );
    const withReminder = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(withReminder.snippet.hostRequirementsReminder).toContain(
      "Before embedding, verify your host meets these requirements",
    );
    expect(withReminder.snippet.hostRequirementsReminder).toContain(
      "`.atw/artifacts/host-requirements.md`",
    );
  });

  it("(e) data-welcome-message propagates from project.md", async () => {
    await seedBuildArtefacts(tmp);
    await writeProject(tmp, { welcomeMessage: "Welcome!" });
    await writeCatalog(tmp, ["addToCart"]);
    const res = await renderEmbedGuide({
      projectRoot: tmp,
      answers: {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        authMode: "bearer",
        authTokenKey: "shop_auth_token",
      },
      frozenTime: "2026-04-21T12:00:00Z",
    });
    expect(res.snippet.pasteableSnippet).toContain(
      'data-welcome-message="Welcome!"',
    );
  });

  it("(f) readAllowedTools throws ToolNameCommaError when a tool name contains a comma", async () => {
    await fs.mkdir(path.join(tmp, ".atw", "artifacts"), { recursive: true });
    await writeCatalog(tmp, ["bad,name", "ok"]);
    await expect(readAllowedTools(tmp)).rejects.toBeInstanceOf(
      ToolNameCommaError,
    );
  });
});

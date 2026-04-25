/**
 * T042 / Feature 008 — `/atw.api` emits `.atw/artifacts/host-requirements.md`.
 *
 * Contract: specs/008-atw-hardening/contracts/host-requirements.md.
 *
 * Cases covered:
 *   (a) Emission gate — absent `deploymentType` in `project.md` ⇒ file
 *       is NOT written and `result.hostRequirements.action === "skipped"`.
 *   (b) Emission content — CORS origins from `storefrontOrigins`,
 *       localStorage key from `authTokenKey`, login URL from `loginUrl`,
 *       verbs union (baseline + catalog) and headers (baseline + X-*
 *       discovered in OpenAPI `parameters[in=header]`) all present.
 *   (c) Generator comment present (override-warning contract test).
 *   (d) Byte-identical regeneration on unchanged inputs.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { runAtwApi } from "../src/atw-api.js";
import { initProject } from "../src/init-project.js";

const HOST_REQS_REL = ".atw/artifacts/host-requirements.md";

/**
 * Minimal OpenAPI 3.0 doc with:
 *   - GET /items            (no security)
 *   - PATCH /items/{id}     (bearer-JWT + custom X-Request-Id header)
 *   - DELETE /items/{id}    (bearer-JWT + X-Correlation-Id header)
 *
 * Exercises: PATCH+DELETE verbs (beyond baseline GET/POST) and two
 * X-* headers so deriveHeaders has something to sort.
 */
function fixtureOpenApi(): string {
  return JSON.stringify({
    openapi: "3.0.3",
    info: { title: "T042 fixture", version: "1.0.0" },
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
    paths: {
      "/items": {
        get: {
          operationId: "listItems",
          summary: "List items.",
          responses: { "200": { description: "OK" } },
        },
      },
      "/items/{id}": {
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        patch: {
          operationId: "updateItem",
          summary: "Update an item.",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "X-Request-Id",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: { name: { type: "string" } },
                },
              },
            },
          },
          responses: { "200": { description: "OK" } },
        },
        delete: {
          operationId: "deleteItem",
          summary: "Delete an item.",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "X-Correlation-Id",
              in: "header",
              required: false,
              schema: { type: "string" },
            },
          ],
          responses: { "204": { description: "No Content" } },
        },
      },
    },
  });
}

async function writeOpenApiFixture(root: string): Promise<string> {
  const p = path.join(root, "openapi.json");
  await fs.writeFile(p, fixtureOpenApi(), "utf8");
  return p;
}

describe("atw-api: host-requirements.md emission (T042)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-api-hostreq-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("(a) is NOT emitted when project.md is absent (deploymentType gate fails)", async () => {
    const source = await writeOpenApiFixture(tmp);
    const result = await runAtwApi({ source, projectRoot: tmp });
    expect(result.hostRequirements?.action).toBe("skipped");
    await expect(
      fs.stat(path.join(tmp, HOST_REQS_REL)),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("(b)+(c) emits content populated from project.md + catalog, including generator comment", async () => {
    const projectPath = path.join(tmp, ".atw", "config", "project.md");
    await initProject({
      targetPath: projectPath,
      answers: {
        name: "aurelia",
        languages: ["en"],
        deploymentType: "customer-facing-widget",
        storefrontOrigins: [
          "https://shop.example.com",
          "https://staging.shop.example.com",
        ],
        welcomeMessage: "Hi friend!",
        authTokenKey: "shop_auth_token",
        loginUrl: "https://shop.example.com/login",
      },
      now: () => new Date("2026-04-21T12:00:00Z"),
    });

    const source = await writeOpenApiFixture(tmp);
    const result = await runAtwApi({ source, projectRoot: tmp });
    expect(result.hostRequirements?.action).toBe("created");
    expect(result.hostRequirements?.path).toBe(HOST_REQS_REL);

    const body = await fs.readFile(path.join(tmp, HOST_REQS_REL), "utf8");

    // (c) generator comment verbatim.
    expect(body).toContain(
      "<!-- Generated by /atw.api — edits here are overwritten on next run -->",
    );

    // (b) CORS origins — both storefrontOrigins entries rendered as bullets.
    expect(body).toContain("- `https://shop.example.com`");
    expect(body).toContain("- `https://staging.shop.example.com`");

    // Preflight verbs — baseline ∪ catalog, sorted. Catalog adds PATCH + DELETE,
    // GET is both baseline and catalog, OPTIONS is baseline-only.
    expect(body).toMatch(/- `DELETE`, `GET`, `OPTIONS`, `PATCH`, `POST`/);

    // Preflight headers — baseline first (Authorization, Content-Type),
    // then X-* sorted alphabetically.
    expect(body).toContain("- `Authorization`");
    expect(body).toContain("- `Content-Type`");
    expect(body).toContain("- `X-Correlation-Id`");
    expect(body).toContain("- `X-Request-Id`");
    // Alphabetical order check on the X-* pair.
    expect(body.indexOf("X-Correlation-Id")).toBeLessThan(
      body.indexOf("X-Request-Id"),
    );

    // Bearer-token storage — authTokenKey quoted inside localStorage[...].
    expect(body).toContain(
      'window.localStorage["shop_auth_token"]',
    );

    // Login redirect — loginUrl rendered as bullet.
    expect(body).toContain("- `https://shop.example.com/login`");

    // In-terminal summary shape (emitted at runAtwApi time, asserted via result).
    expect(result.hostRequirements?.summary).toContain(
      "Your host must provide:",
    );
    expect(result.hostRequirements?.summary).toContain(
      'localStorage key "shop_auth_token"',
    );
    expect(result.hostRequirements?.summary).toContain(
      "Full checklist: .atw/artifacts/host-requirements.md",
    );
  });

  it("(d) second run against unchanged inputs is byte-identical (unchanged)", async () => {
    const projectPath = path.join(tmp, ".atw", "config", "project.md");
    await initProject({
      targetPath: projectPath,
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
    const source = await writeOpenApiFixture(tmp);

    const first = await runAtwApi({ source, projectRoot: tmp });
    const firstBytes = await fs.readFile(
      path.join(tmp, HOST_REQS_REL),
      "utf8",
    );
    expect(first.hostRequirements?.action).toBe("created");

    const second = await runAtwApi({ source, projectRoot: tmp });
    const secondBytes = await fs.readFile(
      path.join(tmp, HOST_REQS_REL),
      "utf8",
    );
    expect(second.hostRequirements?.action).toBe("unchanged");
    expect(secondBytes).toBe(firstBytes);
  });
});

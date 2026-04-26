/**
 * T015 — credentialSource backfill + D-CREDSRC halt (FR-013).
 *
 * (a) When an OpenAPI op declares `security: [{bearerAuth: []}]`, the
 *     parser backfills `entry.source.security` and the rendered catalog
 *     entry carries a well-formed `credentialSource`.
 * (b) A shopper-scoped op with NO declared security halts the validate
 *     stage with D-CREDSRC text matching contracts/builder-diagnostics.md.
 */
import { describe, it, expect } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";

import {
  parseActionManifest,
  MissingCredentialSourceError,
} from "../src/parse-action-manifest.js";
import { renderExecutors } from "../src/render-executors.js";

const OPENAPI_WITH_BEARER = {
  openapi: "3.0.0",
  info: { title: "t", version: "1" },
  paths: {
    "/store/carts/{id}/line-items": {
      post: {
        operationId: "addLineItem",
        summary: "Add a line item",
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { variant_id: { type: "string" } },
                required: ["variant_id"],
              },
            },
          },
        },
        responses: { "200": { description: "ok" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
  },
};

const OPENAPI_NO_SECURITY = {
  openapi: "3.0.0",
  info: { title: "t", version: "1" },
  paths: {
    "/store/carts/{id}/line-items": {
      post: {
        operationId: "addLineItem",
        summary: "Add a line item",
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { variant_id: { type: "string" } },
                required: ["variant_id"],
              },
            },
          },
        },
        responses: { "200": { description: "ok" } },
      },
    },
  },
  components: { securitySchemes: {} },
};

function manifestText(): string {
  return `# Action manifest

## Provenance

- OpenAPI snapshot: sha256:0000000000000000000000000000000000000000000000000000000000000000
- Classifier model: claude-opus-4-7
- Classified at: 2026-04-22T00:00:00.000Z

## Summary

One shopper-scoped tool.

## Tools: cart

### add_line_item

Description: Add a line item to the cart.

Parameters:

\`\`\`json
{ "type": "object", "properties": { "id": { "type": "string" }, "variant_id": { "type": "string" } }, "required": ["id", "variant_id"] }
\`\`\`

requires_confirmation: true
is_action: true
Source: POST /store/carts/{id}/line-items

## Excluded

## Orphaned (operation removed from OpenAPI)
`;
}

describe("cross-validate — credential backfill + D-CREDSRC (T015 / FR-013)", () => {
  it("(a) backfills security from OpenAPI and renders a credentialSource", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-cred-"));
    try {
      const manifestPath = path.join(tmp, "action-manifest.md");
      const openapiPath = path.join(tmp, "openapi.json");
      await fs.writeFile(manifestPath, manifestText());
      await fs.writeFile(openapiPath, JSON.stringify(OPENAPI_WITH_BEARER));

      const manifest = await parseActionManifest({
        manifestPath,
        openapiPath,
        deploymentType: "customer-facing-widget",
      });

      const entry = manifest.included[0];
      expect(entry?.source.security).toEqual(["bearerAuth"]);

      const catalogPath = path.join(tmp, "action-executors.json");
      await renderExecutors(manifest, {
        outputPath: catalogPath,
        hostOrigin: "http://localhost:9000",
        widgetOrigin: "http://localhost:9000",
        authTokenKey: "shop_jwt",
      });
      const catalogText = await fs.readFile(catalogPath, "utf8");
      const catalog = JSON.parse(catalogText) as {
        actions: Array<{
          tool: string;
          credentialSource?: {
            type: string;
            key: string;
            header: string;
            scheme: string;
          };
        }>;
      };
      const rendered = catalog.actions.find((a) => a.tool === "add_line_item");
      expect(rendered?.credentialSource).toBeDefined();
      expect(rendered?.credentialSource?.type).toBe("bearer-localstorage");
      expect(rendered?.credentialSource?.key).toBe("shop_jwt");
      expect(rendered?.credentialSource?.header).toBe("Authorization");
      expect(rendered?.credentialSource?.scheme).toBe("Bearer");
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });

  it("(b) shopper-scoped op with no declared security halts with D-CREDSRC", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-cred-"));
    try {
      const manifestPath = path.join(tmp, "action-manifest.md");
      const openapiPath = path.join(tmp, "openapi.json");
      await fs.writeFile(manifestPath, manifestText());
      await fs.writeFile(openapiPath, JSON.stringify(OPENAPI_NO_SECURITY));

      await expect(
        parseActionManifest({
          manifestPath,
          openapiPath,
          deploymentType: "customer-facing-widget",
        }),
      ).rejects.toThrow(MissingCredentialSourceError);

      try {
        await parseActionManifest({
          manifestPath,
          openapiPath,
          deploymentType: "customer-facing-widget",
        });
      } catch (err) {
        const msg = (err as Error).message;
        expect(msg).toMatch(/would ship without a credential source/);
        expect(msg).toMatch(/add_line_item/);
        expect(msg).toMatch(/Build halted/);
      }
    } finally {
      await fs.rm(tmp, { recursive: true, force: true });
    }
  });
});

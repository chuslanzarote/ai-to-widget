import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadArtifactFromFile, runLoadArtifact } from "../src/load-artifact.js";
import { serializeArtifact } from "../src/lib/markdown.js";
import type {
  ProjectArtifact,
  BriefArtifact,
  SchemaMapArtifact,
  ActionManifestArtifact,
  BuildPlanArtifact,
} from "../src/lib/types.js";

describe("load-artifact contract", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-load-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("round-trips a project artifact", async () => {
    const project: ProjectArtifact = {
      name: "aurelia",
      languages: ["en", "es"],
      deploymentType: "customer-facing-widget",
      createdAt: "2026-04-21T12:00:00Z",
      storefrontOrigins: ["http://localhost:5173"],
    };
    const md = serializeArtifact("project", project);
    const file = path.join(tmp, "project.md");
    await fs.writeFile(file, md);
    const loaded = await loadArtifactFromFile("project", file);
    expect(loaded.kind).toBe("project");
    expect(loaded.content).toMatchObject(project);
  });

  it("round-trips a brief artifact", async () => {
    const brief: BriefArtifact = {
      businessScope: "Sells handmade ceramics online.",
      customers: "Design-minded consumers across NA.",
      allowedActions: ["answer product questions", "recommend pairings"],
      forbiddenActions: ["process payments", "discuss competitors"],
      tone: "Warm but precise.",
      primaryUseCases: ["help choose a gift", "check stock"],
      vocabulary: [{ term: "SKU", definition: "Stock-keeping unit" }],
      antiPatterns: ["hard-selling during browsing"],
    };
    const md = serializeArtifact("brief", brief);
    const file = path.join(tmp, "brief.md");
    await fs.writeFile(file, md);
    const loaded = await loadArtifactFromFile("brief", file);
    expect(loaded.kind).toBe("brief");
    expect(loaded.content.businessScope).toContain("ceramics");
    expect(loaded.content.allowedActions).toEqual(brief.allowedActions);
    expect(loaded.content.vocabulary[0].term).toBe("SKU");
  });

  it("round-trips a schema-map artifact", async () => {
    const map: SchemaMapArtifact = {
      summary: "60 tables; 12 indexable entities; 8 PII-excluded.",
      entities: [
        {
          name: "Product",
          classification: "indexable",
          sourceTables: ["product", "product_variant"],
          joinedReferences: ["product_collection"],
          columns: [
            { name: "id", decision: "reference" },
            { name: "title", decision: "index" },
          ],
          evidence: "FK from product_variant.product_id.",
        },
      ],
      referenceTables: ["region"],
      infrastructureTables: ["migrations"],
      piiExcluded: [
        {
          table: "customer",
          columns: ["email", "phone"],
          reason: "direct personal identifiers",
        },
      ],
    };
    const md = serializeArtifact("schema-map", map);
    const file = path.join(tmp, "schema-map.md");
    await fs.writeFile(file, md);
    const loaded = await loadArtifactFromFile("schema-map", file);
    expect(loaded.content.entities[0].name).toBe("Product");
    expect(loaded.content.piiExcluded[0].table).toBe("customer");
  });

  it("round-trips an action-manifest artifact", async () => {
    const manifest: ActionManifestArtifact = {
      summary: "42 operations; 18 admin-excluded.",
      tools: [
        {
          entity: "Cart",
          items: [
            {
              name: "get_cart",
              description: "Fetch a cart by id.",
              parameters: { id: { type: "string" } },
              requiresConfirmation: false,
              source: { method: "get", path: "/store/carts/{id}" },
              parameterSources: ["widget context"],
            },
          ],
        },
      ],
      excluded: [{ method: "post", path: "/admin/users", reason: "admin-only" }],
      runtimeSystemPromptBlock: "You are the Aurelia concierge.",
    };
    const md = serializeArtifact("action-manifest", manifest);
    const file = path.join(tmp, "action-manifest.md");
    await fs.writeFile(file, md);
    const loaded = await loadArtifactFromFile("action-manifest", file);
    expect(loaded.content.tools[0].entity).toBe("Cart");
    expect(loaded.content.tools[0].items[0].name).toBe("get_cart");
    expect(loaded.content.excluded[0].path).toBe("/admin/users");
  });

  it("round-trips a build-plan artifact", async () => {
    const plan: BuildPlanArtifact = {
      summary: "Enrich products and collections.",
      embeddingApproach: "text-embedding-3-small with 1536 dims.",
      categoryVocabularies: [{ entity: "product", terms: ["ceramic", "stone"] }],
      enrichmentPromptTemplates: [{ entity: "product", template: "Describe {{title}}." }],
      estimatedEntityCounts: { product: 1200, collection: 40 },
      costEstimate: {
        enrichmentCalls: 1240,
        perCallCostUsd: 0.0004,
        totalCostUsd: 0.496,
        retryBufferUsd: 0.05,
      },
      backendConfigurationDefaults: { "backend.port": "8080" },
      widgetConfigurationDefaults: { "widget.theme": "light" },
      buildSequence: ["pull images", "start postgres", "run enrichment"],
      failureHandling: "Retry once then surface the error.",
    };
    const md = serializeArtifact("build-plan", plan);
    const file = path.join(tmp, "build-plan.md");
    await fs.writeFile(file, md);
    const loaded = await loadArtifactFromFile("build-plan", file);
    expect(loaded.content.embeddingApproach).toContain("text-embedding-3-small");
    expect(loaded.content.costEstimate.enrichmentCalls).toBe(1240);
  });

  it("returns exit 1 for missing file via CLI", async () => {
    const exit = await runLoadArtifact([
      "--kind",
      "project",
      "--source",
      path.join(tmp, "nope.md"),
    ]);
    expect(exit).toBe(1);
  });

  it("returns exit 3 for invalid kind via CLI", async () => {
    const exit = await runLoadArtifact(["--kind", "wrong", "--source", "foo.md"]);
    expect(exit).toBe(3);
  });
});

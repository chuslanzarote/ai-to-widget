/**
 * T103 / Polish — --force flag integration test.
 *
 * Contract (Clarifications Q2):
 *   --force re-enriches every entity regardless of source_hash BUT:
 *     (a) Opus is invoked for all N entities.
 *     (b) Migrations are NOT re-applied (ledger suppresses already-applied
 *         SQL files).
 *     (c) `client_ref` is NOT re-imported (the dump is the source of truth;
 *         re-import is costly and unnecessary for enrichment-only refresh).
 *     (d) Embedding model cache is NOT invalidated (@xenova/transformers
 *         keeps its on-disk cache; we do not purge it).
 *     (e) Docker layer cache is still consulted (we do not `--no-cache`).
 *
 * This test runs a full build, then runs again with --force and inspects
 * the two manifests side-by-side.
 *
 * Requires Docker. Auto-skips without ATW_E2E_DOCKER=1.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..", "..");
const aureliaCompleted = path.resolve(repoRoot, "examples", "aurelia-completed");
const aureliaFixture = path.resolve(repoRoot, "tests", "fixtures", "aurelia");

const DOCKER_AVAILABLE = process.env.ATW_E2E_DOCKER === "1";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-force-"));
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function seedProject(root: string): Promise<void> {
  const atwConfig = path.join(root, ".atw", "config");
  const atwArtifacts = path.join(root, ".atw", "artifacts");
  const atwInputs = path.join(root, ".atw", "inputs");
  const atwState = path.join(root, ".atw", "state");
  await fs.mkdir(atwConfig, { recursive: true });
  await fs.mkdir(atwArtifacts, { recursive: true });
  await fs.mkdir(atwInputs, { recursive: true });
  await fs.mkdir(atwState, { recursive: true });

  for (const f of ["brief.md", "project.md"]) {
    await fs.copyFile(
      path.join(aureliaCompleted, "config", f),
      path.join(atwConfig, f),
    );
  }
  for (const f of ["schema-map.md", "action-manifest.md", "build-plan.md"]) {
    await fs.copyFile(
      path.join(aureliaCompleted, "artifacts", f),
      path.join(atwArtifacts, f),
    );
  }
  await fs.copyFile(
    path.join(aureliaFixture, "schema-with-data.sql"),
    path.join(atwInputs, "aurelia.sql"),
  );
}

function stableEnrichment(): string {
  return JSON.stringify({
    kind: "enriched",
    document:
      "This indexable entity is present in the Aurelia fixture and is suitable for retrieval augmented testing in the Build Pipeline feature.",
    facts: [
      { claim: "entity is from the Aurelia fixture", source: "primary_record.id" },
    ],
    categories: { source: ["aurelia"] },
  });
}

describe.skipIf(!DOCKER_AVAILABLE)("build --force flag (T103 / Clarifications Q2)", () => {
  it("re-enriches every entity, preserves migration ledger, does not re-import client_ref", async () => {
    await seedProject(tmpRoot);

    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );

    // --- Run 1: clean build, no force. All entities enriched.
    let run1Calls = 0;
    const run1 = await runBuild({
      projectRoot: tmpRoot,
      dryRun: false,
      force: false,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          run1Calls += 1;
          return {
            contentText: stableEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });
    expect(run1.manifest.result).toBe("success");
    const totalEntities = run1.manifest.totals.total_entities;
    expect(totalEntities).toBeGreaterThan(0);
    expect(run1.manifest.totals.enriched).toBe(totalEntities);

    // Snapshot the atw_migrations ledger size BEFORE --force.
    const { Client } = await import("pg");
    async function countMigrations(): Promise<number> {
      const client = new Client({
        host: "127.0.0.1",
        port: 5433,
        user: "atw",
        password: "atw",
        database: "atw",
      });
      await client.connect();
      try {
        const res = await client.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM atw_migrations",
        );
        return Number(res.rows[0].n);
      } finally {
        await client.end().catch(() => void 0);
      }
    }
    async function countClientRefCustomers(): Promise<number> {
      const client = new Client({
        host: "127.0.0.1",
        port: 5433,
        user: "atw",
        password: "atw",
        database: "atw",
      });
      await client.connect();
      try {
        // customer is PII-flagged and is EXCLUDED from client_ref by
        // importDump. Use a different table we know lands in client_ref
        // — `product` is the canonical indexable source for Aurelia.
        const res = await client.query<{ n: string }>(
          "SELECT count(*)::text AS n FROM client_ref.product",
        );
        return Number(res.rows[0].n);
      } finally {
        await client.end().catch(() => void 0);
      }
    }

    const migrationsBefore = await countMigrations();
    const productsBefore = await countClientRefCustomers();
    expect(migrationsBefore).toBeGreaterThan(0);
    expect(productsBefore).toBeGreaterThan(0);

    // --- Run 2: same inputs, --force. Expect every entity re-enriched.
    let run2Calls = 0;
    const run2 = await runBuild({
      projectRoot: tmpRoot,
      dryRun: false,
      force: true,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          run2Calls += 1;
          return {
            contentText: stableEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    });

    expect(run2.manifest.result).toBe("success");
    // (a) Opus called for every entity under --force.
    expect(run2Calls).toBe(totalEntities);
    expect(run2.manifest.totals.enriched).toBe(totalEntities);
    // The skipped_unchanged counter must be 0 — --force overrides
    // source_hash short-circuits.
    expect(run2.manifest.totals.skipped_unchanged).toBe(0);

    // (b) migrations ledger unchanged: no new rows.
    const migrationsAfter = await countMigrations();
    expect(migrationsAfter).toBe(migrationsBefore);

    // (c) client_ref row count unchanged — dump was not re-imported.
    // (We rely on the dump's deterministic INSERT set; if re-import ran,
    // the row counts might double or shift.)
    const productsAfter = await countClientRefCustomers();
    expect(productsAfter).toBe(productsBefore);
  }, 30 * 60 * 1000);
});

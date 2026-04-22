/**
 * T096 / US8 — Determinism integration test.
 *
 * Runs `/atw.build` twice against an unchanged Aurelia fixture and asserts:
 *   1. Every rendered `backend/src/*.ts` has a byte-identical sha256
 *      across the two runs (FR-074, SC-016).
 *   2. `dist/widget.js` and `dist/widget.css` are byte-identical across
 *      the two runs (SC-016).
 *   3. A sample of `atw_documents.embedding` vectors is bit-identical
 *      across runs (FR-063 — embeddings must be reproducible).
 *
 * Requires Docker. Auto-skips without ATW_E2E_DOCKER=1.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { createHash } from "node:crypto";
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
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-build-determinism-"));
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
  // Return the same string every call so Opus-derived output is
  // deterministic input to the render + embed path.
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

async function sha256OfTree(root: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        await walk(abs);
      } else if (ent.isFile()) {
        const buf = await fs.readFile(abs);
        const rel = path.relative(root, abs).replace(/\\/g, "/");
        out[rel] = createHash("sha256").update(buf).digest("hex");
      }
    }
  }
  await walk(root);
  return out;
}

describe.skipIf(!DOCKER_AVAILABLE)("build determinism (T096 / SC-016 / FR-063)", () => {
  it("two back-to-back builds produce byte-identical rendered code + bundle + embeddings", async () => {
    await seedProject(tmpRoot);

    const { runBuild } = await import(
      "../../packages/scripts/src/orchestrator.js"
    );

    const commonFlags = {
      projectRoot: tmpRoot,
      dryRun: false,
      force: false,
      yes: true,
      noEnrich: false,
      concurrency: 10,
      opusClient: {
        async createMessage() {
          return {
            contentText: stableEnrichment(),
            usage: { input_tokens: 1200, output_tokens: 400 },
          };
        },
      },
    };

    const run1 = await runBuild(commonFlags);
    expect(run1.manifest.result).toBe("success");

    // Snapshot rendered backend + widget bundle hashes after run 1.
    const backendDir = path.join(tmpRoot, "backend", "src");
    const widgetDistDir = path.join(tmpRoot, "dist");
    const backendHashes1 = await sha256OfTree(backendDir);
    const widgetHashes1 = await sha256OfTree(widgetDistDir);

    // Sample a few embeddings from atw_documents AFTER run 1.
    const { Client } = await import("pg");
    async function sampleEmbeddingSignatures(): Promise<Record<string, string>> {
      const client = new Client({
        host: "127.0.0.1",
        port: 5433,
        user: "atw",
        password: "atw",
        database: "atw",
      });
      await client.connect();
      try {
        // `embedding::text` yields the canonical vector literal; hashing it
        // gives us a compact bit-identity signature per (type,id).
        const res = await client.query<{ entity_type: string; entity_id: string; sig: string }>(
          `SELECT entity_type, entity_id,
                  encode(digest(embedding::text, 'sha256'), 'hex') AS sig
             FROM atw_documents
            ORDER BY entity_type, entity_id
            LIMIT 10`,
        );
        const out: Record<string, string> = {};
        for (const row of res.rows) {
          out[`${row.entity_type}/${row.entity_id}`] = row.sig;
        }
        return out;
      } finally {
        await client.end().catch(() => void 0);
      }
    }

    // `pgcrypto` is available in the pgvector image. If `digest()` isn't
    // registered, enable it; safe to run multiple times.
    const { Client: PrepClient } = await import("pg");
    const prep = new PrepClient({
      host: "127.0.0.1",
      port: 5433,
      user: "atw",
      password: "atw",
      database: "atw",
    });
    await prep.connect();
    try {
      await prep.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    } finally {
      await prep.end().catch(() => void 0);
    }

    const embeds1 = await sampleEmbeddingSignatures();

    // --- Run 2: same inputs, same Opus stub. Every output must match
    // byte-for-byte.
    const run2 = await runBuild(commonFlags);
    expect(["success", "nothing-to-do"]).toContain(run2.manifest.result);

    const backendHashes2 = await sha256OfTree(backendDir);
    const widgetHashes2 = await sha256OfTree(widgetDistDir);
    const embeds2 = await sampleEmbeddingSignatures();

    // SC-016 rendered code byte-identity
    expect(Object.keys(backendHashes2).sort()).toEqual(
      Object.keys(backendHashes1).sort(),
    );
    for (const f of Object.keys(backendHashes1)) {
      expect(
        backendHashes2[f],
        `backend/src/${f} hash drift: ${backendHashes1[f]} -> ${backendHashes2[f]}`,
      ).toBe(backendHashes1[f]);
    }

    // SC-016 widget bundle byte-identity
    expect(widgetHashes2["widget.js"]).toBe(widgetHashes1["widget.js"]);
    expect(widgetHashes2["widget.css"]).toBe(widgetHashes1["widget.css"]);

    // FR-063 embedding bit-identity
    expect(Object.keys(embeds2).sort()).toEqual(Object.keys(embeds1).sort());
    for (const k of Object.keys(embeds1)) {
      expect(embeds2[k], `embedding sig drift for ${k}`).toBe(embeds1[k]);
    }
  }, 30 * 60 * 1000);
});

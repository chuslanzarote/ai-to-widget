/**
 * T090 / US7 — per-entity atomicity unit test.
 *
 * We can't spin up Postgres for a unit test, so we isolate the flow to
 * `upsertDocument` and its pre-flight validator. The contract: if the
 * embedding dimension is wrong (simulating a post-Opus embedding
 * failure), `upsertDocument` must throw BEFORE connecting to Postgres so
 * there is no possibility of a partial row.
 *
 * This mirrors what happens in the orchestrator: the per-entity pipeline
 * — assemble → Opus → validate → embed → upsert — writes to the database
 * exactly once, via a single atomic INSERT ... ON CONFLICT statement. If
 * any earlier step throws, the catch block classifies it as a failure
 * and no row is written, guaranteeing the database remains consistent
 * after SIGINT or unexpected errors.
 */
import { describe, it, expect } from "vitest";
import { upsertDocument } from "../src/upsert-document.js";

describe("upsertDocument atomicity (T090 / US7)", () => {
  it("throws EMBED_DIM_MISMATCH before touching Postgres when embedding is the wrong size", async () => {
    // 383 dims instead of 384 → validator rejects pre-connect.
    const badEmbedding = new Array(383).fill(0.1);
    await expect(
      upsertDocument({
        row: {
          entity_type: "test_entity",
          entity_id: "abc",
          document: "body",
          facts: [{ claim: "x", source: "primary_record.id" }],
          categories: {},
          embedding: badEmbedding,
          source_hash: "sha256:" + "0".repeat(64),
          opus_tokens: { input_tokens: 1, output_tokens: 1 },
        },
        connectionConfig: {
          // Intentionally impossible. The throw should happen before the
          // pg Client is even constructed, so this host is never dialed.
          host: "127.0.0.1",
          port: 1,
          user: "atw",
          password: "atw",
          database: "atw",
        },
      }),
    ).rejects.toMatchObject({ code: "EMBED_DIM_MISMATCH" });
  });

  it("validator runs first → no partial row on invalid input", async () => {
    // If validation happens first, we never attempt the Postgres
    // connection; the error is predictable (dim-mismatch) not a network
    // ECONNREFUSED from the bogus port.
    const p = upsertDocument({
      row: {
        entity_type: "t",
        entity_id: "id",
        document: "d",
        facts: [],
        categories: {},
        embedding: [1, 2, 3],
        source_hash: "sha256:" + "a".repeat(64),
        opus_tokens: { input_tokens: 0, output_tokens: 0 },
      },
      connectionConfig: {
        host: "127.0.0.1",
        port: 1,
        user: "atw",
        password: "atw",
        database: "atw",
      },
    });
    await expect(p).rejects.toMatchObject({ code: "EMBED_DIM_MISMATCH" });
  });
});

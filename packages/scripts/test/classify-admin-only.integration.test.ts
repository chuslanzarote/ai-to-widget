/**
 * T073 / US6 — Integration test for admin-only OpenAPI (FR-014, SC-005).
 *
 * Wires the real `/atw.api` → `classifyActions` pipeline end-to-end
 * against the `admin-only.json` fixture. What it proves:
 *
 *   1. `parseOpenAPI` ingests the fixture cleanly (no fixture rot).
 *   2. `classifyActions` returns a manifest with `included: []` — the
 *      classifier produced *zero* shopper-safe actions, which is the
 *      degenerate case the widget boots chat-only for.
 *   3. Every operation the fixture declares appears in `excluded[]` —
 *      none silently vanish. The `/admin/*` paths land with reason
 *      `admin-prefix`; other non-shopper-safe operations land with
 *      whatever heuristic rule matched (e.g. `missing-request-schema`
 *      for `POST /internal/*` without a requestBody). The list is the
 *      reviewable audit trail Feature 006 promised.
 *   4. `orphaned` is empty (no prior manifest; nothing drifted).
 *   5. Opus is never called because Stage 1 produced zero candidates —
 *      the stub throws if it is. This exercises the
 *      `opusNarrowingReview` short-circuit at candidates.length === 0.
 *
 * Scope notes:
 *   - "Build exits 0" and the FR-014 stderr warning are orchestrator
 *     concerns requiring Postgres; those are pinned structurally by
 *     T071 (render-tools-ts.empty.unit.test.ts) and covered live by
 *     T069's docker-gated suite. This test sits one level down, where
 *     the no-Postgres classify path can be exercised deterministically.
 *   - The fixture's `/internal/flush-cache` operation is *not* on
 *     /admin/*, so its reason is not `admin-prefix`. We document that
 *     reality rather than pretending otherwise — the classifier is
 *     still correct (the op has no requestBody on a POST, so rule 3
 *     fires). If a future curator renames /internal/* under /admin/*,
 *     the expected-reason set here will flex accordingly.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { parseOpenAPI } from "../src/parse-openapi.js";
import { classifyActions } from "../src/classify-actions.js";
import type { OpusClient } from "../src/enrich-entity.js";

const FIXTURE = path.join(
  __dirname,
  "fixtures",
  "openapi",
  "admin-only.json",
);

// Stage 1 must leave zero candidates; if Opus is called the test fails.
const throwingOpus: OpusClient = {
  async createMessage() {
    throw new Error(
      "opusClient should not be called — Stage 1 heuristic already excluded every operation",
    );
  },
};

describe("classify admin-only OpenAPI (T073 / US6, FR-014, SC-005)", () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-t073-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("produces included: [] and excludes every operation with a reviewable reason", async () => {
    const rawBytes = await fs.readFile(FIXTURE, "utf8");
    const parseRes = await parseOpenAPI({
      source: FIXTURE,
      body: rawBytes,
    });
    const parsed = parseRes.parsed;
    const rawDoc = parseRes.raw;

    // Sanity: the fixture declares 4 operations (GETs are NOT skipped
    // by Stage 1 heuristic; only OPTIONS/HEAD are).
    expect(parsed.operations.length).toBe(4);

    const { manifest, warnings } = await classifyActions({
      parsed,
      rawDoc,
      openapiSha256: "sha256:" + "a".repeat(64),
      modelSnapshot: "claude-opus-4-7",
      opusClient: throwingOpus,
      classifiedAt: "2026-04-23T00:00:00Z",
    });

    // (2) Zero included — the widget will boot chat-only.
    expect(manifest.included).toEqual([]);

    // (3) Every operation accounted for in excluded[].
    expect(manifest.excluded.length).toBe(parsed.operations.length);
    const excludedPaths = new Set(
      manifest.excluded.map((e) => `${e.method} ${e.path}`),
    );
    expect(excludedPaths.has("POST /admin/users")).toBe(true);
    expect(excludedPaths.has("GET /admin/users")).toBe(true);
    expect(excludedPaths.has("DELETE /admin/products/{id}")).toBe(true);
    expect(excludedPaths.has("POST /internal/flush-cache")).toBe(true);

    // Every /admin/* operation must carry `admin-prefix` — the
    // reviewable audit-trail hook Feature 006 promised Builder owners.
    const adminOps = manifest.excluded.filter((e) =>
      e.path.startsWith("/admin/"),
    );
    expect(adminOps.length).toBe(3);
    for (const op of adminOps) {
      expect(op.reason).toBe("admin-prefix");
    }

    // The /internal/* op lands with whichever rule fires first; it
    // must not be `admin-prefix` (it is not under /admin/*), and it
    // must not be `opus-narrowed` (Opus never ran). Anything else is
    // acceptable — the point is that nothing silently slips through.
    const internal = manifest.excluded.find(
      (e) => e.path === "/internal/flush-cache",
    );
    expect(internal).toBeDefined();
    expect(internal!.reason).not.toBe("admin-prefix");
    expect(internal!.reason).not.toBe("opus-narrowed");

    // (4) No prior manifest was supplied → orphaned must be empty.
    expect(manifest.orphaned).toEqual([]);

    // Provenance: openapiSha256 + classifiedAt + classifierModel frozen
    // — byte-idempotency depends on this.
    expect(manifest.provenance.classifiedAt).toBe("2026-04-23T00:00:00Z");
    expect(manifest.provenance.classifierModel).toBe("claude-opus-4-7");

    // No assembly warnings expected (no name collisions possible on []).
    expect(warnings).toEqual([]);
  });

  it("re-classify with the same inputs is byte-idempotent on the manifest object", async () => {
    // Determinism red-line: same inputs → same manifest. JSON.stringify
    // is the cheap structural check; render-action-manifest.ts owns the
    // byte-level markdown contract separately.
    const rawBytes = await fs.readFile(FIXTURE, "utf8");
    const { parsed, raw: rawDoc } = await parseOpenAPI({
      source: FIXTURE,
      body: rawBytes,
    });

    const baseArgs = {
      parsed,
      rawDoc,
      openapiSha256: "sha256:" + "a".repeat(64),
      modelSnapshot: "claude-opus-4-7",
      opusClient: throwingOpus,
      classifiedAt: "2026-04-23T00:00:00Z",
    };

    const first = await classifyActions(baseArgs);
    const second = await classifyActions(baseArgs);
    expect(JSON.stringify(second.manifest)).toBe(
      JSON.stringify(first.manifest),
    );
  });
});


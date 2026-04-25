/**
 * Feature 008 / T055 / T060 — text-exactness regression for every
 * Builder-facing diagnostic emitter.
 *
 * Each case below reproduces the string a live build would emit and
 * asserts it byte-for-byte against
 * `specs/008-atw-hardening/contracts/builder-diagnostics.md`.
 * Interpolated identifiers (tool names, paths, entity names) are
 * allowed; everything else is pinned.
 *
 * If this file fails after a diagnostic refactor, the refactor broke
 * the public contract — update the contract first, then the emitter.
 */
import { describe, it, expect } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { HashIndexSchemaMismatchError, parseInputsPositional } from "../src/hash-inputs.js";
import { SchemaMapZeroEntityError } from "../src/lib/markdown.js";
import { MissingCredentialSourceError } from "../src/parse-action-manifest.js";
import { formatRuntimeOnlyHalt } from "../src/validate-artifacts.js";
import { formatSqlDumpHalt } from "../src/lib/diagnostics.js";

describe("D-HASHMISMATCH (FR-006)", () => {
  it("matches contracts/builder-diagnostics.md verbatim", () => {
    const err = new HashIndexSchemaMismatchError("{unexpected}");
    expect(err.message).toBe(
      `ERROR: hash-index.json failed schema validation.\n` +
        `Expected shape: { schema_version: "1", files: Record<relativePath, sha256Hex> }\n` +
        `Found: {unexpected}\n\n` +
        `Fix: delete .atw/artifacts/hash-index.json and re-run /atw.build.`,
    );
  });
});

describe("D-INPUTSARGS (FR-007)", () => {
  it("matches contracts/builder-diagnostics.md verbatim", () => {
    let thrown: Error | null = null;
    try {
      parseInputsPositional(["--bogus-flag"]);
    } catch (err) {
      thrown = err as Error;
    }
    expect(thrown).not.toBeNull();
    expect(thrown!.message).toBe(
      `ERROR: --inputs expected one or more file paths (space-separated).\n\n` +
        `Usage: atw-hash-inputs --inputs a.md b.md c.md`,
    );
  });
});

describe("D-ZEROENTITY (FR-009)", () => {
  it("variant A — H3 detected — matches contract verbatim", () => {
    const err = new SchemaMapZeroEntityError("A");
    expect(err.message).toBe(
      `ERROR: Zero entities parsed from schema-map.md.\n` +
        `Detected H3 "### Entity:" headings — the parser expects H2 "## Entity:".\n\n` +
        `Fix: convert your H3 headings one level up, or regenerate the file with /atw.schema.\n` +
        `See examples/sample-schema-map.md for the expected convention.`,
    );
  });

  it("variant B — no Entity headings — matches contract verbatim", () => {
    const err = new SchemaMapZeroEntityError("B");
    expect(err.message).toBe(
      `ERROR: Zero entities parsed from schema-map.md.\n` +
        `Expected H2 headings of the form "## Entity: <name>". Found none.\n\n` +
        `Fix: see examples/sample-schema-map.md for the expected convention, or regenerate with /atw.schema.`,
    );
  });
});

// Feature 009 / FR-001 / FR-005 — classify-actions is now a single LLM
// call with no heuristic warnings; the D-CLASSIFYAUTH bearer-JWT
// exclusion text was removed. The diagnostic itself lives only in the
// 008 contract doc and no longer ships in any emitter.

describe("D-CREDSRC (FR-013)", () => {
  it("matches contracts/builder-diagnostics.md verbatim", () => {
    const err = new MissingCredentialSourceError([
      { toolName: "addToCart", method: "POST", path: "/cart" },
      { toolName: "getMyOrders", method: "GET", path: "/me/orders" },
    ]);
    expect(err.message).toBe(
      `ERROR: The following tool(s) would ship without a credential source:\n\n` +
        `  • addToCart  (POST /cart)\n` +
        `  • getMyOrders  (GET /me/orders)\n\n` +
        `These operations need to declare bearer security in your OpenAPI document.\n\n` +
        `Add EITHER:\n\n` +
        `  (a) Per-operation security — on each affected operation:\n\n` +
        `      security:\n` +
        `        - bearerAuth: []\n\n` +
        `  (b) Global security — at the document root:\n\n` +
        `      security:\n` +
        `        - bearerAuth: []\n\n` +
        `      components:\n` +
        `        securitySchemes:\n` +
        `          bearerAuth:\n` +
        `            type: http\n` +
        `            scheme: bearer\n` +
        `            bearerFormat: JWT\n\n` +
        `See .atw/artifacts/host-requirements.md for the full host contract.\n\n` +
        `Build halted.`,
    );
  });
});

describe("D-RUNTIMEONLY (FR-012)", () => {
  it("matches contracts/builder-diagnostics.md verbatim", () => {
    const text = formatRuntimeOnlyHalt("cart", "cart");
    expect(text).toBe(
      `ERROR: Tool group "cart" references entity "cart" which is not present in schema-map.md.\n\n` +
        `Options:\n` +
        `  (a) If this group legitimately targets per-shopper runtime endpoints that are not indexed, flag\n` +
        `      the group as runtime-only:\n\n` +
        `      ## Tools: cart (runtime-only)\n\n` +
        `  (b) If this is an indexed entity, add it to schema-map.md.\n\n` +
        `Build halted.`,
    );
  });
});

describe("D-SQLDUMP (FR-004)", () => {
  it("variant without captured README — full pg_dump command", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-t055-"));
    const text = await formatSqlDumpHalt({
      name: "schema",
      projectRoot: tmp,
      host: "localhost",
      port: 5432,
      user: "atw",
      database: "shop",
    });
    expect(text).toBe(
      `ERROR: .atw/inputs/schema.sql is missing.\n\n` +
        `Run this command to produce it:\n\n` +
        `  pg_dump \\\n` +
        `    --host=localhost \\\n` +
        `    --port=5432 \\\n` +
        `    --username=atw \\\n` +
        `    --dbname=shop \\\n` +
        `    --schema-only \\\n` +
        `    --no-owner --no-privileges \\\n` +
        `    > .atw/inputs/schema.sql\n\n` +
        `Connection details are derived from your project config. See .atw/inputs/README.md\n` +
        `for the exact invocation already captured during /atw.schema.\n`,
    );
  });

  it("variant with captured README — short pointer", async () => {
    const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-t055-"));
    const inputsDir = path.join(tmp, ".atw", "inputs");
    await fs.mkdir(inputsDir, { recursive: true });
    await fs.writeFile(path.join(inputsDir, "README.md"), "# captured\n");
    const text = await formatSqlDumpHalt({
      name: "schema",
      projectRoot: tmp,
    });
    expect(text).toBe(
      `ERROR: .atw/inputs/schema.sql is missing.\n\n` +
        `Run the command captured in .atw/inputs/README.md to produce it.\n`,
    );
  });
});

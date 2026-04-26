import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import {
  computeHashResults,
  loadState,
  writeState,
  hashFile,
} from "../../packages/scripts/src/hash-inputs.js";
import { writeAureliaArtifacts } from "./fixtures/aurelia-artifacts.js";

let tmpRoot: string;

beforeEach(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "atw-idempotency-"));
  await fs.mkdir(path.join(tmpRoot, "state"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "inputs"), { recursive: true });
  await writeAureliaArtifacts(tmpRoot);
});

afterEach(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("full-flow idempotency (T091 / SC-006, FR-049 L1)", () => {
  it("reports zero changes on the second pass when no input was touched", async () => {
    const inputPath = path.join(tmpRoot, "inputs", "schema.sql");
    await fs.writeFile(inputPath, "CREATE TABLE product (id int);", "utf8");

    const statePath = path.join(tmpRoot, "state", "input-hashes.json");

    const first = await computeHashResults({
      rootDir: tmpRoot,
      inputs: [inputPath],
      previous: null,
    });
    expect(first[0].changed).toBe(true);
    await writeState(statePath, first);

    const prior = await loadState(statePath);
    expect(prior).not.toBeNull();

    const second = await computeHashResults({
      rootDir: tmpRoot,
      inputs: [inputPath],
      previous: prior,
    });
    expect(second[0].changed).toBe(false);
    expect(second[0].sha256).toBe(first[0].sha256);
  });

  it("hashes artifacts deterministically across runs (SC-006)", async () => {
    const briefPath = path.join(tmpRoot, "config", "brief.md");
    const first = await hashFile(briefPath);
    const second = await hashFile(briefPath);
    expect(first).toBe(second);
  });

  it("flags Level-1 refinement when every hash matches prior state", async () => {
    const briefPath = path.join(tmpRoot, "config", "brief.md");
    const schemaPath = path.join(tmpRoot, "artifacts", "schema-map.md");
    const inputs = [briefPath, schemaPath];
    const statePath = path.join(tmpRoot, "state", "input-hashes.json");

    const first = await computeHashResults({ rootDir: tmpRoot, inputs, previous: null });
    await writeState(statePath, first);
    const prior = await loadState(statePath);

    const second = await computeHashResults({ rootDir: tmpRoot, inputs, previous: prior });
    const allUnchanged = second.every((r) => !r.changed);
    expect(allUnchanged).toBe(true);
  });

  // Feature 009 dropped the explicit FR-049 L1 refinement language from
  // commands/atw.*.md — the four command files no longer mention
  // atw-hash-inputs, "Level 1", or "No LLM call". The runtime contract
  // remains, but the documentation surface moved into the per-command
  // bodies and is exercised by the hash-based behaviour assertion above.
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseSchemaFromText } from "../../packages/scripts/src/parse-schema.js";
import { computeHashResults, writeState, loadState } from "../../packages/scripts/src/hash-inputs.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, "..", "fixtures", "aurelia", "schema.sql");

describe("atw.schema re-run semantics (T067 / FR-049)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-schema-rerun-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("produces byte-identical parsed output when the input is unchanged (L1)", async () => {
    const sql = await fs.readFile(SCHEMA_PATH, "utf8");
    const a = await parseSchemaFromText({ schemaSql: sql });
    const b = await parseSchemaFromText({ schemaSql: sql });
    expect(JSON.stringify(a.parsed)).toBe(JSON.stringify(b.parsed));
  });

  it("hash state is stable across runs on identical input", async () => {
    // seed .atw layout
    const atw = path.join(tmp, ".atw");
    await fs.mkdir(path.join(atw, "state"), { recursive: true });
    await fs.mkdir(path.join(atw, "inputs"), { recursive: true });
    const inputCopy = path.join(atw, "inputs", "schema.sql");
    await fs.copyFile(SCHEMA_PATH, inputCopy);

    const first = await computeHashResults({ rootDir: atw, inputs: [inputCopy], previous: null });
    expect(first[0].changed).toBe(true);
    await writeState(path.join(atw, "state", "input-hashes.json"), first);

    const prev = await loadState(path.join(atw, "state", "input-hashes.json"));
    const second = await computeHashResults({ rootDir: atw, inputs: [inputCopy], previous: prev });
    expect(second[0].changed).toBe(false);
    expect(second[0].sha256).toBe(first[0].sha256);
  });

  it("hash state flips `changed` when the input is edited", async () => {
    const atw = path.join(tmp, ".atw");
    await fs.mkdir(path.join(atw, "state"), { recursive: true });
    await fs.mkdir(path.join(atw, "inputs"), { recursive: true });
    const inputCopy = path.join(atw, "inputs", "schema.sql");
    await fs.copyFile(SCHEMA_PATH, inputCopy);

    const first = await computeHashResults({ rootDir: atw, inputs: [inputCopy], previous: null });
    await writeState(path.join(atw, "state", "input-hashes.json"), first);

    // Builder tweaks the schema (e.g., adds a trailing comment); structural hash must move.
    await fs.appendFile(inputCopy, "\n-- new comment\nCREATE TABLE extra (id int PRIMARY KEY);\n");
    const prev = await loadState(path.join(atw, "state", "input-hashes.json"));
    const second = await computeHashResults({ rootDir: atw, inputs: [inputCopy], previous: prev });
    expect(second[0].changed).toBe(true);
    expect(second[0].sha256).not.toBe(first[0].sha256);
  });
});

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  hashFile,
  computeHashResults,
  writeState,
  loadState,
} from "../src/hash-inputs.js";

describe("hash-inputs contract", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-hash-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("produces a stable SHA-256 across CRLF/LF differences", async () => {
    const lfFile = path.join(tmp, "lf.sql");
    const crlfFile = path.join(tmp, "crlf.sql");
    await fs.writeFile(lfFile, "CREATE TABLE foo (id int);\nSELECT 1;\n");
    await fs.writeFile(crlfFile, "CREATE TABLE foo (id int);\r\nSELECT 1;\r\n");
    const lfHash = await hashFile(lfFile);
    const crlfHash = await hashFile(crlfFile);
    expect(lfHash).toBe(crlfHash);
    expect(lfHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("flags a file as changed on first run (no previous state)", async () => {
    const input = path.join(tmp, "input.sql");
    await fs.writeFile(input, "CREATE TABLE x ();");
    const results = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: null,
    });
    expect(results).toHaveLength(1);
    expect(results[0].changed).toBe(true);
    expect(results[0].previousSha256).toBeNull();
    expect(results[0].kind).toBe("sql-dump");
  });

  it("reports `changed: false` when content is identical and state present", async () => {
    const input = path.join(tmp, "input.sql");
    const statePath = path.join(tmp, "state", "input-hashes.json");
    await fs.writeFile(input, "CREATE TABLE y ();");
    const first = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: null,
    });
    await writeState(statePath, first);
    const state = await loadState(statePath);
    expect(state).not.toBeNull();

    const second = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: state,
    });
    expect(second[0].changed).toBe(false);
    expect(second[0].previousSha256).toBe(first[0].sha256);
  });

  it("flags a file as changed after content modification", async () => {
    const input = path.join(tmp, "input.sql");
    const statePath = path.join(tmp, "state", "input-hashes.json");
    await fs.writeFile(input, "CREATE TABLE v ();");
    const first = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: null,
    });
    await writeState(statePath, first);
    const state = await loadState(statePath);
    await fs.writeFile(input, "CREATE TABLE v2 ();");
    const second = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: state,
    });
    expect(second[0].changed).toBe(true);
    expect(second[0].sha256).not.toBe(first[0].sha256);
  });

  it("writes the state file atomically with a valid zod shape", async () => {
    const input = path.join(tmp, "brief.txt");
    const statePath = path.join(tmp, "state", "input-hashes.json");
    await fs.writeFile(input, "my brief notes");
    const results = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: null,
    });
    await writeState(statePath, results);
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed.version).toBe(1);
    expect(parsed.entries).toHaveLength(1);
    expect(parsed.entries[0].kind).toBe("brief-input");
    expect(parsed.entries[0].path).toBe("brief.txt");
  });
});

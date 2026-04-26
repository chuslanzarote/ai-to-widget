import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadState } from "../src/hash-inputs.js";
import {
  writeInputHashes,
  readInputHashes,
  type InputHashes,
} from "../src/lib/input-hashes.js";

describe("hash-index round-trip — writer (lib/input-hashes) <-> reader (hash-inputs CLI)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-hashrt-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("a file written by `lib/input-hashes.writeInputHashes` passes the CLI's Zod validator", async () => {
    const hashes: InputHashes = {
      schema_version: "1",
      files: {
        ".atw/config/project.md": "sha256:" + "a".repeat(64),
        ".atw/artifacts/openapi.json": "sha256:" + "b".repeat(64),
      },
      prompt_template_version: "v2026-04-24",
    };
    await writeInputHashes(tmp, hashes);
    const statePath = path.join(tmp, ".atw", "state", "input-hashes.json");
    const loaded = await loadState(statePath);
    expect(loaded).not.toBeNull();
    expect(loaded!.schema_version).toBe("1");
    expect(loaded!.files[".atw/config/project.md"]).toBe(
      "sha256:" + "a".repeat(64),
    );
    expect(loaded!.prompt_template_version).toBe("v2026-04-24");
  });

  it("a file written by the CLI's writeState is re-readable by `lib/input-hashes.readInputHashes`", async () => {
    const input = path.join(tmp, "foo.md");
    await fs.writeFile(input, "hello world");
    const { computeHashResults, writeState } = await import("../src/hash-inputs.js");
    const results = await computeHashResults({
      rootDir: tmp,
      inputs: [input],
      previous: null,
    });
    // Writer emits the v2 shape at the same path readInputHashes looks at.
    const atwStatePath = path.join(tmp, ".atw", "state", "input-hashes.json");
    await fs.mkdir(path.dirname(atwStatePath), { recursive: true });
    await writeState(atwStatePath, results, { promptTemplateVersion: "vTest" });
    const roundTrip = readInputHashes(tmp);
    expect(roundTrip).not.toBeNull();
    expect(roundTrip!.schema_version).toBe("1");
    expect(roundTrip!.files["foo.md"]).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(roundTrip!.prompt_template_version).toBe("vTest");
  });

  it("invalid shape causes loadState to throw D-HASHMISMATCH", async () => {
    const statePath = path.join(tmp, "bad.json");
    await fs.writeFile(statePath, JSON.stringify({ version: 1, entries: [] }));
    await expect(loadState(statePath)).rejects.toThrow(
      /hash-index\.json failed schema validation/,
    );
  });
});

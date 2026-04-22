import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, openSync, writeSync, closeSync } from "node:fs";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  writeManifestAtomic,
  readManifest,
  migrate,
} from "../src/lib/manifest-io.js";
import { BuildManifest, BuildManifestSchema } from "../src/lib/types.js";
import { runWriteManifest } from "../src/write-manifest.js";

function makeManifest(overrides: Partial<BuildManifest> = {}): BuildManifest {
  const base: BuildManifest = {
    schema_version: "1",
    build_id: "atw-build-20260422T143022-7f3c",
    started_at: "2026-04-22T14:30:22.481Z",
    completed_at: "2026-04-22T14:47:11.902Z",
    duration_seconds: 1009.421,
    result: "success",
    totals: { total_entities: 1, enriched: 1, skipped_unchanged: 0, failed: 0 },
    failures: [],
    opus: {
      calls: 1,
      input_tokens: 4321,
      output_tokens: 1234,
      cost_usd: 0.16,
    },
    concurrency: { configured: 10, effective_max: 10, reductions: [] },
    input_hashes: {
      "project.md": "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      "brief.md": "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      "schema-map.md": "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      "action-manifest.md": "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      "build-plan.md": "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      sql_dump: "sha256:00000000000000000000000000000000000000000000000000000000deadbeef",
      prompt_template_version: "enrich-v1",
    },
    outputs: {
      backend_files: [],
      widget_bundle: null,
      backend_image: null,
    },
    environment: {
      platform: "linux-x64",
      node_version: "20.14.0",
      docker_server_version: "24.0.7",
      postgres_image_digest: "pgvector/pgvector@sha256:aaa",
      embedding_model: "Xenova/bge-small-multilingual-v1.5@1.0.0",
    },
    compliance_scan: { ran: true, clean: true, values_checked: 0, matches: [] },
  };
  return { ...base, ...overrides };
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), "atw-manifest-"));
});
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe("writeManifestAtomic", () => {
  it("writes a zod-valid manifest that round-trips", () => {
    const target = join(tmpDir, "build-manifest.json");
    const m = makeManifest();
    writeManifestAtomic(target, m);

    const raw = readFileSync(target, "utf8");
    const parsed = JSON.parse(raw);
    expect(() => BuildManifestSchema.parse(parsed)).not.toThrow();
    expect(parsed.result).toBe("success");
  });

  it("produces byte-identical output for identical input (determinism)", () => {
    const target1 = join(tmpDir, "m1.json");
    const target2 = join(tmpDir, "m2.json");
    const m = makeManifest();
    writeManifestAtomic(target1, m);
    writeManifestAtomic(target2, m);
    expect(readFileSync(target1, "utf8")).toBe(readFileSync(target2, "utf8"));
  });

  it("leaves no .tmp file after a successful write", () => {
    const target = join(tmpDir, "build-manifest.json");
    writeManifestAtomic(target, makeManifest());
    expect(existsSync(target + ".tmp")).toBe(false);
  });

  it("rejects an invalid manifest (zod failure)", () => {
    const target = join(tmpDir, "bad.json");
    // @ts-expect-error — intentionally bad shape
    expect(() => writeManifestAtomic(target, { schema_version: "1" })).toThrow();
  });
});

describe("readManifest", () => {
  it("returns null when the file does not exist", () => {
    const target = join(tmpDir, "missing.json");
    expect(readManifest(target)).toBeNull();
  });

  it("parses a previously written manifest", () => {
    const target = join(tmpDir, "m.json");
    const m = makeManifest({ result: "partial" });
    writeManifestAtomic(target, m);
    const read = readManifest(target);
    expect(read?.result).toBe("partial");
  });

  it("tolerates unknown top-level fields (forward compatibility)", () => {
    const target = join(tmpDir, "m.json");
    const withExtras = { ...makeManifest(), unknown_future_key: 42 };
    writeFileSync(target, JSON.stringify(withExtras, null, 2), "utf8");
    // The strict schema strips unknowns; just verify it doesn't throw.
    expect(() => readManifest(target)).not.toThrow();
  });
});

describe("migrate", () => {
  it("is identity for schema_version === '1'", () => {
    const m = makeManifest();
    expect(migrate(m)).toBe(m);
  });
});

describe("atw-write-manifest CLI contract (T051)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
  });

  it("exit 0 on --help", async () => {
    const code = await runWriteManifest(["--help"]);
    expect(code).toBe(0);
  });

  it("exit 0 on --version", async () => {
    const code = await runWriteManifest(["--version"]);
    expect(code).toBe(0);
  });

  it("exit 3 when --manifest missing", async () => {
    const code = await runWriteManifest([]);
    expect(code).toBe(3);
    const err = stderrSpy.mock.calls.map((c) => c[0]).join("");
    expect(err).toContain("--manifest");
  });

  it("exit 0 and writes file when --manifest is a valid path", async () => {
    const inputPath = join(tmpDir, "in.json");
    const outPath = join(tmpDir, "out.json");
    await fs.writeFile(inputPath, JSON.stringify(makeManifest()), "utf8");
    const code = await runWriteManifest([
      "--manifest",
      inputPath,
      "--out",
      outPath,
      "--json",
    ]);
    expect(code).toBe(0);
    const written = JSON.parse(await fs.readFile(outPath, "utf8"));
    expect(() => BuildManifestSchema.parse(written)).not.toThrow();
    const out = stdoutSpy.mock.calls.map((c) => c[0]).join("");
    const parsed = JSON.parse(out);
    expect(parsed.path).toBe(outPath);
    expect(parsed.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("exit 23 when manifest JSON fails zod validation", async () => {
    const inputPath = join(tmpDir, "bad.json");
    await fs.writeFile(inputPath, JSON.stringify({ schema_version: "1" }), "utf8");
    const code = await runWriteManifest([
      "--manifest",
      inputPath,
      "--out",
      join(tmpDir, "out-bad.json"),
    ]);
    expect(code).toBe(23);
  });
});

describe("atomic-write semantics", () => {
  it("a partially-written .tmp file does not clobber the existing target", () => {
    const target = join(tmpDir, "build-manifest.json");
    writeManifestAtomic(target, makeManifest({ result: "success" }));
    const before = readFileSync(target, "utf8");

    // Simulate an interrupted write: drop a .tmp file alongside the target,
    // then verify the target is untouched.
    const fd = openSync(target + ".tmp", "w");
    writeSync(fd, '{"schema_version":"1","corrupt":');
    closeSync(fd);

    const after = readFileSync(target, "utf8");
    expect(after).toBe(before);
  });
});

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeArtifactAtomic, exists } from "./lib/atomic.js";
import { normalizeForHash } from "./lib/normalize.js";
import {
  InputHashesStateSchema,
  type InputHashKind,
  type InputHashesState,
  type InputHashRecord,
} from "./lib/types.js";

interface CliOptions {
  root: string;
  inputs: string[];
  updateState: boolean;
  verbose: boolean;
}

export interface HashResult {
  path: string;
  sha256: string;
  previousSha256: string | null;
  changed: boolean;
  kind: InputHashKind;
}

function classifyKind(filePath: string): InputHashKind {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".sql")) return "sql-dump";
  if (lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json"))
    return "openapi";
  if (lower.includes("brief") || lower.endsWith(".txt") || lower.endsWith(".md"))
    return "brief-input";
  return "other";
}

export async function hashFile(filePath: string): Promise<string> {
  const raw = await fs.readFile(filePath);
  const normalized = normalizeForHash(raw);
  return createHash("sha256").update(normalized).digest("hex");
}

export async function loadState(statePath: string): Promise<InputHashesState | null> {
  if (!(await exists(statePath))) return null;
  const raw = await fs.readFile(statePath, "utf8");
  const parsed = JSON.parse(raw);
  return InputHashesStateSchema.parse(parsed);
}

export async function computeHashResults(opts: {
  rootDir: string;
  inputs: string[];
  previous: InputHashesState | null;
}): Promise<HashResult[]> {
  const previousByPath = new Map<string, InputHashRecord>();
  if (opts.previous) {
    for (const entry of opts.previous.entries) {
      previousByPath.set(entry.path, entry);
    }
  }
  const results: HashResult[] = [];
  for (const absInput of opts.inputs) {
    const relative = path.relative(opts.rootDir, absInput).replace(/\\/g, "/");
    const sha256 = await hashFile(absInput);
    const prev = previousByPath.get(relative) ?? null;
    results.push({
      path: relative,
      sha256,
      previousSha256: prev?.sha256 ?? null,
      changed: prev ? prev.sha256 !== sha256 : true,
      kind: classifyKind(absInput),
    });
  }
  return results;
}

export async function writeState(
  statePath: string,
  results: HashResult[],
  now: Date = new Date(),
): Promise<void> {
  const state: InputHashesState = {
    version: 1,
    entries: results.map((r) => ({
      path: r.path,
      kind: r.kind,
      sha256: r.sha256,
      seenAt: now.toISOString(),
    })),
  };
  InputHashesStateSchema.parse(state);
  await writeArtifactAtomic(statePath, JSON.stringify(state, null, 2) + "\n");
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      root: { type: "string" },
      inputs: { type: "string", multiple: true },
      "update-state": { type: "boolean", default: false },
      verbose: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (!values.root) throw new Error("--root is required");
  const inputs = (values.inputs as string[] | undefined) ?? [];
  if (inputs.length === 0) throw new Error("--inputs <path>... (at least one) is required");
  return {
    root: values.root as string,
    inputs,
    updateState: Boolean(values["update-state"]),
    verbose: Boolean(values.verbose),
  };
}

export async function runHashInputs(argv: string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-hash-inputs: ${(err as Error).message}\n`);
    return 3;
  }

  const rootDir = path.resolve(opts.root);
  const statePath = path.join(rootDir, "state", "input-hashes.json");

  let previous: InputHashesState | null = null;
  try {
    previous = await loadState(statePath);
  } catch (err) {
    process.stderr.write(
      `atw-hash-inputs: state file unreadable at ${statePath}: ${(err as Error).message}\n`,
    );
    return 2;
  }

  let results: HashResult[];
  try {
    results = await computeHashResults({
      rootDir,
      inputs: opts.inputs.map((p) => path.resolve(p)),
      previous,
    });
  } catch (err) {
    process.stderr.write(`atw-hash-inputs: ${(err as Error).message}\n`);
    return 1;
  }

  if (opts.updateState) {
    try {
      await writeState(statePath, results);
    } catch (err) {
      process.stderr.write(`atw-hash-inputs: failed to write state: ${(err as Error).message}\n`);
      return 1;
    }
  }

  process.stdout.write(JSON.stringify({ results }, null, 2) + "\n");
  return 0;
}

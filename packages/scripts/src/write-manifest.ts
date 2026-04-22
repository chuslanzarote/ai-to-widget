import { promises as fs, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";
import { BuildManifestSchema } from "./lib/types.js";
import { writeManifestAtomic, defaultManifestPath } from "./lib/manifest-io.js";

const log = Debug("atw:write-manifest");

export interface WriteManifestResult {
  path: string;
  sha256: string;
}

export interface WriteManifestOptions {
  manifest: unknown;
  targetPath: string;
}

export function writeManifestCli(opts: WriteManifestOptions): WriteManifestResult {
  const parsed = BuildManifestSchema.parse(opts.manifest);
  writeManifestAtomic(opts.targetPath, parsed);
  const hash = createHash("sha256");
  // re-read the serialized form on disk so the hash corresponds to exactly
  // what's now durable, not to the object we handed in.
  const buf = readFileSync(opts.targetPath);
  hash.update(buf);
  return { path: opts.targetPath, sha256: hash.digest("hex") };
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  manifest: string | "-";
  out: string;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      manifest: { type: "string" },
      out: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  if (!values.manifest) throw new Error("--manifest <path|-> is required");
  return {
    manifest: String(values.manifest),
    out: String(values.out ?? defaultManifestPath(process.cwd())),
    json: Boolean(values.json),
  };
}

async function readInput(source: string): Promise<unknown> {
  const raw =
    source === "-"
      ? await readStream(process.stdin)
      : await fs.readFile(path.resolve(source), "utf8");
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`invalid JSON: ${(err as Error).message}`);
  }
}

function readStream(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    stream.on("error", reject);
  });
}

export async function runWriteManifest(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-write-manifest: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-write-manifest --manifest <path|-> [--out <path>] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-write-manifest 0.1.0\n");
    return 0;
  }

  try {
    const raw = await readInput(opts.manifest);
    const result = writeManifestCli({ manifest: raw, targetPath: opts.out });
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(`${result.path} ${result.sha256}\n`);
    }
    log("wrote %s (%s)", result.path, result.sha256);
    return 0;
  } catch (err) {
    const msg = (err as Error).message;
    process.stderr.write(`atw-write-manifest: ${msg}\n`);
    // zod validation errors include "Expected" / "Required" / "Invalid";
    // treat any schema parse failure as exit 23 per contract.
    if (/Expected|Required|Invalid|invalid_/i.test(msg)) return 23;
    return 1;
  }
}

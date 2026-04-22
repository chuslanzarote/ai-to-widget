import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";

const log = Debug("atw:compose-activate");

export type ComposeActivateAction = "activated" | "unchanged";

export interface ComposeActivateResult {
  action: ComposeActivateAction;
  services: string[];
}

/**
 * Start and end sentinels emitted by Feature 001 around the commented-out
 * ATW docker-compose block. We uncomment lines strictly between them.
 */
export const BEGIN_MARK = "# ----- atw:begin -----";
export const END_MARK = "# ----- atw:end -----";

export async function composeActivate(composeFile: string): Promise<ComposeActivateResult> {
  let raw: string;
  try {
    raw = await fs.readFile(composeFile, "utf8");
  } catch (err) {
    const e = new Error(
      `compose file not found at ${composeFile}: ${(err as Error).message}`,
    );
    (e as { code?: string }).code = "COMPOSE_NOT_FOUND";
    throw e;
  }
  const lines = raw.split(/\r?\n/);
  const begin = lines.findIndex((l) => l.trim() === BEGIN_MARK);
  const end = lines.findIndex((l) => l.trim() === END_MARK);
  if (begin < 0 || end < 0 || end < begin) {
    const e = new Error(
      `compose file at ${composeFile} has no atw:begin/atw:end block`,
    );
    (e as { code?: string }).code = "COMPOSE_NOT_FOUND";
    throw e;
  }

  // Uncomment every line inside the block that starts with "# " (NOT the
  // marker lines themselves). If no lines need changing, we're already
  // active.
  const services = new Set<string>();
  let changed = false;
  for (let i = begin + 1; i < end; i++) {
    const l = lines[i];
    const m = /^(\s*)#\s?(.*)$/.exec(l);
    if (m) {
      const rewritten = `${m[1]}${m[2]}`;
      if (rewritten !== l) {
        lines[i] = rewritten;
        changed = true;
      }
    }
    const svc = /^\s\s([a-zA-Z0-9_-]+):\s*$/.exec(lines[i]);
    if (svc) services.add(svc[1]);
  }

  if (changed) {
    const out = lines.join("\n");
    await fs.writeFile(composeFile, out, "utf8");
    log("activated %s (%d services)", composeFile, services.size);
    return { action: "activated", services: Array.from(services) };
  }
  return { action: "unchanged", services: Array.from(services) };
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  composeFile: string;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      "compose-file": { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  return {
    composeFile: String(
      values["compose-file"] ?? path.resolve(process.cwd(), "docker-compose.yml"),
    ),
    json: Boolean(values.json),
  };
}

export async function runComposeActivate(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-compose-activate: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write("atw-compose-activate [--compose-file <path>] [--json]\n");
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-compose-activate 0.1.0\n");
    return 0;
  }

  try {
    const result = await composeActivate(opts.composeFile);
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(`${result.action} (${result.services.length} services)\n`);
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "COMPOSE_NOT_FOUND") {
      process.stderr.write(`atw-compose-activate: ${(err as Error).message}\n`);
      return 21;
    }
    process.stderr.write(`atw-compose-activate: ${(err as Error).message}\n`);
    return 1;
  }
}

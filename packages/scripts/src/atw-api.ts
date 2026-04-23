/**
 * Feature 006 — `/atw.api` CLI: ingest an OpenAPI 3.0.x document and
 * pin it as a first-class input artefact at
 * `.atw/artifacts/openapi.json`, alongside a provenance sidecar at
 * `.atw/state/openapi-meta.json` and the determinism-ledger entry
 * inside `.atw/state/input-hashes.json`.
 *
 * Contracts:
 *   - specs/006-openapi-action-catalog/contracts/atw-api-command.md
 *   - specs/006-openapi-action-catalog/data-model.md §1, §4
 *
 * The CLI is a thin wrapper around the existing `parseOpenAPI()`
 * (packages/scripts/src/parse-openapi.ts) — the only new primitives
 * here are the canonicaliser (recursive object-key sort → 2-space
 * indent → trailing newline) and the write/compare/meta-emission
 * orchestration that makes re-runs byte-identical (Principle VIII).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import Debug from "debug";

import {
  parseOpenAPI,
  Swagger20DetectedError,
  OpenAPIFetchError,
  ParseOpenAPIError,
  DuplicateOperationIdError,
} from "./parse-openapi.js";
import {
  DEFAULT_INPUT_HASHES_PATH,
  readInputHashes,
  writeInputHashes,
  type InputHashes,
} from "./lib/input-hashes.js";

const log = Debug("atw:atw-api");

export type AtwApiAction = "created" | "unchanged" | "rewritten";

export interface AtwApiOptions {
  /** Absolute file path, project-relative path, or `http(s)://` URL. */
  source: string;
  /** Defaults to `process.cwd()`. All writes go under `<projectRoot>/.atw/`. */
  projectRoot?: string;
  /** When true and `.atw/artifacts/openapi.json` exists with a
   *  different hash, copy the prior to `openapi.json.bak` first. */
  backup?: boolean;
}

export interface AtwApiResult {
  action: AtwApiAction;
  /** Repository-relative path, forward-slash separators. */
  path: string;
  /** Canonical `sha256:<hex>` of the written bytes. */
  sha256: string;
  /** Repository-relative path of the meta sidecar. */
  metaPath: string;
  /** Repository-relative path of the backup, when produced. */
  backupPath?: string;
}

/**
 * Recursive alphabetical key sort → `JSON.stringify(_, null, 2)` →
 * trailing newline. Arrays keep their input order (OpenAPI's
 * `paths[*].parameters[]` and `responses` orderings are
 * semantically significant for human review per data-model.md §1).
 *
 * Idempotent: canonicaliseOpenAPI(canonicaliseOpenAPI(x)) === canonicaliseOpenAPI(x).
 */
export function canonicaliseOpenAPI(doc: unknown): string {
  return JSON.stringify(sortKeysDeeply(doc), null, 2) + "\n";
}

function sortKeysDeeply(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeysDeeply);
  if (v !== null && typeof v === "object") {
    const src = v as Record<string, unknown>;
    const sortedKeys = Object.keys(src).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    const out: Record<string, unknown> = {};
    for (const k of sortedKeys) out[k] = sortKeysDeeply(src[k]);
    return out;
  }
  return v;
}

const OPENAPI_ARTIFACT_REL = ".atw/artifacts/openapi.json";
const OPENAPI_META_REL = ".atw/state/openapi-meta.json";

/**
 * Programmatic entry used both by the CLI wrapper and by the
 * orchestrator's future `/atw.api` step. Returns the resolved action,
 * hash, and paths; throws the parse-openapi error classes unchanged
 * so callers can map them to exit codes (CLI) or structured
 * `pipeline_failures` (orchestrator).
 */
export async function runAtwApi(opts: AtwApiOptions): Promise<AtwApiResult> {
  const projectRoot = opts.projectRoot ?? process.cwd();
  // parseOpenAPI already does: load → version-check (→Swagger20DetectedError) →
  // SwaggerParser.bundle (→ParseOpenAPIError on unresolved $ref) →
  // normalize (→DuplicateOperationIdError on dup operationId).
  const { raw } = await parseOpenAPI({ source: opts.source });

  const canonical = canonicaliseOpenAPI(raw);
  const canonicalBytes = Buffer.from(canonical, "utf8");
  const hash =
    "sha256:" + createHash("sha256").update(canonicalBytes).digest("hex");

  const outAbs = path.join(projectRoot, OPENAPI_ARTIFACT_REL);
  const metaAbs = path.join(projectRoot, OPENAPI_META_REL);

  let prior: string | null = null;
  try {
    prior = await fs.readFile(outAbs, "utf8");
  } catch {
    prior = null;
  }

  let action: AtwApiAction;
  let backupAbs: string | undefined;
  if (prior === null) {
    action = "created";
  } else if (prior === canonical) {
    action = "unchanged";
  } else {
    action = "rewritten";
    if (opts.backup) {
      backupAbs = outAbs + ".bak";
      await fs.writeFile(backupAbs, prior, "utf8");
    }
  }

  if (action !== "unchanged") {
    await fs.mkdir(path.dirname(outAbs), { recursive: true });
    await fs.writeFile(outAbs, canonical, "utf8");
  }

  // Meta sidecar: on `unchanged` we preserve the prior file so re-runs
  // don't churn mtime or fetchedAt. On created/rewritten we emit a
  // fresh one.
  if (action !== "unchanged") {
    const meta = {
      sha256: hash,
      source: opts.source,
      fetchedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(metaAbs), { recursive: true });
    await fs.writeFile(metaAbs, JSON.stringify(meta, null, 2) + "\n", "utf8");
  }

  // Ledger extension (data-model §4). We preserve every other entry
  // in input-hashes.json — this CLI touches only our one slot.
  const priorLedger = readInputHashes(projectRoot);
  const ledger: InputHashes = priorLedger ?? {
    schema_version: "1",
    files: {},
    prompt_template_version: "",
  };
  ledger.files[OPENAPI_ARTIFACT_REL] = hash;
  await writeInputHashes(projectRoot, ledger);

  log("%s -> %s (%s)", opts.source, OPENAPI_ARTIFACT_REL, action);

  return {
    action,
    path: OPENAPI_ARTIFACT_REL,
    sha256: hash,
    metaPath: OPENAPI_META_REL,
    backupPath: backupAbs
      ? path.relative(projectRoot, backupAbs).replace(/\\/g, "/")
      : undefined,
  };
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  source: string;
  backup: boolean;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: "string" },
      backup: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  if (!values.source) throw new Error("--source <path|url> is required");
  return {
    source: String(values.source),
    backup: Boolean(values.backup),
    json: Boolean(values.json),
  };
}

export async function runAtwApiCli(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-api: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-api --source <path|url> [--backup] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-api 0.1.0\n");
    return 0;
  }

  try {
    const result = await runAtwApi({
      source: opts.source,
      backup: opts.backup,
    });
    if (opts.json) {
      process.stdout.write(
        JSON.stringify({
          action: result.action,
          path: result.path,
          sha256: result.sha256,
          metaPath: result.metaPath,
          ...(result.backupPath ? { backupPath: result.backupPath } : {}),
        }) + "\n",
      );
    } else {
      process.stdout.write(`${result.action} ${result.path}\n`);
    }
    return 0;
  } catch (err) {
    if (err instanceof Swagger20DetectedError) {
      // contracts/atw-api-command.md §4: Swagger 2.0 → exit 3.
      process.stderr.write(`atw-api: ${err.message}\n`);
      return 3;
    }
    if (err instanceof OpenAPIFetchError) {
      // contracts/atw-api-command.md §4: fetch failure → exit 2.
      process.stderr.write(`atw-api: ${err.message}\n`);
      process.stderr.write(
        "Tip: download the spec to a local file and pass --source <path> instead.\n",
      );
      return 2;
    }
    if (err instanceof DuplicateOperationIdError) {
      process.stderr.write(`atw-api: ${err.message}\n`);
      return 1;
    }
    if (err instanceof ParseOpenAPIError) {
      process.stderr.write(`atw-api: ${err.message}\n`);
      return 1;
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(`atw-api: file not found: ${opts.source}\n`);
      return 1;
    }
    process.stderr.write(`atw-api: ${(err as Error).message}\n`);
    return 1;
  }
}

// Export for orchestrator use — keeps the import surface small.
export { DEFAULT_INPUT_HASHES_PATH };

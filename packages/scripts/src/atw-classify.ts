/**
 * Feature 006 — `/atw.classify` CLI: derive `action-manifest.md` from
 * the committed `openapi.json` via the two-stage classifier
 * (deterministic heuristic + Opus narrowing review with anchored-
 * generation post-check).
 *
 * Contracts:
 *   - specs/006-openapi-action-catalog/contracts/classifier-contract.md
 *   - specs/006-openapi-action-catalog/contracts/action-manifest.schema.md
 *
 * Exit codes (per classifier-contract.md §7):
 *   0 — success
 *   1 — ANCHORED_GENERATION_VIOLATION, OPUS_RESPONSE_INVALID,
 *       CLASSIFIER_TIMEOUT, MANIFEST_VALIDATION, any filesystem error
 *   3 — missing --source / missing openapi.json / missing meta sidecar
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";

import { parseOpenAPI } from "./parse-openapi.js";
import {
  classifyActions,
  ClassifierError,
} from "./classify-actions.js";
import {
  parseActionManifestText,
} from "./parse-action-manifest.js";
import { renderActionManifest } from "./render-action-manifest.js";
import { defaultOpusClient, type OpusClient } from "./enrich-entity.js";
import { loadArtifactFromFile } from "./load-artifact.js";
import type { ActionManifest } from "./lib/action-manifest-types.js";

const log = Debug("atw:atw-classify");

const OPENAPI_ARTIFACT_REL = ".atw/artifacts/openapi.json";
const OPENAPI_META_REL = ".atw/state/openapi-meta.json";
const MANIFEST_ARTIFACT_REL = ".atw/artifacts/action-manifest.md";
const PROJECT_MD_REL = ".atw/config/project.md";

export interface AtwClassifyOptions {
  /** Defaults to `process.cwd()`. All reads/writes under `<projectRoot>/.atw/`. */
  projectRoot?: string;
  /** Inject a fake Opus client for tests. */
  opusClient?: OpusClient;
  /** Override model snapshot for tests. Defaults to `claude-opus-4-7`. */
  modelSnapshot?: string;
  /** Host origin from brief; reserved for cross-origin widget detection. */
  hostOrigin?: string;
  /** Override classifiedAt for deterministic tests. */
  classifiedAt?: string;
  /** Timeout for Opus calls. Defaults to 60 s. */
  opusTimeoutMs?: number;
}

export interface AtwClassifyResult {
  action: "created" | "unchanged" | "rewritten";
  path: string;
  warnings: string[];
  manifest: ActionManifest;
}

export async function runAtwClassify(
  opts: AtwClassifyOptions = {},
): Promise<AtwClassifyResult> {
  const root = opts.projectRoot ?? process.cwd();
  const openapiAbs = path.join(root, OPENAPI_ARTIFACT_REL);
  const metaAbs = path.join(root, OPENAPI_META_REL);
  const manifestAbs = path.join(root, MANIFEST_ARTIFACT_REL);

  // 1. Load ingested OpenAPI (produced by /atw.api).
  let openapiText: string;
  try {
    openapiText = await fs.readFile(openapiAbs, "utf8");
  } catch {
    const e = new Error(
      `atw-classify: ${OPENAPI_ARTIFACT_REL} not found — run /atw.api first.`,
    );
    (e as { code?: string }).code = "MISSING_OPENAPI";
    throw e;
  }
  const openapiDoc = JSON.parse(openapiText) as unknown;

  // 2. Load meta sidecar for sha256 provenance.
  let metaText: string;
  try {
    metaText = await fs.readFile(metaAbs, "utf8");
  } catch {
    const e = new Error(
      `atw-classify: ${OPENAPI_META_REL} not found — re-run /atw.api.`,
    );
    (e as { code?: string }).code = "MISSING_META";
    throw e;
  }
  const meta = JSON.parse(metaText) as { sha256?: unknown };
  if (typeof meta.sha256 !== "string") {
    throw new Error(
      `atw-classify: ${OPENAPI_META_REL} is missing sha256 — re-run /atw.api.`,
    );
  }
  const openapiSha256 = meta.sha256;

  // 3. Parse (we re-parse the ingested canonical JSON — safe since it's
  // already OpenAPI 3.0/3.1 at this point).
  const tmp = await fs.mkdtemp(path.join(root, ".atw/.atw-classify-tmp-"));
  let parsed;
  try {
    const tmpFile = path.join(tmp, "openapi.json");
    await fs.writeFile(tmpFile, openapiText);
    const r = await parseOpenAPI({ source: tmpFile });
    parsed = r.parsed;
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }

  // 4. Load prior manifest (delta-merge) if present.
  let prior: ActionManifest | undefined;
  try {
    const priorText = await fs.readFile(manifestAbs, "utf8");
    prior = parseActionManifestText(priorText);
    log("delta-merge base loaded: %d included, %d excluded", prior.included.length, prior.excluded.length);
  } catch {
    prior = undefined;
  }

  // 5. Obtain Opus client.
  const modelSnapshot = opts.modelSnapshot ?? "claude-opus-4-7";
  const opusClient =
    opts.opusClient ?? (await defaultOpusClient(modelSnapshot));

  // 5b. Load project.md#deploymentType (FR-010 gating input).
  let deploymentType: string | undefined;
  try {
    const projectArt = await loadArtifactFromFile(
      "project",
      path.join(root, PROJECT_MD_REL),
    );
    if (projectArt.kind === "project") {
      deploymentType = projectArt.content.deploymentType;
    }
  } catch {
    deploymentType = undefined;
  }

  // 6. Classify.
  const out = await classifyActions({
    parsed,
    rawDoc: openapiDoc,
    openapiSha256,
    opusClient,
    modelSnapshot,
    prior,
    hostOrigin: opts.hostOrigin,
    classifiedAt: opts.classifiedAt,
    opusTimeoutMs: opts.opusTimeoutMs,
    deploymentType,
  });

  // 7. Serialise + write (create / unchanged / rewritten).
  const bytes = renderActionManifest(out.manifest);
  let action: AtwClassifyResult["action"] = "created";
  try {
    const existing = await fs.readFile(manifestAbs, "utf8");
    if (existing === bytes) {
      action = "unchanged";
    } else {
      action = "rewritten";
    }
  } catch {
    action = "created";
  }

  if (action !== "unchanged") {
    await fs.mkdir(path.dirname(manifestAbs), { recursive: true });
    await fs.writeFile(manifestAbs, bytes);
  }

  return {
    action,
    path: MANIFEST_ARTIFACT_REL,
    warnings: out.warnings,
    manifest: out.manifest,
  };
}

/* ============================================================================
 * CLI entry
 * ========================================================================= */

export async function runAtwClassifyCli(argv: string[]): Promise<number> {
  let opts;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-classify: ${(err as Error).message}\n`);
    return 3;
  }
  try {
    const res = await runAtwClassify({
      hostOrigin: opts.hostOrigin ?? undefined,
    });
    process.stdout.write(
      `atw-classify: ${res.action} ${res.path} — ${res.manifest.included.length} action(s) included, ${res.manifest.excluded.length} excluded\n`,
    );
    for (const w of res.warnings) {
      process.stderr.write(`atw-classify warning: ${w}\n`);
    }
    return 0;
  } catch (err) {
    if (err instanceof ClassifierError) {
      process.stderr.write(`atw-classify: ${err.message}\n`);
      return 1;
    }
    const code = (err as { code?: string }).code;
    if (code === "MISSING_OPENAPI" || code === "MISSING_META") {
      process.stderr.write(`${(err as Error).message}\n`);
      return 3;
    }
    process.stderr.write(`atw-classify: ${(err as Error).message}\n`);
    return 1;
  }
}

interface CliValues {
  hostOrigin: string | null;
}

function parseCli(argv: string[]): CliValues {
  const { values } = parseArgs({
    args: argv,
    options: {
      "host-origin": { type: "string" },
    },
    strict: true,
  });
  return {
    hostOrigin: (values["host-origin"] as string | undefined) ?? null,
  };
}

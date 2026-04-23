import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import SwaggerParser from "@apidevtools/swagger-parser";
import {
  ParsedOpenAPISchema,
  type ParsedOpenAPI,
  type ParsedOpenAPIOperation,
} from "./lib/types.js";

export class Swagger20DetectedError extends Error {
  constructor(public readonly sourceVersion: "2.0") {
    super(
      "Swagger 2.0 input detected. /atw.api requires OpenAPI 3.x. " +
        "Please convert with `npx swagger2openapi` or equivalent, then re-run.",
    );
  }
}

export class OpenAPIFetchError extends Error {
  constructor(public readonly url: string, cause: string) {
    super(`Unable to fetch OpenAPI document from ${url}: ${cause}`);
  }
}

export class ParseOpenAPIError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * Feature 006 — FR-002: operationIds must be unique within the document.
 * Detection is performed during `normalize()` so every downstream
 * consumer (classifier, manifest cross-validation, render pipeline)
 * can trust that the operations array has no duplicates.
 * See contracts/atw-api-command.md §3 step 6.
 */
export class DuplicateOperationIdError extends Error {
  readonly code = "DUPLICATE_OPERATION_ID" as const;
  constructor(
    public readonly operationId: string,
    public readonly first: { method: string; path: string },
    public readonly second: { method: string; path: string },
  ) {
    super(
      `duplicate operationId "${operationId}" at (${first.method} ${first.path}) and (${second.method} ${second.path})`,
    );
  }
}

const HTTP_METHODS: ParsedOpenAPIOperation["method"][] = [
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
];

export interface ParseOpenAPIInput {
  /** Absolute file path OR an `http(s)://` URL. */
  source: string;
  /** Optional pre-read document body (for paste flow). */
  body?: string;
}

export interface ParseOpenAPIResult {
  parsed: ParsedOpenAPI;
  /** The fully-dereferenced raw document, useful for downstream helpers. */
  raw: unknown;
}

export async function parseOpenAPI(input: ParseOpenAPIInput): Promise<ParseOpenAPIResult> {
  const doc = await loadDocument(input);
  const version = detectVersion(doc);
  if (version === "2.0") {
    throw new Swagger20DetectedError("2.0");
  }

  let dereferenced: unknown;
  try {
    dereferenced = await SwaggerParser.bundle(doc as Parameters<typeof SwaggerParser.bundle>[0]);
  } catch (err) {
    throw new ParseOpenAPIError((err as Error).message);
  }

  const parsed = normalize(dereferenced, input);
  return { parsed: ParsedOpenAPISchema.parse(parsed), raw: dereferenced };
}

async function loadDocument(input: ParseOpenAPIInput): Promise<unknown> {
  if (input.body !== undefined) {
    return await parseTextualDocument(input.body);
  }
  if (/^https?:\/\//i.test(input.source)) {
    try {
      const res = await fetch(input.source);
      if (!res.ok) {
        throw new OpenAPIFetchError(input.source, `HTTP ${res.status}`);
      }
      const text = await res.text();
      return await parseTextualDocument(text);
    } catch (err) {
      if (err instanceof OpenAPIFetchError) throw err;
      throw new OpenAPIFetchError(input.source, (err as Error).message);
    }
  }
  const raw = await fs.readFile(input.source, "utf8");
  return parseTextualDocument(raw);
}

async function parseTextualDocument(text: string): Promise<unknown> {
  const trimmed = text.trimStart();
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new ParseOpenAPIError(`invalid JSON: ${(err as Error).message}`);
    }
  }
  return parseYaml(text);
}

async function parseYaml(text: string): Promise<unknown> {
  try {
    // js-yaml ships no bundled types; force through unknown.
    const modulePath = "js-yaml";
    const mod = (await import(modulePath)) as unknown as {
      default?: { load: (s: string) => unknown };
      load?: (s: string) => unknown;
    };
    const load = mod.load ?? mod.default?.load;
    if (!load) throw new Error("js-yaml missing `load`");
    return load(text);
  } catch (err) {
    throw new ParseOpenAPIError(
      `YAML parse failed: ${(err as Error).message}. Try saving the spec as JSON.`,
    );
  }
}

function detectVersion(doc: unknown): "3.1" | "3.0" | "2.0" {
  if (!doc || typeof doc !== "object") {
    throw new ParseOpenAPIError("input is not an OpenAPI document");
  }
  const obj = doc as { openapi?: string; swagger?: string };
  if (typeof obj.openapi === "string") {
    if (obj.openapi.startsWith("3.1")) return "3.1";
    if (obj.openapi.startsWith("3.0")) return "3.0";
    throw new ParseOpenAPIError(`unsupported openapi version: ${obj.openapi}`);
  }
  if (typeof obj.swagger === "string" && obj.swagger.startsWith("2.")) return "2.0";
  throw new ParseOpenAPIError(
    "missing `openapi` or `swagger` version field — is this really an OpenAPI document?",
  );
}

function normalize(raw: unknown, input: ParseOpenAPIInput): ParsedOpenAPI {
  const doc = raw as {
    openapi?: string;
    info?: { title?: string; description?: string };
    servers?: Array<{ url?: string; description?: string }>;
    tags?: Array<{ name?: string; description?: string }>;
    paths?: Record<string, Record<string, unknown>>;
  };

  const version: ParsedOpenAPI["sourceVersion"] = doc.openapi?.startsWith("3.1") ? "3.1" : "3.0";

  const operations: ParsedOpenAPIOperation[] = [];
  // Feature 006 — FR-002 / contracts/atw-api-command.md §3 step 6:
  // fail on the first duplicate operationId so the classifier and
  // every manifest cross-check can trust id uniqueness.
  const seenOperationIds = new Map<string, { method: string; path: string }>();
  for (const [p, item] of Object.entries(doc.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const rawOp = (item as Record<string, unknown>)[method];
      if (!rawOp || typeof rawOp !== "object") continue;
      const opId = (rawOp as { operationId?: unknown }).operationId;
      if (typeof opId === "string" && opId.length > 0) {
        const prior = seenOperationIds.get(opId);
        if (prior) {
          throw new DuplicateOperationIdError(
            opId,
            { method: prior.method.toUpperCase(), path: prior.path },
            { method: method.toUpperCase(), path: p },
          );
        }
        seenOperationIds.set(opId, { method, path: p });
      }
      operations.push(normalizeOperation(p, method, rawOp as Record<string, unknown>));
    }
  }

  return {
    version: 1,
    sourceVersion: version,
    sourceUrl: /^https?:\/\//i.test(input.source) ? input.source : null,
    title: doc.info?.title ?? path.basename(input.source),
    apiDescription: doc.info?.description ?? null,
    servers: (doc.servers ?? []).map((s) => ({
      url: s.url ?? "",
      description: s.description ?? null,
    })),
    tags: (doc.tags ?? []).map((t) => ({
      name: t.name ?? "",
      description: t.description ?? null,
    })),
    operations,
  };
}

function normalizeOperation(
  p: string,
  method: ParsedOpenAPIOperation["method"],
  op: Record<string, unknown>,
): ParsedOpenAPIOperation {
  const id =
    typeof op.operationId === "string" && op.operationId.length > 0
      ? op.operationId
      : `${method.toUpperCase()} ${p}`;
  const tags = Array.isArray(op.tags) ? (op.tags as string[]) : [];
  const security = Array.isArray(op.security)
    ? (op.security as Array<Record<string, string[]>>).flatMap((entry) =>
        Object.entries(entry).map(([scheme, scopes]) => ({ scheme, scopes })),
      )
    : [];
  const parameters = Array.isArray(op.parameters)
    ? (op.parameters as Array<Record<string, unknown>>)
        .filter((param) => {
          const where = param.in;
          return where === "query" || where === "path" || where === "header" || where === "cookie";
        })
        .map((param) => ({
          name: String(param.name ?? ""),
          in: param.in as "query" | "path" | "header" | "cookie",
          required: Boolean(param.required),
          schema: param.schema ?? null,
        }))
    : [];

  let requestBody: ParsedOpenAPIOperation["requestBody"] = null;
  if (op.requestBody && typeof op.requestBody === "object") {
    const content = (op.requestBody as { content?: Record<string, { schema?: unknown }> }).content ?? {};
    const [contentType, media] = Object.entries(content)[0] ?? [];
    if (contentType && media) {
      requestBody = { contentType, schema: media.schema ?? null };
    }
  }

  const responses: ParsedOpenAPIOperation["responses"] = [];
  if (op.responses && typeof op.responses === "object") {
    for (const [status, resp] of Object.entries(op.responses as Record<string, unknown>)) {
      if (!resp || typeof resp !== "object") continue;
      const content = (resp as { content?: Record<string, { schema?: unknown }> }).content ?? {};
      const [contentType, media] = Object.entries(content)[0] ?? [];
      responses.push({
        status,
        contentType: contentType ?? null,
        schema: media?.schema ?? null,
      });
    }
  }

  return {
    id,
    method,
    path: p,
    tag: tags[0] ?? null,
    summary: typeof op.summary === "string" ? op.summary : null,
    description: typeof op.description === "string" ? op.description : null,
    security,
    parameters,
    requestBody,
    responses,
  };
}

/* --------------------------- CLI --------------------------- */

interface CliOptions {
  source: string | null;
  out: string | null;
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      source: { type: "string" },
      out: { type: "string" },
    },
    strict: true,
  });
  if (!values.source) throw new Error("--source <path|url> is required");
  return {
    source: values.source as string,
    out: (values.out as string | undefined) ?? null,
  };
}

export async function runParseOpenAPI(argv: string[]): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-parse-openapi: ${(err as Error).message}\n`);
    return 3;
  }
  if (!opts.source) return 3;

  try {
    const { parsed } = await parseOpenAPI({ source: opts.source });
    const payload = JSON.stringify(parsed, null, 2);
    if (opts.out) {
      const { writeArtifactAtomic } = await import("./lib/atomic.js");
      await writeArtifactAtomic(path.resolve(opts.out), payload + "\n");
    } else {
      process.stdout.write(payload + "\n");
    }
    return 0;
  } catch (err) {
    if (err instanceof Swagger20DetectedError) {
      process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
      return 3;
    }
    if (err instanceof OpenAPIFetchError) {
      process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
      process.stderr.write(
        "Tip: download the spec to a local file and pass --source <path> instead.\n",
      );
      return 2;
    }
    if (err instanceof DuplicateOperationIdError) {
      process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
      return 1;
    }
    if (err instanceof ParseOpenAPIError) {
      process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
      return 1;
    }
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      process.stderr.write(`atw-parse-openapi: file not found: ${opts.source}\n`);
      return 1;
    }
    process.stderr.write(`atw-parse-openapi: ${(err as Error).message}\n`);
    return 1;
  }
}

import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import SwaggerParser from "@apidevtools/swagger-parser";
import { ParsedOpenAPISchema, } from "./lib/types.js";
export class Swagger20DetectedError extends Error {
    sourceVersion;
    constructor(sourceVersion) {
        super("Swagger 2.0 input detected. /atw.api requires OpenAPI 3.x. " +
            "Please convert with `npx swagger2openapi` or equivalent, then re-run.");
        this.sourceVersion = sourceVersion;
    }
}
export class OpenAPIFetchError extends Error {
    url;
    constructor(url, cause) {
        super(`Unable to fetch OpenAPI document from ${url}: ${cause}`);
        this.url = url;
    }
}
export class ParseOpenAPIError extends Error {
    constructor(message) {
        super(message);
    }
}
/**
 * Methods we surface to the LLM. Feature 009 (FR-001, FR-003) drops all
 * semantic pre-filtering; only structural filters remain. OPTIONS and HEAD
 * are excluded structurally because they are not actionable tools — the
 * LLM sees only methods that map to user-visible actions.
 */
const HTTP_METHODS = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
];
export async function parseOpenAPI(input) {
    const doc = await loadDocument(input);
    const version = detectVersion(doc);
    if (version === "2.0") {
        throw new Swagger20DetectedError("2.0");
    }
    let dereferenced;
    try {
        dereferenced = await SwaggerParser.bundle(doc);
    }
    catch (err) {
        throw new ParseOpenAPIError(err.message);
    }
    const parsed = normalize(dereferenced, input);
    return { parsed: ParsedOpenAPISchema.parse(parsed), raw: dereferenced };
}
async function loadDocument(input) {
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
        }
        catch (err) {
            if (err instanceof OpenAPIFetchError)
                throw err;
            throw new OpenAPIFetchError(input.source, err.message);
        }
    }
    const raw = await fs.readFile(input.source, "utf8");
    return parseTextualDocument(raw);
}
async function parseTextualDocument(text) {
    const trimmed = text.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
            return JSON.parse(text);
        }
        catch (err) {
            throw new ParseOpenAPIError(`invalid JSON: ${err.message}`);
        }
    }
    return parseYaml(text);
}
async function parseYaml(text) {
    try {
        // js-yaml ships no bundled types; force through unknown.
        const modulePath = "js-yaml";
        const mod = (await import(modulePath));
        const load = mod.load ?? mod.default?.load;
        if (!load)
            throw new Error("js-yaml missing `load`");
        return load(text);
    }
    catch (err) {
        throw new ParseOpenAPIError(`YAML parse failed: ${err.message}. Try saving the spec as JSON.`);
    }
}
function detectVersion(doc) {
    if (!doc || typeof doc !== "object") {
        throw new ParseOpenAPIError("input is not an OpenAPI document");
    }
    const obj = doc;
    if (typeof obj.openapi === "string") {
        if (obj.openapi.startsWith("3.1"))
            return "3.1";
        if (obj.openapi.startsWith("3.0"))
            return "3.0";
        throw new ParseOpenAPIError(`unsupported openapi version: ${obj.openapi}`);
    }
    if (typeof obj.swagger === "string" && obj.swagger.startsWith("2."))
        return "2.0";
    throw new ParseOpenAPIError("missing `openapi` or `swagger` version field — is this really an OpenAPI document?");
}
function normalize(raw, input) {
    const doc = raw;
    const version = doc.openapi?.startsWith("3.1") ? "3.1" : "3.0";
    const operations = [];
    for (const [p, item] of Object.entries(doc.paths ?? {})) {
        for (const method of HTTP_METHODS) {
            const rawOp = item[method];
            if (!rawOp || typeof rawOp !== "object")
                continue;
            const normalized = normalizeOperation(p, method, rawOp);
            // Stage-1 structural filter (FR-003): operations with no declared
            // responses are skipped — there is nothing for the LLM to anchor a
            // tool definition against. No semantic filtering happens here.
            if (normalized.responses.length === 0)
                continue;
            operations.push(normalized);
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
function normalizeOperation(p, method, op) {
    const id = typeof op.operationId === "string" && op.operationId.length > 0
        ? op.operationId
        : `${method.toUpperCase()} ${p}`;
    const tags = Array.isArray(op.tags) ? op.tags : [];
    const security = Array.isArray(op.security)
        ? op.security.flatMap((entry) => Object.entries(entry).map(([scheme, scopes]) => ({ scheme, scopes })))
        : [];
    const parameters = Array.isArray(op.parameters)
        ? op.parameters
            .filter((param) => {
            const where = param.in;
            return where === "query" || where === "path" || where === "header" || where === "cookie";
        })
            .map((param) => ({
            name: String(param.name ?? ""),
            in: param.in,
            required: Boolean(param.required),
            schema: param.schema ?? null,
        }))
        : [];
    let requestBody = null;
    if (op.requestBody && typeof op.requestBody === "object") {
        const content = op.requestBody.content ?? {};
        const [contentType, media] = Object.entries(content)[0] ?? [];
        if (contentType && media) {
            requestBody = { contentType, schema: media.schema ?? null };
        }
    }
    const responses = [];
    if (op.responses && typeof op.responses === "object") {
        for (const [status, resp] of Object.entries(op.responses)) {
            if (!resp || typeof resp !== "object")
                continue;
            const content = resp.content ?? {};
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
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            source: { type: "string" },
            out: { type: "string" },
        },
        strict: true,
    });
    if (!values.source)
        throw new Error("--source <path|url> is required");
    return {
        source: values.source,
        out: values.out ?? null,
    };
}
export async function runParseOpenAPI(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
        return 3;
    }
    if (!opts.source)
        return 3;
    try {
        const { parsed } = await parseOpenAPI({ source: opts.source });
        const payload = JSON.stringify(parsed, null, 2);
        if (opts.out) {
            const { writeArtifactAtomic } = await import("./lib/atomic.js");
            await writeArtifactAtomic(path.resolve(opts.out), payload + "\n");
        }
        else {
            process.stdout.write(payload + "\n");
        }
        return 0;
    }
    catch (err) {
        if (err instanceof Swagger20DetectedError) {
            process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
            return 3;
        }
        if (err instanceof OpenAPIFetchError) {
            process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
            process.stderr.write("Tip: download the spec to a local file and pass --source <path> instead.\n");
            return 2;
        }
        if (err instanceof ParseOpenAPIError) {
            process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
            return 1;
        }
        const code = err.code;
        if (code === "ENOENT") {
            process.stderr.write(`atw-parse-openapi: file not found: ${opts.source}\n`);
            return 1;
        }
        process.stderr.write(`atw-parse-openapi: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=parse-openapi.js.map
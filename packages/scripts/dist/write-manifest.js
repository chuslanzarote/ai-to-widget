import { promises as fs, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";
import { BuildManifestSchema } from "./lib/types.js";
import { writeManifestAtomic, defaultManifestPath, writeActionManifest, } from "./lib/manifest-io.js";
import { ActionManifestSchema, } from "./lib/schemas/action-manifest.js";
const log = Debug("atw:write-manifest");
export function writeManifestCli(opts) {
    const parsed = BuildManifestSchema.parse(opts.manifest);
    writeManifestAtomic(opts.targetPath, parsed);
    const hash = createHash("sha256");
    // re-read the serialized form on disk so the hash corresponds to exactly
    // what's now durable, not to the object we handed in.
    const buf = readFileSync(opts.targetPath);
    hash.update(buf);
    return { path: opts.targetPath, sha256: hash.digest("hex") };
}
/**
 * Write an action manifest (Feature 009 / FR-005, FR-007) via the
 * gray-matter round-trip helper. The header frontmatter (schema_version,
 * model_snapshot, input_hashes, counts) is enforced by
 * `ActionManifestSchema`; passing an invalid object surfaces field-level
 * issues at the call site.
 */
export function writeActionManifestCli(opts, body = "") {
    const parsed = ActionManifestSchema.parse(opts.manifest);
    writeActionManifest(opts.targetPath, parsed, body);
    const hash = createHash("sha256");
    hash.update(readFileSync(opts.targetPath));
    return { path: opts.targetPath, sha256: hash.digest("hex") };
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            manifest: { type: "string" },
            out: { type: "string" },
            json: { type: "boolean", default: false },
            kind: { type: "string", default: "build" },
            help: { type: "boolean", default: false, short: "h" },
            version: { type: "boolean", default: false, short: "v" },
        },
        strict: true,
    });
    if (values.help)
        return { help: true };
    if (values.version)
        return { version: true };
    if (!values.manifest)
        throw new Error("--manifest <path|-> is required");
    const kind = String(values.kind ?? "build");
    if (kind !== "build" && kind !== "action") {
        throw new Error(`--kind must be "build" or "action" (got "${kind}")`);
    }
    const defaultOut = kind === "action"
        ? path.join(process.cwd(), ".atw", "artifacts", "action-manifest.md")
        : defaultManifestPath(process.cwd());
    return {
        manifest: String(values.manifest),
        out: String(values.out ?? defaultOut),
        json: Boolean(values.json),
        kind,
    };
}
async function readInput(source) {
    const raw = source === "-"
        ? await readStream(process.stdin)
        : await fs.readFile(path.resolve(source), "utf8");
    try {
        return JSON.parse(raw);
    }
    catch (err) {
        throw new Error(`invalid JSON: ${err.message}`);
    }
}
function readStream(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
        stream.on("error", reject);
    });
}
export async function runWriteManifest(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-write-manifest: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-write-manifest --manifest <path|-> [--out <path>] [--json] [--kind build|action]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-write-manifest 0.1.0\n");
        return 0;
    }
    try {
        const raw = await readInput(opts.manifest);
        const result = opts.kind === "action"
            ? writeActionManifestCli({ manifest: raw, targetPath: opts.out })
            : writeManifestCli({ manifest: raw, targetPath: opts.out });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`${result.path} ${result.sha256}\n`);
        }
        log("wrote %s (%s)", result.path, result.sha256);
        return 0;
    }
    catch (err) {
        const msg = err.message;
        process.stderr.write(`atw-write-manifest: ${msg}\n`);
        // zod validation errors include "Expected" / "Required" / "Invalid";
        // treat any schema parse failure as exit 23 per contract.
        if (/Expected|Required|Invalid|invalid_/i.test(msg))
            return 23;
        return 1;
    }
}
//# sourceMappingURL=write-manifest.js.map
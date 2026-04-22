import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeArtifactAtomic, exists } from "./lib/atomic.js";
import { normalizeForHash } from "./lib/normalize.js";
import { InputHashesStateSchema, } from "./lib/types.js";
function classifyKind(filePath) {
    const lower = filePath.toLowerCase();
    if (lower.endsWith(".sql"))
        return "sql-dump";
    if (lower.endsWith(".yaml") || lower.endsWith(".yml") || lower.endsWith(".json"))
        return "openapi";
    if (lower.includes("brief") || lower.endsWith(".txt") || lower.endsWith(".md"))
        return "brief-input";
    return "other";
}
export async function hashFile(filePath) {
    const raw = await fs.readFile(filePath);
    const normalized = normalizeForHash(raw);
    return createHash("sha256").update(normalized).digest("hex");
}
export async function loadState(statePath) {
    if (!(await exists(statePath)))
        return null;
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return InputHashesStateSchema.parse(parsed);
}
export async function computeHashResults(opts) {
    const previousByPath = new Map();
    if (opts.previous) {
        for (const entry of opts.previous.entries) {
            previousByPath.set(entry.path, entry);
        }
    }
    const results = [];
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
export async function writeState(statePath, results, now = new Date()) {
    const state = {
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
function parseCli(argv) {
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
    if (!values.root)
        throw new Error("--root is required");
    const inputs = values.inputs ?? [];
    if (inputs.length === 0)
        throw new Error("--inputs <path>... (at least one) is required");
    return {
        root: values.root,
        inputs,
        updateState: Boolean(values["update-state"]),
        verbose: Boolean(values.verbose),
    };
}
export async function runHashInputs(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-hash-inputs: ${err.message}\n`);
        return 3;
    }
    const rootDir = path.resolve(opts.root);
    const statePath = path.join(rootDir, "state", "input-hashes.json");
    let previous = null;
    try {
        previous = await loadState(statePath);
    }
    catch (err) {
        process.stderr.write(`atw-hash-inputs: state file unreadable at ${statePath}: ${err.message}\n`);
        return 2;
    }
    let results;
    try {
        results = await computeHashResults({
            rootDir,
            inputs: opts.inputs.map((p) => path.resolve(p)),
            previous,
        });
    }
    catch (err) {
        process.stderr.write(`atw-hash-inputs: ${err.message}\n`);
        return 1;
    }
    if (opts.updateState) {
        try {
            await writeState(statePath, results);
        }
        catch (err) {
            process.stderr.write(`atw-hash-inputs: failed to write state: ${err.message}\n`);
            return 1;
        }
    }
    process.stdout.write(JSON.stringify({ results }, null, 2) + "\n");
    return 0;
}
//# sourceMappingURL=hash-inputs.js.map
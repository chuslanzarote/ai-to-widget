import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { writeArtifactAtomic, exists } from "./lib/atomic.js";
import { normalizeForHash } from "./lib/normalize.js";
/**
 * Feature 008 / T007 — `atw-hash-inputs` reader/writer shape aligned with
 * `lib/input-hashes.ts` writer (research R14 / FR-006). On-disk shape:
 *
 *   {
 *     "schema_version": "1",
 *     "files": { "<relativePath>": "sha256:<hex>" | "<hex>", ... },
 *     "prompt_template_version": "<string>"
 *   }
 *
 * `sha256:<hex>` prefix is accepted on read (emitted by
 * `lib/input-hashes.ts#sha256File`) and on write (this CLI) for
 * round-trip fidelity with the main build pipeline.
 */
export const HashInputsStateSchema = z.object({
    schema_version: z.literal("1"),
    files: z.record(z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i)),
    prompt_template_version: z.string().default(""),
});
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
function stripPrefix(digest) {
    return digest.startsWith("sha256:") ? digest.slice(7) : digest;
}
export async function hashFile(filePath) {
    const raw = await fs.readFile(filePath);
    const normalized = normalizeForHash(raw);
    return createHash("sha256").update(normalized).digest("hex");
}
/**
 * D-HASHMISMATCH (FR-006) — emitted on read when the on-disk file does
 * not match the aligned schema.
 */
export class HashIndexSchemaMismatchError extends Error {
    actualShape;
    constructor(actualShape) {
        super(`ERROR: hash-index.json failed schema validation.\n` +
            `Expected shape: { schema_version: "1", files: Record<relativePath, sha256Hex> }\n` +
            `Found: ${actualShape}\n\n` +
            `Fix: delete .atw/artifacts/hash-index.json and re-run /atw.build.`);
        this.actualShape = actualShape;
        this.name = "HashIndexSchemaMismatchError";
    }
}
export async function loadState(statePath) {
    if (!(await exists(statePath)))
        return null;
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    const result = HashInputsStateSchema.safeParse(parsed);
    if (!result.success) {
        const shape = JSON.stringify({
            keys: Object.keys(parsed ?? {}),
            types: Object.fromEntries(Object.entries(parsed ?? {}).map(([k, v]) => [
                k,
                Array.isArray(v) ? "array" : typeof v,
            ])),
        }, null, 0);
        throw new HashIndexSchemaMismatchError(shape);
    }
    return result.data;
}
export async function computeHashResults(opts) {
    const previousFiles = opts.previous?.files ?? {};
    const results = [];
    for (const absInput of opts.inputs) {
        const relative = path.relative(opts.rootDir, absInput).replace(/\\/g, "/");
        const sha256 = await hashFile(absInput);
        const prev = previousFiles[relative] ? stripPrefix(previousFiles[relative]) : null;
        results.push({
            path: relative,
            sha256,
            previousSha256: prev,
            changed: prev !== null ? prev !== sha256 : true,
            kind: classifyKind(absInput),
        });
    }
    return results;
}
export async function writeState(statePath, results, opts = {}) {
    const files = { ...(opts.existing?.files ?? {}) };
    for (const r of results) {
        files[r.path] = `sha256:${r.sha256}`;
    }
    const state = {
        schema_version: "1",
        files,
        prompt_template_version: opts.promptTemplateVersion ?? opts.existing?.prompt_template_version ?? "",
    };
    HashInputsStateSchema.parse(state);
    await writeArtifactAtomic(statePath, JSON.stringify(state, null, 2) + "\n");
}
/**
 * D-INPUTSARGS (FR-007 / R15) — positional parser for `--inputs`.
 * Accepted forms:
 *   - `--inputs a.md b.md c.md` (whitespace-separated, terminated by next `--flag` or end)
 *   - `--inputs a.md,b.md,c.md` (legacy comma form, single argv entry)
 *   - `--inputs a.md` (single file)
 */
export function parseInputsPositional(argv) {
    const out = {
        root: null,
        inputs: [],
        updateState: false,
        verbose: false,
        promptTemplateVersion: "",
    };
    let i = 0;
    while (i < argv.length) {
        const tok = argv[i];
        if (tok === "--root") {
            out.root = argv[++i] ?? null;
            i++;
        }
        else if (tok.startsWith("--root=")) {
            out.root = tok.slice("--root=".length);
            i++;
        }
        else if (tok === "--inputs") {
            i++;
            while (i < argv.length && !argv[i].startsWith("--")) {
                out.inputs.push(argv[i]);
                i++;
            }
            // Legacy comma form: single arg containing commas becomes many
            if (out.inputs.length === 1 && out.inputs[0].includes(",")) {
                out.inputs = out.inputs[0].split(",").map((s) => s.trim()).filter(Boolean);
            }
        }
        else if (tok === "--update-state") {
            out.updateState = true;
            i++;
        }
        else if (tok === "--verbose") {
            out.verbose = true;
            i++;
        }
        else if (tok === "--prompt-template-version") {
            out.promptTemplateVersion = argv[++i] ?? "";
            i++;
        }
        else if (tok.startsWith("--prompt-template-version=")) {
            out.promptTemplateVersion = tok.slice("--prompt-template-version=".length);
            i++;
        }
        else {
            throw new Error(`ERROR: --inputs expected one or more file paths (space-separated).\n\n` +
                `Usage: atw-hash-inputs --inputs a.md b.md c.md`);
        }
    }
    return out;
}
function parseCli(argv) {
    const parsed = parseInputsPositional(argv);
    if (!parsed.root)
        throw new Error("--root is required");
    if (parsed.inputs.length === 0) {
        throw new Error(`ERROR: --inputs expected one or more file paths (space-separated).\n\n` +
            `Usage: atw-hash-inputs --inputs a.md b.md c.md`);
    }
    return {
        root: parsed.root,
        inputs: parsed.inputs,
        updateState: parsed.updateState,
        verbose: parsed.verbose,
        promptTemplateVersion: parsed.promptTemplateVersion,
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
        process.stderr.write(`atw-hash-inputs: ${err.message}\n`);
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
            await writeState(statePath, results, {
                promptTemplateVersion: opts.promptTemplateVersion,
                existing: previous,
            });
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
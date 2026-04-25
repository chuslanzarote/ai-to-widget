import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Handlebars from "handlebars";
import Debug from "debug";
import { readActionManifest } from "./lib/manifest-io.js";
const log = Debug("atw:render-backend");
export function manifestOperationsToRuntimeTools(ops) {
    return ops.map((op) => ({
        name: op.tool_name,
        description: op.description,
        input_schema: op.input_schema,
        http: { method: op.http.method, path_template: op.http.path_template },
        requires_confirmation: op.requires_confirmation,
        summary_template: op.summary_template,
    }));
}
export function loadRuntimeToolsFromManifest(manifestPath) {
    const { manifest } = readActionManifest(manifestPath);
    return manifestOperationsToRuntimeTools(manifest.operations);
}
export function defaultTemplatesDir() {
    // packages/backend/src when running from packages/scripts/dist or src
    const here = fileURLToPath(import.meta.url);
    // `here` is packages/scripts/dist/render-backend.js OR packages/scripts/src/render-backend.ts
    const pkgScripts = path.resolve(path.dirname(here), "..");
    // up one more to packages/, then into backend/src
    return path.resolve(pkgScripts, "..", "backend", "src");
}
async function walkHbs(dir, base, out) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        const abs = path.join(dir, e.name);
        if (e.isDirectory()) {
            await walkHbs(abs, base, out);
        }
        else if (e.isFile() && e.name.endsWith(".hbs")) {
            out.push(path.relative(base, abs).replace(/\\/g, "/"));
        }
    }
}
export async function renderBackend(opts) {
    const templates = [];
    await walkHbs(opts.templatesDir, opts.templatesDir, templates);
    templates.sort();
    const results = [];
    await fs.mkdir(opts.outputDir, { recursive: true });
    // Pre-stringify the tool list so the template can splat it raw via {{{toolsJson}}}.
    const ctx = {
        ...opts.context,
        toolsJson: opts.context.toolsJson ??
            (opts.context.tools ? JSON.stringify(opts.context.tools, null, 2) : "[]"),
    };
    for (const name of templates) {
        const src = await fs.readFile(path.join(opts.templatesDir, name), "utf8");
        const tpl = Handlebars.compile(src, { noEscape: true, strict: true });
        let rendered;
        try {
            rendered = tpl(ctx);
        }
        catch (err) {
            const e = new Error(`Template ${name} compile error: ${err.message}`);
            e.code = "TEMPLATE_COMPILE";
            throw e;
        }
        // Ensure stable line endings (LF) for determinism across platforms.
        rendered = rendered.replace(/\r\n/g, "\n");
        const targetName = name.replace(/\.hbs$/, "");
        const targetAbs = path.join(opts.outputDir, targetName);
        await fs.mkdir(path.dirname(targetAbs), { recursive: true });
        const rel = path.relative(path.dirname(opts.outputDir), targetAbs).replace(/\\/g, "/");
        let action = "created";
        let backup;
        let prior = null;
        try {
            prior = await fs.readFile(targetAbs, "utf8");
        }
        catch {
            prior = null;
        }
        if (prior !== null) {
            if (prior === rendered) {
                action = "unchanged";
            }
            else {
                action = "rewritten";
                if (opts.backup) {
                    backup = targetAbs + ".bak";
                    await fs.writeFile(backup, prior, "utf8");
                }
            }
        }
        if (action !== "unchanged") {
            await fs.writeFile(targetAbs, rendered, "utf8");
        }
        const buf = Buffer.from(rendered, "utf8");
        const sha256 = createHash("sha256").update(buf).digest("hex");
        results.push({
            path: rel,
            sha256,
            bytes: buf.byteLength,
            action,
            backup: backup
                ? path.relative(path.dirname(opts.outputDir), backup).replace(/\\/g, "/")
                : undefined,
        });
        log("%s -> %s (%s, %d bytes)", name, targetAbs, action, buf.byteLength);
    }
    return results;
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "templates-dir": { type: "string" },
            "output-dir": { type: "string" },
            "project-name": { type: "string" },
            "embedding-model": { type: "string" },
            "anthropic-model": { type: "string" },
            backup: { type: "boolean", default: false },
            json: { type: "boolean", default: false },
            help: { type: "boolean", default: false, short: "h" },
            version: { type: "boolean", default: false, short: "v" },
        },
        strict: true,
    });
    if (values.help)
        return { help: true };
    if (values.version)
        return { version: true };
    return {
        templatesDir: String(values["templates-dir"] ?? defaultTemplatesDir()),
        outputDir: String(values["output-dir"] ?? path.resolve(process.cwd(), "backend", "src")),
        projectName: String(values["project-name"] ?? "unknown"),
        embeddingModel: String(values["embedding-model"] ?? "Xenova/bge-small-multilingual-v1.5"),
        anthropicModel: String(values["anthropic-model"] ?? "claude-opus-4-7"),
        backup: Boolean(values.backup),
        json: Boolean(values.json),
    };
}
export async function runRenderBackend(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-render-backend: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-render-backend [--templates-dir <p>] [--output-dir <p>] [--project-name <s>] [--backup] [--json]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-render-backend 0.1.0\n");
        return 0;
    }
    try {
        const results = await renderBackend({
            templatesDir: opts.templatesDir,
            outputDir: opts.outputDir,
            backup: opts.backup,
            context: {
                projectName: opts.projectName,
                embeddingModel: opts.embeddingModel,
                anthropicModel: opts.anthropicModel,
                generatedAt: "2026-04-22T00:00:00Z",
            },
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify({ rendered: results }) + "\n");
        }
        else {
            for (const r of results) {
                process.stdout.write(`${r.action} ${r.path}\n`);
            }
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        if (code === "TEMPLATE_COMPILE") {
            process.stderr.write(`atw-render-backend: ${err.message}\n`);
            return 17;
        }
        process.stderr.write(`atw-render-backend: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=render-backend.js.map
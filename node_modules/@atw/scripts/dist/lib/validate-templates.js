import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";
const here = fileURLToPath(import.meta.url);
export function defaultBackendDir() {
    // here = packages/scripts/{dist|src}/lib/validate-templates.{js|ts}
    return path.resolve(here, "..", "..", "..", "..", "backend", "src");
}
export function defaultEmbedDir() {
    return path.resolve(here, "..", "..", "embed-templates");
}
/**
 * Canonical fixture context used to render every backend template. The
 * fields mirror what `render-backend.ts` emits at runtime; values are
 * representative but synthetic so renders are deterministic.
 */
export function canonicalBackendContext() {
    const tools = [
        {
            name: "list_products",
            description: "List storefront products.",
            input_schema: { type: "object", properties: {}, additionalProperties: false },
            http: { method: "GET", path_template: "/store/products" },
            requires_confirmation: false,
            summary_template: "List products",
        },
        {
            name: "add_to_cart",
            description: "Add a line item to the cart.",
            input_schema: {
                type: "object",
                properties: { variant_id: { type: "string" } },
                required: ["variant_id"],
                additionalProperties: false,
            },
            http: { method: "POST", path_template: "/store/carts/{cart_id}/line-items" },
            requires_confirmation: true,
            summary_template: "Add {variant_id} to cart",
        },
    ];
    return {
        projectName: "fixture",
        embeddingModel: "Xenova/bge-small-multilingual-v1.5",
        anthropicModel: "claude-opus-4-7",
        generatedAt: "2026-04-25T00:00:00Z",
        tools,
        toolsJson: JSON.stringify(tools, null, 2),
    };
}
/**
 * Canonical fixture context used to render every embed template.
 */
export function canonicalEmbedContext() {
    return {
        framework: "plain-html",
        backendUrl: "https://atw.example.com",
        apiBaseUrl: "https://api.example.com",
        hostPageOrigin: "https://www.example.com",
        hostApiOrigin: "https://api.example.com",
        atwBackendOrigin: "https://atw.example.com",
        authMode: "cookie",
        authTokenKey: "",
        loginUrl: "https://www.example.com/login",
        locale: "en-US",
        themePrimary: "#0055aa",
        themeRadius: "8px",
        themeFont: "Inter, sans-serif",
        generatedAt: "2026-04-25T00:00:00Z",
    };
}
async function listHbs(dir) {
    const out = [];
    async function walk(d) {
        let entries;
        try {
            entries = await fs.readdir(d, { withFileTypes: true });
        }
        catch {
            return;
        }
        for (const e of entries) {
            const abs = path.join(d, e.name);
            if (e.isDirectory())
                await walk(abs);
            else if (e.isFile() && e.name.endsWith(".hbs"))
                out.push(abs);
        }
    }
    await walk(dir);
    out.sort();
    return out;
}
function freshHandlebars() {
    const h = Handlebars.create();
    h.registerHelper("eq", (a, b) => a === b);
    h.registerHelper("json", (v) => JSON.stringify(v));
    return h;
}
export async function validateTemplates(opts = {}) {
    const backendDir = opts.backendDir ?? defaultBackendDir();
    const embedDir = opts.embedDir ?? defaultEmbedDir();
    const issues = [];
    let rendered = 0;
    let renderDir;
    const hb = freshHandlebars();
    // Render backend templates into a temp dir so we can optionally run tsc.
    const backendTemplates = await listHbs(backendDir);
    if (backendTemplates.length > 0) {
        const os = await import("node:os");
        renderDir = await fs.mkdtemp(path.join(os.tmpdir(), "atw-validate-tpl-"));
        const ctx = canonicalBackendContext();
        for (const abs of backendTemplates) {
            const rel = path.relative(backendDir, abs).replace(/\\/g, "/");
            const src = await fs.readFile(abs, "utf8");
            let tpl;
            try {
                tpl = hb.compile(src, { noEscape: true, strict: false });
            }
            catch (err) {
                issues.push({ file: rel, phase: "compile", message: err.message });
                continue;
            }
            let out;
            try {
                out = tpl(ctx);
            }
            catch (err) {
                issues.push({ file: rel, phase: "render", message: err.message });
                continue;
            }
            const targetRel = rel.replace(/\.hbs$/, "");
            const targetAbs = path.join(renderDir, "src", targetRel);
            await fs.mkdir(path.dirname(targetAbs), { recursive: true });
            await fs.writeFile(targetAbs, out, "utf8");
            rendered += 1;
        }
        if (opts.runTsc && backendTemplates.length > 0) {
            const tscIssues = await runTscNoEmit(renderDir, backendDir);
            issues.push(...tscIssues);
        }
    }
    // Render embed templates — these emit Markdown so type-checking does
    // not apply. Compilation failures are still caught here.
    const embedTemplates = await listHbs(embedDir);
    if (embedTemplates.length > 0) {
        const ctx = canonicalEmbedContext();
        for (const abs of embedTemplates) {
            const rel = path.relative(embedDir, abs).replace(/\\/g, "/");
            const src = await fs.readFile(abs, "utf8");
            let tpl;
            try {
                tpl = hb.compile(src, { noEscape: true, strict: false });
            }
            catch (err) {
                issues.push({ file: rel, phase: "compile", message: err.message });
                continue;
            }
            try {
                tpl(ctx);
                rendered += 1;
            }
            catch (err) {
                issues.push({ file: rel, phase: "render", message: err.message });
            }
        }
    }
    // Cleanup temp render dir on success; preserve on failure for inspection.
    if (renderDir && issues.length === 0) {
        await fs.rm(renderDir, { recursive: true, force: true });
        renderDir = undefined;
    }
    return { ok: issues.length === 0, rendered, issues, renderDir };
}
async function runTscNoEmit(renderDir, backendSourceDir) {
    // Stage a tsconfig pointing at the rendered backend src and reuse the
    // backend package's installed type roots.
    const backendPkg = path.resolve(backendSourceDir, "..");
    const tsconfig = {
        extends: path.resolve(backendPkg, "..", "..", "tsconfig.base.json"),
        compilerOptions: {
            rootDir: "./src",
            outDir: "./dist",
            noEmit: true,
            typeRoots: [path.join(backendPkg, "node_modules", "@types")],
            paths: {},
            baseUrl: ".",
        },
        include: ["src/**/*.ts"],
    };
    const tsconfigPath = path.join(renderDir, "tsconfig.json");
    await fs.writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
    // Symlink (or copy) node_modules from the backend so type resolution works.
    const linkTarget = path.join(renderDir, "node_modules");
    try {
        await fs.symlink(path.join(backendPkg, "node_modules"), linkTarget, "junction");
    }
    catch {
        // Fallback: leave it; tsc will fail with "Cannot find module" — surfaced as issues.
    }
    const tscBin = process.platform === "win32"
        ? path.join(backendPkg, "node_modules", ".bin", "tsc.cmd")
        : path.join(backendPkg, "node_modules", ".bin", "tsc");
    const res = spawnSync(tscBin, ["--noEmit", "-p", tsconfigPath], {
        encoding: "utf8",
        shell: false,
    });
    if (res.status === 0)
        return [];
    const stdout = (res.stdout ?? "") + (res.stderr ?? "");
    return [{ file: "<tsc>", phase: "tsc", message: stdout.trim() }];
}
// When invoked directly (e.g. `node ./dist/lib/validate-templates.js --tsc`)
// run the CLI and propagate the exit code. Wired as a postbuild step in
// `packages/scripts/package.json` so renders happen before `dist/` is
// considered shippable.
const invokedAsScript = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsScript) {
    runValidateTemplatesCli(process.argv.slice(2)).then((code) => process.exit(code), (err) => {
        process.stderr.write(`atw-validate-templates: ${err.message}\n`);
        process.exit(1);
    });
}
export async function runValidateTemplatesCli(argv) {
    const runTsc = argv.includes("--tsc");
    const result = await validateTemplates({ runTsc });
    if (result.ok) {
        process.stdout.write(`atw-validate-templates: OK (${result.rendered} templates)\n`);
        return 0;
    }
    for (const i of result.issues) {
        process.stderr.write(`atw-validate-templates [${i.phase}] ${i.file}: ${i.message}\n`);
    }
    if (result.renderDir) {
        process.stderr.write(`atw-validate-templates: rendered output preserved at ${result.renderDir}\n`);
    }
    return 1;
}
//# sourceMappingURL=validate-templates.js.map
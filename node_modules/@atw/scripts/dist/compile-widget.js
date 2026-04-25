import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { parseArgs } from "node:util";
import Debug from "debug";
const log = Debug("atw:compile-widget");
/**
 * Resolve the widget entry point through Node's module resolver against the
 * `@atw/widget` package. Works identically inside the monorepo (via npm
 * workspaces) and for external Builders who install `@atw/widget` as a
 * transitive dependency of `@atw/scripts`. Never inspects the caller's
 * process.cwd() — the source is the installed package, full stop (FR-011).
 */
export function resolveWidgetSource() {
    const require = createRequire(import.meta.url);
    let pkgPath;
    try {
        pkgPath = require.resolve("@atw/widget/package.json");
    }
    catch {
        const err = new Error("cannot resolve @atw/widget — ensure it is listed as a dependency of your project and install it with npm/pnpm/yarn.");
        err.code = "WIDGET_SOURCE_MISSING";
        throw err;
    }
    const widgetRoot = path.dirname(pkgPath);
    const entry = path.join(widgetRoot, "src", "index.ts");
    // A resolvable package.json with a missing src/index.ts is still a
    // WIDGET_SOURCE_MISSING failure — the contract asks for a real entry.
    return {
        entry,
        widgetRoot,
        packageVersion: String(require(pkgPath).version ?? "0.0.0"),
    };
}
/**
 * Deterministic sha256 over every file under <widgetRoot>/src/. The digest
 * inputs are the sorted `<relative_path>\t<file_sha256>` lines (LF separated)
 * so the hash is OS-independent and identical for two identical trees.
 */
export async function computeWidgetTreeHash(widgetRoot) {
    const srcDir = path.join(widgetRoot, "src");
    const entries = [];
    await walkFiles(srcDir, srcDir, entries);
    entries.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
    const body = entries.map((e) => `${e.rel}\t${e.sha}`).join("\n");
    const digest = createHash("sha256").update(body).digest("hex");
    return `sha256:${digest}`;
}
async function walkFiles(dir, rootDir, out) {
    let dirents;
    try {
        dirents = await fs.readdir(dir, { withFileTypes: true });
    }
    catch (err) {
        const e = new Error(`@atw/widget source tree not found at ${dir}: ${err.message}`);
        e.code = "WIDGET_SOURCE_MISSING";
        throw e;
    }
    for (const ent of dirents) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            await walkFiles(abs, rootDir, out);
        }
        else if (ent.isFile()) {
            const buf = await fs.readFile(abs);
            const sha = createHash("sha256").update(buf).digest("hex");
            const rel = path.relative(rootDir, abs).split(path.sep).join("/");
            out.push({ rel, sha });
        }
    }
}
export async function compileWidget(opts) {
    await fs.mkdir(opts.outDir, { recursive: true });
    const source = resolveWidgetSource();
    // Verify the entry exists before we hand it to esbuild — turns a cryptic
    // esbuild error into a clean WIDGET_SOURCE_MISSING.
    try {
        await fs.access(source.entry);
    }
    catch {
        const err = new Error(`@atw/widget installed but ${source.entry} is missing — the widget package may be corrupt.`);
        err.code = "WIDGET_SOURCE_MISSING";
        throw err;
    }
    const jsPath = path.join(opts.outDir, "widget.js");
    const cssPath = path.join(opts.outDir, "widget.css");
    const esbuild = await import("esbuild");
    // Determinism: static banner, no sourcemap, no metafile, empty define —
    // two consecutive builds on unchanged source produce byte-identical output
    // (FR-005, Feature 002 SC-016).
    try {
        await esbuild.build({
            entryPoints: [source.entry],
            outfile: jsPath,
            bundle: true,
            format: "iife",
            globalName: "AtwWidget",
            platform: "browser",
            target: ["es2020"],
            minify: opts.minify ?? false,
            sourcemap: false,
            write: true,
            loader: { ".css": "css" },
            banner: { js: "/* atw-widget */" },
            define: {},
            legalComments: "none",
        });
    }
    catch (err) {
        const e = new Error(`esbuild failed: ${err.message}`);
        e.code = "ESBUILD";
        throw e;
    }
    // esbuild writes a sibling .css when the entry imports a CSS file. If the
    // widget has no CSS imports at all, emit a placeholder so manifest layout
    // stays uniform (real widget today does import styles.css, so this path
    // is exercised only by test fixtures).
    try {
        await fs.access(cssPath);
    }
    catch {
        await fs.writeFile(cssPath, "/* atw widget: no css */\n", "utf8");
    }
    const treeHash = await computeWidgetTreeHash(source.widgetRoot);
    const { jsGz, cssGz } = await enforceBundleBudget(jsPath, cssPath);
    log("bundle size ok: widget.js.gz=%d/%d, widget.css.gz=%d/%d", jsGz, BUNDLE_BUDGETS_GZIP.js, cssGz, BUNDLE_BUDGETS_GZIP.css);
    return {
        js: await describeAsset(jsPath, jsGz),
        css: await describeAsset(cssPath, cssGz),
        source: {
            package_version: source.packageVersion,
            tree_hash: treeHash,
        },
    };
}
const BUNDLE_BUDGETS_GZIP = {
    js: 80 * 1024,
    css: 10 * 1024,
};
async function enforceBundleBudget(jsPath, cssPath) {
    const { gzipSync } = await import("node:zlib");
    const jsBuf = await fs.readFile(jsPath);
    const cssBuf = await fs.readFile(cssPath);
    const jsGz = gzipSync(jsBuf).byteLength;
    const cssGz = gzipSync(cssBuf).byteLength;
    const overs = [];
    if (jsGz > BUNDLE_BUDGETS_GZIP.js) {
        overs.push(`widget.js.gz = ${jsGz} bytes > ${BUNDLE_BUDGETS_GZIP.js} budget`);
    }
    if (cssGz > BUNDLE_BUDGETS_GZIP.css) {
        overs.push(`widget.css.gz = ${cssGz} bytes > ${BUNDLE_BUDGETS_GZIP.css} budget`);
    }
    if (overs.length > 0) {
        const e = new Error("bundle budget exceeded (FR-027/SC-009): " + overs.join("; "));
        e.code = "BUNDLE_BUDGET_EXCEEDED";
        throw e;
    }
    return { jsGz, cssGz };
}
async function describeAsset(p, gzipBytes) {
    const buf = await fs.readFile(p);
    return {
        path: p,
        bytes: buf.byteLength,
        gzip_bytes: gzipBytes,
        sha256: createHash("sha256").update(buf).digest("hex"),
    };
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "out-dir": { type: "string" },
            minify: { type: "boolean" },
            "no-minify": { type: "boolean" },
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
    const minify = values["no-minify"] ? false : Boolean(values.minify);
    return {
        outDir: String(values["out-dir"] ?? path.resolve(process.cwd(), "dist")),
        minify,
        json: Boolean(values.json),
    };
}
export async function runCompileWidget(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-compile-widget: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-compile-widget [--out-dir <p>] [--minify|--no-minify] [--json]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-compile-widget 0.1.0\n");
        return 0;
    }
    try {
        const result = await compileWidget({
            outDir: opts.outDir,
            minify: opts.minify,
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`bundled js=${result.js.bytes}B css=${result.css.bytes}B source=${result.source.package_version}\n`);
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        const msg = err.message;
        if (code === "WIDGET_SOURCE_MISSING") {
            process.stderr.write(`atw-compile-widget: ${msg}\n`);
            return 3;
        }
        if (code === "BUNDLE_BUDGET_EXCEEDED") {
            process.stderr.write(`atw-compile-widget: ${msg}\n`);
            return 17;
        }
        if (code === "ESBUILD") {
            process.stderr.write(`atw-compile-widget: ${msg}\n`);
            return 18;
        }
        process.stderr.write(`atw-compile-widget: ${msg}\n`);
        return 1;
    }
}
//# sourceMappingURL=compile-widget.js.map
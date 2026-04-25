import { existsSync, promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import Debug from "debug";
import Handlebars from "handlebars";
import { loadProjectConfig, ProjectConfigError } from "./lib/runtime-config.js";
const log = Debug("atw:embed");
// Equality helper used by embed templates (e.g., `{{#if (eq authMode "cookie")}}`).
Handlebars.registerHelper("eq", (a, b) => a === b);
export const SUPPORTED_FRAMEWORKS = [
    "next-app-router",
    "next-pages-router",
    "plain-html",
    "custom",
];
export const SUPPORTED_AUTH_MODES = ["cookie", "bearer", "custom"];
/* -------------------------- precondition checks -------------------------- */
export function checkPreconditions(projectRoot) {
    const missing = [];
    const req = [
        path.join(projectRoot, "dist", "widget.js"),
        path.join(projectRoot, "dist", "widget.css"),
        path.join(projectRoot, ".atw", "state", "build-manifest.json"),
        path.join(projectRoot, ".atw", "artifacts", "action-manifest.md"),
    ];
    for (const p of req)
        if (!existsSync(p))
            missing.push(path.relative(projectRoot, p));
    return { ok: missing.length === 0, missing };
}
/* ----------------------------- answers parser ---------------------------- */
/**
 * Parse the simple YAML-front-matter shape we persist to
 * `.atw/state/embed-answers.md` (data-model §4.1).
 */
export function parseAnswersMarkdown(source) {
    const m = /^---\n([\s\S]*?)\n---/m.exec(source);
    if (!m)
        throw new Error("embed-answers.md: missing front-matter");
    const lines = m[1].split("\n").map((l) => l.replace(/\r$/, ""));
    const map = new Map();
    let inTheme = false;
    for (const raw of lines) {
        if (raw.trim().length === 0)
            continue;
        if (raw.startsWith("theme:")) {
            inTheme = true;
            continue;
        }
        if (inTheme && raw.startsWith("  ")) {
            const kv = raw.trim().match(/^([a-zA-Z_]+):\s*["']?([^"']*)["']?$/);
            if (kv)
                map.set("theme_" + kv[1], kv[2]);
            continue;
        }
        inTheme = false;
        const kv = raw.match(/^([a-zA-Z_]+):\s*["']?([^"']*)["']?$/);
        if (kv)
            map.set(kv[1], kv[2]);
    }
    const framework = requireEnum(map, "framework", SUPPORTED_FRAMEWORKS);
    const authMode = requireEnum(map, "auth_mode", SUPPORTED_AUTH_MODES);
    const backendUrl = requireNonEmpty(map, "backend_url");
    assertHttpUrl(backendUrl, "backend_url");
    const apiBaseUrl = map.get("api_base_url");
    if (apiBaseUrl)
        assertHttpUrl(apiBaseUrl, "api_base_url");
    const authTokenKey = map.get("auth_token_key");
    if (authMode === "bearer" && !authTokenKey) {
        throw new Error('embed-answers.md: "auth_token_key" is required when auth_mode=bearer');
    }
    return {
        framework: framework,
        authMode: authMode,
        backendUrl,
        authTokenKey,
        apiBaseUrl,
        loginUrl: map.get("login_url") || undefined,
        locale: map.get("locale") || undefined,
        themePrimary: map.get("theme_primary") || undefined,
        themeRadius: map.get("theme_radius") || undefined,
        themeFont: map.get("theme_font") || undefined,
    };
}
export function formatAnswersMarkdown(answers, now) {
    const lines = [
        "---",
        `framework: ${answers.framework}`,
        `backend_url: ${answers.backendUrl}`,
        `auth_mode: ${answers.authMode}`,
    ];
    if (answers.authTokenKey)
        lines.push(`auth_token_key: ${answers.authTokenKey}`);
    if (answers.apiBaseUrl)
        lines.push(`api_base_url: ${answers.apiBaseUrl}`);
    if (answers.loginUrl)
        lines.push(`login_url: ${answers.loginUrl}`);
    if (answers.locale)
        lines.push(`locale: ${answers.locale}`);
    if (answers.themePrimary || answers.themeRadius || answers.themeFont) {
        lines.push("theme:");
        if (answers.themePrimary)
            lines.push(`  primary: "${answers.themePrimary}"`);
        if (answers.themeRadius)
            lines.push(`  radius: "${answers.themeRadius}"`);
        if (answers.themeFont)
            lines.push(`  font: "${answers.themeFont}"`);
    }
    lines.push("---", "", "# Embed answers", "", `Captured on ${now.slice(0, 10)}.`);
    lines.push("", "Re-run `/atw.embed` to regenerate `embed-guide.md` after changing any of the values above.", "");
    return lines.join("\n");
}
function requireNonEmpty(map, key) {
    const v = map.get(key);
    if (!v || v.length === 0)
        throw new Error(`embed-answers.md: "${key}" is required`);
    return v;
}
function requireEnum(map, key, allowed) {
    const v = requireNonEmpty(map, key);
    if (!allowed.includes(v)) {
        throw new Error(`embed-answers.md: "${key}" must be one of ${allowed.join(", ")}`);
    }
    return v;
}
function assertHttpUrl(value, key) {
    try {
        const u = new URL(value);
        if (!["http:", "https:"].includes(u.protocol))
            throw new Error("scheme");
    }
    catch {
        throw new Error(`embed-answers.md: "${key}" must be an absolute http(s) URL`);
    }
}
/* ----------------------------- template loader --------------------------- */
function thisDir() {
    const here = fileURLToPath(import.meta.url);
    return path.dirname(here);
}
function loadTemplate(framework) {
    const here = thisDir();
    // Templates live under src/ (.ts source tree) and are copied to dist/
    // only when explicitly included; resolve either way.
    const candidates = [
        path.resolve(here, "embed-templates", `${framework}.hbs`),
        path.resolve(here, "..", "src", "embed-templates", `${framework}.hbs`),
    ];
    for (const p of candidates) {
        if (existsSync(p))
            return readFileSync(p, "utf8");
    }
    throw new Error(`embed template not found for framework "${framework}"`);
}
/* ------------------------------ render entry ----------------------------- */
/**
 * Load the project.md context that the embed templates inline (FR-013,
 * FR-014). When project.md is missing or invalid we fall back to the
 * legacy `apiBaseUrl`/`backendUrl` answers — the embed guide will still
 * render but the integrator-grade values won't be inlined. The first
 * call site to fail validation (init / build) will surface the issue.
 */
function projectContext(opts) {
    try {
        const cfg = loadProjectConfig({ projectRoot: opts.projectRoot });
        return {
            hostPageOrigin: cfg.host_page_origin,
            hostApiOrigin: cfg.host_api_origin,
            atwBackendOrigin: cfg.atw_backend_origin,
            loginUrl: cfg.login_url ?? opts.answers.loginUrl ?? "",
            cfg,
        };
    }
    catch (err) {
        if (!(err instanceof ProjectConfigError))
            throw err;
        return {
            hostPageOrigin: "",
            hostApiOrigin: opts.answers.apiBaseUrl ?? "",
            atwBackendOrigin: opts.answers.backendUrl,
            loginUrl: opts.answers.loginUrl ?? "",
            cfg: null,
        };
    }
}
function envExample(hostPageOrigin) {
    // Multiline comma-separated origin list (FR-017, E5). The integrator
    // pastes their ANTHROPIC_API_KEY; we never emit one.
    return [
        "# Filled by /atw.embed — values are inlined from .atw/config/project.md.",
        "# ANTHROPIC_API_KEY is intentionally blank: paste your own.",
        "ANTHROPIC_API_KEY=",
        "DATABASE_URL=postgresql://atw:atw@localhost:5432/atw",
        `# Comma-separate multiple origins, e.g. ${hostPageOrigin || "http://localhost:8080"},https://staging.example.com`,
        `ALLOWED_ORIGINS=${hostPageOrigin}`,
        "",
    ].join("\n");
}
export async function renderEmbedGuide(opts) {
    const pre = checkPreconditions(opts.projectRoot);
    if (!pre.ok) {
        const err = new Error(`atw-embed: missing ${pre.missing.join(", ")}. Run /atw.build first.`);
        err.code = "PRECONDITIONS_MISSING";
        throw err;
    }
    const now = opts.frozenTime ?? new Date().toISOString();
    const template = loadTemplate(opts.answers.framework);
    const compiled = Handlebars.compile(template, { noEscape: true, strict: true });
    const proj = projectContext(opts);
    const rendered = compiled({
        framework: opts.answers.framework,
        backendUrl: proj.atwBackendOrigin,
        apiBaseUrl: proj.hostApiOrigin,
        hostPageOrigin: proj.hostPageOrigin,
        hostApiOrigin: proj.hostApiOrigin,
        atwBackendOrigin: proj.atwBackendOrigin,
        authMode: opts.answers.authMode,
        authTokenKey: opts.answers.authTokenKey ?? "",
        loginUrl: proj.loginUrl,
        locale: opts.answers.locale ?? "en-US",
        themePrimary: opts.answers.themePrimary ?? "",
        themeRadius: opts.answers.themeRadius ?? "",
        themeFont: opts.answers.themeFont ?? "",
        generatedAt: now,
    });
    const outputPath = opts.outputPath ??
        path.join(opts.projectRoot, ".atw", "artifacts", "embed-guide.md");
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, rendered, "utf8");
    // FR-017, E5: emit a sibling .env.example with ALLOWED_ORIGINS inlined
    // from project.md.host_page_origin so the integrator does not have to
    // chase down the value.
    const envPath = path.join(opts.projectRoot, "atw", ".env.example");
    await fs.mkdir(path.dirname(envPath), { recursive: true });
    await fs.writeFile(envPath, envExample(proj.hostPageOrigin), "utf8");
    // Persist the answers file alongside so re-runs are idempotent.
    const answersPath = path.join(opts.projectRoot, ".atw", "state", "embed-answers.md");
    await fs.mkdir(path.dirname(answersPath), { recursive: true });
    await fs.writeFile(answersPath, formatAnswersMarkdown(opts.answers, now), "utf8");
    const { createHash } = await import("node:crypto");
    const sha256 = createHash("sha256").update(rendered).digest("hex");
    log("wrote %s (%d bytes, sha256=%s)", outputPath, rendered.length, sha256);
    return { outputPath, bytesWritten: rendered.length, sha256 };
}
function parseCli(argv, cwd) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "answers-file": { type: "string" },
            output: { type: "string" },
            "frozen-time": { type: "string" },
            "project-root": { type: "string" },
            help: { type: "boolean", default: false, short: "h" },
            version: { type: "boolean", default: false, short: "v" },
        },
        strict: true,
    });
    return {
        answersFile: values["answers-file"]?.toString(),
        output: values.output?.toString(),
        frozenTime: values["frozen-time"]?.toString(),
        projectRoot: values["project-root"]?.toString() ?? cwd,
        help: Boolean(values.help),
        version: Boolean(values.version),
    };
}
export async function runEmbedCli(argv, cwd = process.cwd()) {
    let opts;
    try {
        opts = parseCli(argv, cwd);
    }
    catch (err) {
        process.stderr.write(`atw-embed: ${err.message}\n`);
        return 4;
    }
    if (opts.help) {
        process.stdout.write("atw-embed [--answers-file <path>] [--output <path>] [--frozen-time <iso>] [--project-root <path>]\n");
        return 0;
    }
    if (opts.version) {
        process.stdout.write("atw-embed 0.3.0\n");
        return 0;
    }
    const pre = checkPreconditions(opts.projectRoot);
    if (!pre.ok) {
        process.stderr.write(`atw-embed: missing ${pre.missing.join(", ")}. Run /atw.build first.\n`);
        return 3;
    }
    if (!opts.answersFile) {
        process.stderr.write("atw-embed: --answers-file is required in non-interactive mode. Interactive prompting will be added by the Claude Code slash command.\n");
        return 4;
    }
    let answers;
    try {
        const raw = await fs.readFile(opts.answersFile, "utf8");
        answers = parseAnswersMarkdown(raw);
    }
    catch (err) {
        process.stderr.write(`atw-embed: ${err.message}\n`);
        return 4;
    }
    try {
        const res = await renderEmbedGuide({
            projectRoot: opts.projectRoot,
            answers,
            outputPath: opts.output,
            frozenTime: opts.frozenTime,
        });
        process.stdout.write(`wrote ${path.relative(opts.projectRoot, res.outputPath)} (${res.bytesWritten} bytes)\n`);
        return 0;
    }
    catch (err) {
        const code = err?.code;
        if (code === "PRECONDITIONS_MISSING") {
            process.stderr.write(`${err.message}\n`);
            return 3;
        }
        process.stderr.write(`atw-embed: ${err.message}\n`);
        return 17;
    }
}
//# sourceMappingURL=embed.js.map
import { existsSync, promises as fs, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import Debug from "debug";
import Handlebars from "handlebars";

const log = Debug("atw:embed");

// Equality helper used by embed templates (e.g., `{{#if (eq authMode "cookie")}}`).
Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);

export const SUPPORTED_FRAMEWORKS = [
  "next-app-router",
  "next-pages-router",
  "plain-html",
  "custom",
] as const;
export type Framework = (typeof SUPPORTED_FRAMEWORKS)[number];

export const SUPPORTED_AUTH_MODES = ["cookie", "bearer", "custom"] as const;
export type AuthMode = (typeof SUPPORTED_AUTH_MODES)[number];

export interface EmbedAnswers {
  framework: Framework;
  backendUrl: string;
  authMode: AuthMode;
  authTokenKey?: string;
  apiBaseUrl?: string;
  loginUrl?: string;
  locale?: string;
  themePrimary?: string;
  themeRadius?: string;
  themeFont?: string;
}

export interface EmbedOptions {
  projectRoot: string;
  answers: EmbedAnswers;
  outputPath?: string;
  frozenTime?: string;
}

export interface EmbedResult {
  outputPath: string;
  bytesWritten: number;
  sha256: string;
}

/* -------------------------- precondition checks -------------------------- */

export function checkPreconditions(projectRoot: string): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  const req = [
    path.join(projectRoot, "dist", "widget.js"),
    path.join(projectRoot, "dist", "widget.css"),
    path.join(projectRoot, ".atw", "state", "build-manifest.json"),
    path.join(projectRoot, ".atw", "artifacts", "action-manifest.md"),
  ];
  for (const p of req) if (!existsSync(p)) missing.push(path.relative(projectRoot, p));
  return { ok: missing.length === 0, missing };
}

/* ----------------------------- answers parser ---------------------------- */

/**
 * Parse the simple YAML-front-matter shape we persist to
 * `.atw/state/embed-answers.md` (data-model §4.1).
 */
export function parseAnswersMarkdown(source: string): EmbedAnswers {
  const m = /^---\n([\s\S]*?)\n---/m.exec(source);
  if (!m) throw new Error("embed-answers.md: missing front-matter");
  const lines = m[1].split("\n").map((l) => l.replace(/\r$/, ""));
  const map = new Map<string, string>();
  let inTheme = false;
  for (const raw of lines) {
    if (raw.trim().length === 0) continue;
    if (raw.startsWith("theme:")) {
      inTheme = true;
      continue;
    }
    if (inTheme && raw.startsWith("  ")) {
      const kv = raw.trim().match(/^([a-zA-Z_]+):\s*["']?([^"']*)["']?$/);
      if (kv) map.set("theme_" + kv[1], kv[2]);
      continue;
    }
    inTheme = false;
    const kv = raw.match(/^([a-zA-Z_]+):\s*["']?([^"']*)["']?$/);
    if (kv) map.set(kv[1], kv[2]);
  }
  const framework = requireEnum(map, "framework", SUPPORTED_FRAMEWORKS as readonly string[]);
  const authMode = requireEnum(map, "auth_mode", SUPPORTED_AUTH_MODES as readonly string[]);
  const backendUrl = requireNonEmpty(map, "backend_url");
  assertHttpUrl(backendUrl, "backend_url");
  const apiBaseUrl = map.get("api_base_url");
  if (apiBaseUrl) assertHttpUrl(apiBaseUrl, "api_base_url");
  const authTokenKey = map.get("auth_token_key");
  if (authMode === "bearer" && !authTokenKey) {
    throw new Error('embed-answers.md: "auth_token_key" is required when auth_mode=bearer');
  }
  return {
    framework: framework as Framework,
    authMode: authMode as AuthMode,
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

export function formatAnswersMarkdown(answers: EmbedAnswers, now: string): string {
  const lines = [
    "---",
    `framework: ${answers.framework}`,
    `backend_url: ${answers.backendUrl}`,
    `auth_mode: ${answers.authMode}`,
  ];
  if (answers.authTokenKey) lines.push(`auth_token_key: ${answers.authTokenKey}`);
  if (answers.apiBaseUrl) lines.push(`api_base_url: ${answers.apiBaseUrl}`);
  if (answers.loginUrl) lines.push(`login_url: ${answers.loginUrl}`);
  if (answers.locale) lines.push(`locale: ${answers.locale}`);
  if (answers.themePrimary || answers.themeRadius || answers.themeFont) {
    lines.push("theme:");
    if (answers.themePrimary) lines.push(`  primary: "${answers.themePrimary}"`);
    if (answers.themeRadius) lines.push(`  radius: "${answers.themeRadius}"`);
    if (answers.themeFont) lines.push(`  font: "${answers.themeFont}"`);
  }
  lines.push("---", "", "# Embed answers", "", `Captured on ${now.slice(0, 10)}.`);
  lines.push(
    "",
    "Re-run `/atw.embed` to regenerate `embed-guide.md` after changing any of the values above.",
    "",
  );
  return lines.join("\n");
}

function requireNonEmpty(map: Map<string, string>, key: string): string {
  const v = map.get(key);
  if (!v || v.length === 0) throw new Error(`embed-answers.md: "${key}" is required`);
  return v;
}
function requireEnum(
  map: Map<string, string>,
  key: string,
  allowed: readonly string[],
): string {
  const v = requireNonEmpty(map, key);
  if (!allowed.includes(v)) {
    throw new Error(`embed-answers.md: "${key}" must be one of ${allowed.join(", ")}`);
  }
  return v;
}
function assertHttpUrl(value: string, key: string): void {
  try {
    const u = new URL(value);
    if (!["http:", "https:"].includes(u.protocol)) throw new Error("scheme");
  } catch {
    throw new Error(`embed-answers.md: "${key}" must be an absolute http(s) URL`);
  }
}

/* ----------------------------- template loader --------------------------- */

function thisDir(): string {
  const here = fileURLToPath(import.meta.url);
  return path.dirname(here);
}

function loadTemplate(framework: Framework): string {
  const here = thisDir();
  // Templates live under src/ (.ts source tree) and are copied to dist/
  // only when explicitly included; resolve either way.
  const candidates = [
    path.resolve(here, "embed-templates", `${framework}.hbs`),
    path.resolve(here, "..", "src", "embed-templates", `${framework}.hbs`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p, "utf8");
  }
  throw new Error(`embed template not found for framework "${framework}"`);
}

/* ------------------------------ render entry ----------------------------- */

export async function renderEmbedGuide(opts: EmbedOptions): Promise<EmbedResult> {
  const pre = checkPreconditions(opts.projectRoot);
  if (!pre.ok) {
    const err = new Error(
      `atw-embed: missing ${pre.missing.join(", ")}. Run /atw.build first.`,
    );
    (err as { code?: string }).code = "PRECONDITIONS_MISSING";
    throw err;
  }
  const now = opts.frozenTime ?? new Date().toISOString();
  const template = loadTemplate(opts.answers.framework);
  const compiled = Handlebars.compile(template, { noEscape: true, strict: true });
  const apiBaseUrl =
    opts.answers.apiBaseUrl ?? 'window.location.origin (default — can be overridden via `data-api-base-url`)';
  const rendered = compiled({
    framework: opts.answers.framework,
    backendUrl: opts.answers.backendUrl,
    apiBaseUrl,
    authMode: opts.answers.authMode,
    authTokenKey: opts.answers.authTokenKey ?? "",
    loginUrl: opts.answers.loginUrl ?? "",
    locale: opts.answers.locale ?? "en-US",
    themePrimary: opts.answers.themePrimary ?? "",
    themeRadius: opts.answers.themeRadius ?? "",
    themeFont: opts.answers.themeFont ?? "",
    generatedAt: now,
  });

  const outputPath =
    opts.outputPath ??
    path.join(opts.projectRoot, ".atw", "artifacts", "embed-guide.md");
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, rendered, "utf8");

  // Persist the answers file alongside so re-runs are idempotent.
  const answersPath = path.join(opts.projectRoot, ".atw", "state", "embed-answers.md");
  await fs.mkdir(path.dirname(answersPath), { recursive: true });
  await fs.writeFile(
    answersPath,
    formatAnswersMarkdown(opts.answers, now),
    "utf8",
  );

  const { createHash } = await import("node:crypto");
  const sha256 = createHash("sha256").update(rendered).digest("hex");
  log("wrote %s (%d bytes, sha256=%s)", outputPath, rendered.length, sha256);
  return { outputPath, bytesWritten: rendered.length, sha256 };
}

/* ---------------------------------- CLI ---------------------------------- */

interface CliOptions {
  answersFile?: string;
  output?: string;
  frozenTime?: string;
  projectRoot: string;
  help?: boolean;
  version?: boolean;
}

function parseCli(argv: string[], cwd: string): CliOptions {
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

export async function runEmbedCli(
  argv: string[],
  cwd: string = process.cwd(),
): Promise<number> {
  let opts: CliOptions;
  try {
    opts = parseCli(argv, cwd);
  } catch (err) {
    process.stderr.write(`atw-embed: ${(err as Error).message}\n`);
    return 4;
  }
  if (opts.help) {
    process.stdout.write(
      "atw-embed [--answers-file <path>] [--output <path>] [--frozen-time <iso>] [--project-root <path>]\n",
    );
    return 0;
  }
  if (opts.version) {
    process.stdout.write("atw-embed 0.3.0\n");
    return 0;
  }

  const pre = checkPreconditions(opts.projectRoot);
  if (!pre.ok) {
    process.stderr.write(
      `atw-embed: missing ${pre.missing.join(", ")}. Run /atw.build first.\n`,
    );
    return 3;
  }

  if (!opts.answersFile) {
    process.stderr.write(
      "atw-embed: --answers-file is required in non-interactive mode. Interactive prompting will be added by the Claude Code slash command.\n",
    );
    return 4;
  }

  let answers: EmbedAnswers;
  try {
    const raw = await fs.readFile(opts.answersFile, "utf8");
    answers = parseAnswersMarkdown(raw);
  } catch (err) {
    process.stderr.write(`atw-embed: ${(err as Error).message}\n`);
    return 4;
  }

  try {
    const res = await renderEmbedGuide({
      projectRoot: opts.projectRoot,
      answers,
      outputPath: opts.output,
      frozenTime: opts.frozenTime,
    });
    process.stdout.write(
      `wrote ${path.relative(opts.projectRoot, res.outputPath)} (${res.bytesWritten} bytes)\n`,
    );
    return 0;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "PRECONDITIONS_MISSING") {
      process.stderr.write(`${(err as Error).message}\n`);
      return 3;
    }
    process.stderr.write(`atw-embed: ${(err as Error).message}\n`);
    return 17;
  }
}

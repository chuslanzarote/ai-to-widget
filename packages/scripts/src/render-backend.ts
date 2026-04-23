import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Handlebars from "handlebars";
import Debug from "debug";

import { SHARED_LIB_ALLOWLIST } from "./_shared-lib-allowlist.js";

const log = Debug("atw:render-backend");

/**
 * Feature 005 — @atw/scripts/dist/lib/<name>.js → relative _shared/ path.
 * Exported so callers (vendor-shared-lib, tests) can reuse the regex.
 */
export const VENDOR_IMPORT_REGEX =
  /from\s+["']@atw\/scripts\/dist\/lib\/([a-zA-Z0-9_-]+)\.js["']/g;

function rewriteVendorImports(source: string, relativeFilePath: string): string {
  // depth = number of directory separators in the file path under backend/src/
  const depth = relativeFilePath.split("/").length - 1;
  const prefix = depth === 0 ? "./_shared/" : "../".repeat(depth) + "_shared/";
  return source.replace(VENDOR_IMPORT_REGEX, (_full, name: string) => {
    const base = String(name).replace(/^runtime-/, "").replace(/\.js$/, "");
    const allow = SHARED_LIB_ALLOWLIST.map((n) => n.replace(/\.ts$/, ""));
    if (!allow.includes(`runtime-${base}`) && !allow.includes(base)) {
      const e = new Error(
        `Template imports @atw/scripts/dist/lib/${name}.js but it is not in the shared-lib allowlist`,
      );
      (e as { code?: string }).code = "VENDOR_IMPORT_UNRESOLVED";
      throw e;
    }
    return `from "${prefix}${name}.js"`;
  });
}

async function collectTemplates(
  root: string,
  prefix = "",
): Promise<string[]> {
  const entries = await fs.readdir(path.join(root, prefix), {
    withFileTypes: true,
  });
  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const out: string[] = [];
  const files: string[] = [];
  const dirs: string[] = [];
  for (const e of entries) {
    if (e.isSymbolicLink()) continue;
    if (e.isDirectory()) {
      dirs.push(e.name);
    } else if (e.isFile() && e.name.endsWith(".hbs")) {
      files.push(e.name);
    }
  }
  // Top-level files first, then subdirs (matches contracts §Ordering).
  for (const f of files) {
    out.push(prefix === "" ? f : `${prefix}/${f}`);
  }
  for (const d of dirs) {
    const sub = prefix === "" ? d : `${prefix}/${d}`;
    out.push(...(await collectTemplates(root, sub)));
  }
  return out;
}

export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
  defaultLocale: string;
  briefSummary: string;
}

export type RenderAction = "unchanged" | "created" | "rewritten";

export interface RenderedFile {
  path: string;
  sha256: string;
  bytes: number;
  action: RenderAction;
  backup?: string;
}

export interface RenderOptions {
  templatesDir: string;
  outputDir: string;
  context: RenderContext;
  backup?: boolean;
}

export function defaultTemplatesDir(): string {
  // packages/backend/src when running from packages/scripts/dist or src
  const here = fileURLToPath(import.meta.url);
  // `here` is packages/scripts/dist/render-backend.js OR packages/scripts/src/render-backend.ts
  const pkgScripts = path.resolve(path.dirname(here), "..");
  // up one more to packages/, then into backend/src
  return path.resolve(pkgScripts, "..", "backend", "src");
}

export async function renderBackend(opts: RenderOptions): Promise<RenderedFile[]> {
  // Feature 005 — recursive walk over `templatesDir`. Returns relative paths
  // using `/` separators, with top-level files first, then subdirs sorted.
  const templates = await collectTemplates(opts.templatesDir);
  const results: RenderedFile[] = [];
  await fs.mkdir(opts.outputDir, { recursive: true });

  for (const relTpl of templates) {
    const src = await fs.readFile(path.join(opts.templatesDir, relTpl), "utf8");
    // relTpl is like "index.ts.hbs" or "lib/cors.ts.hbs" or "routes/chat.ts.hbs"
    const relOutFromSrc = relTpl.replace(/\.hbs$/, "");

    // Rewrite @atw/scripts/dist/lib/*.js imports BEFORE Handlebars compile
    // (contracts/render-backend-recursive.md §Behaviour change 2).
    const rewritten = rewriteVendorImports(src, relOutFromSrc);

    const tpl = Handlebars.compile(rewritten, { noEscape: true, strict: true });
    let rendered: string;
    try {
      rendered = tpl(opts.context);
    } catch (err) {
      const e = new Error(`Template ${relTpl} compile error: ${(err as Error).message}`);
      (e as { code?: string }).code = "TEMPLATE_COMPILE";
      throw e;
    }
    // Ensure stable line endings (LF) for determinism across platforms.
    rendered = rendered.replace(/\r\n/g, "\n");

    const targetAbs = path.join(opts.outputDir, relOutFromSrc);
    await fs.mkdir(path.dirname(targetAbs), { recursive: true });
    const rel = path.relative(path.dirname(opts.outputDir), targetAbs).replace(/\\/g, "/");

    let action: RenderAction = "created";
    let backup: string | undefined;
    let prior: string | null = null;
    try {
      prior = await fs.readFile(targetAbs, "utf8");
    } catch {
      prior = null;
    }
    if (prior !== null) {
      if (prior === rendered) {
        action = "unchanged";
      } else {
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
    log("%s -> %s (%s, %d bytes)", relTpl, targetAbs, action, buf.byteLength);
  }

  return results;
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  templatesDir: string;
  outputDir: string;
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  defaultLocale: string;
  briefSummary: string;
  backup: boolean;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      "templates-dir": { type: "string" },
      "output-dir": { type: "string" },
      "project-name": { type: "string" },
      "embedding-model": { type: "string" },
      "anthropic-model": { type: "string" },
      "default-locale": { type: "string" },
      "brief-summary": { type: "string" },
      backup: { type: "boolean", default: false },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  return {
    templatesDir: String(values["templates-dir"] ?? defaultTemplatesDir()),
    outputDir: String(values["output-dir"] ?? path.resolve(process.cwd(), "backend", "src")),
    projectName: String(values["project-name"] ?? "unknown"),
    embeddingModel: String(values["embedding-model"] ?? "Xenova/bge-small-multilingual-v1.5"),
    anthropicModel: String(values["anthropic-model"] ?? "claude-opus-4-7"),
    defaultLocale: String(values["default-locale"] ?? "en"),
    briefSummary: String(values["brief-summary"] ?? ""),
    backup: Boolean(values.backup),
    json: Boolean(values.json),
  };
}

export async function runRenderBackend(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-render-backend: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-render-backend [--templates-dir <p>] [--output-dir <p>] [--project-name <s>] [--backup] [--json]\n",
    );
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
        defaultLocale: opts.defaultLocale,
        briefSummary: opts.briefSummary,
      },
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify({ rendered: results }) + "\n");
    } else {
      for (const r of results) {
        process.stdout.write(`${r.action} ${r.path}\n`);
      }
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "TEMPLATE_COMPILE" || code === "VENDOR_IMPORT_UNRESOLVED") {
      process.stderr.write(`atw-render-backend: ${(err as Error).message}\n`);
      return 17;
    }
    process.stderr.write(`atw-render-backend: ${(err as Error).message}\n`);
    return 1;
  }
}

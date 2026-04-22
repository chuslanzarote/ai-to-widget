import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import Handlebars from "handlebars";
import Debug from "debug";

const log = Debug("atw:render-backend");

export interface RenderContext {
  projectName: string;
  embeddingModel: string;
  anthropicModel: string;
  generatedAt: string;
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
  const entries = await fs.readdir(opts.templatesDir);
  const templates = entries.filter((f) => f.endsWith(".hbs")).sort();
  const results: RenderedFile[] = [];
  await fs.mkdir(opts.outputDir, { recursive: true });

  for (const name of templates) {
    const src = await fs.readFile(path.join(opts.templatesDir, name), "utf8");
    const tpl = Handlebars.compile(src, { noEscape: true, strict: true });
    let rendered: string;
    try {
      rendered = tpl(opts.context);
    } catch (err) {
      const e = new Error(`Template ${name} compile error: ${(err as Error).message}`);
      (e as { code?: string }).code = "TEMPLATE_COMPILE";
      throw e;
    }
    // Ensure stable line endings (LF) for determinism across platforms.
    rendered = rendered.replace(/\r\n/g, "\n");

    const targetName = name.replace(/\.hbs$/, "");
    const targetAbs = path.join(opts.outputDir, targetName);
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
    log("%s -> %s (%s, %d bytes)", name, targetAbs, action, buf.byteLength);
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
    if (code === "TEMPLATE_COMPILE") {
      process.stderr.write(`atw-render-backend: ${(err as Error).message}\n`);
      return 17;
    }
    process.stderr.write(`atw-render-backend: ${(err as Error).message}\n`);
    return 1;
  }
}

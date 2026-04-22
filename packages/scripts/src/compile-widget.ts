import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import Debug from "debug";

const log = Debug("atw:compile-widget");

export interface BundleAsset {
  path: string;
  bytes: number;
  sha256: string;
}

export interface CompileResult {
  js: BundleAsset;
  css: BundleAsset;
  noop: boolean;
}

export interface CompileOptions {
  widgetSrcDir: string;
  outDir: string;
  minify?: boolean;
}

export async function compileWidget(opts: CompileOptions): Promise<CompileResult> {
  await fs.mkdir(opts.outDir, { recursive: true });

  const entry = await findEntry(opts.widgetSrcDir);
  const jsPath = path.join(opts.outDir, "widget.js");
  const cssPath = path.join(opts.outDir, "widget.css");

  if (!entry) {
    log("no widget entry — emitting no-op bundle");
    const jsStub = "/* atw widget: no-op bundle (Feature 003 populates later) */\n";
    const cssStub = "/* atw widget: no-op styles */\n";
    await writeIfChanged(jsPath, jsStub);
    await writeIfChanged(cssPath, cssStub);
    return {
      js: await describe(jsPath),
      css: await describe(cssPath),
      noop: true,
    };
  }

  const esbuild = await import("esbuild");
  // T094 / US8 — determinism: static banner, no sourcemap, no metafile, and
  // an empty `define` block so no build-time timestamps or random values
  // creep into the bundle. Two consecutive builds on unchanged sources
  // must produce byte-identical widget.js (SC-016).
  try {
    await esbuild.build({
      entryPoints: [entry],
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
  } catch (err) {
    const e = new Error(`esbuild failed: ${(err as Error).message}`);
    (e as { code?: string }).code = "ESBUILD";
    throw e;
  }
  // If no css sibling was emitted, create an empty css stub so downstream
  // manifest layout is uniform.
  try {
    await fs.access(cssPath);
  } catch {
    await fs.writeFile(cssPath, "/* atw widget: no css */\n", "utf8");
  }

  return {
    js: await describe(jsPath),
    css: await describe(cssPath),
    noop: false,
  };
}

async function findEntry(srcDir: string): Promise<string | null> {
  try {
    const entries = await fs.readdir(srcDir);
    for (const candidate of ["index.ts", "index.tsx", "index.js", "index.jsx"]) {
      if (entries.includes(candidate)) return path.join(srcDir, candidate);
    }
  } catch {
    return null;
  }
  return null;
}

async function writeIfChanged(p: string, text: string): Promise<void> {
  let prior: string | null = null;
  try {
    prior = await fs.readFile(p, "utf8");
  } catch {
    prior = null;
  }
  if (prior === text) return;
  await fs.writeFile(p, text, "utf8");
}

async function describe(p: string): Promise<BundleAsset> {
  const buf = await fs.readFile(p);
  return {
    path: p,
    bytes: buf.byteLength,
    sha256: createHash("sha256").update(buf).digest("hex"),
  };
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  widgetSrcDir: string;
  outDir: string;
  minify: boolean;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      "widget-src-dir": { type: "string" },
      "out-dir": { type: "string" },
      minify: { type: "boolean" },
      "no-minify": { type: "boolean" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  const minify = values["no-minify"] ? false : Boolean(values.minify);
  return {
    widgetSrcDir: String(values["widget-src-dir"] ?? path.resolve(process.cwd(), "widget", "src")),
    outDir: String(values["out-dir"] ?? path.resolve(process.cwd(), "dist")),
    minify,
    json: Boolean(values.json),
  };
}

export async function runCompileWidget(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-compile-widget: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-compile-widget [--widget-src-dir <p>] [--out-dir <p>] [--minify|--no-minify] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-compile-widget 0.1.0\n");
    return 0;
  }

  try {
    const result = await compileWidget({
      widgetSrcDir: opts.widgetSrcDir,
      outDir: opts.outDir,
      minify: opts.minify,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(
        `${result.noop ? "noop" : "bundled"} js=${result.js.bytes}B css=${result.css.bytes}B\n`,
      );
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ESBUILD") {
      process.stderr.write(`atw-compile-widget: ${(err as Error).message}\n`);
      return 18;
    }
    process.stderr.write(`atw-compile-widget: ${(err as Error).message}\n`);
    return 1;
  }
}

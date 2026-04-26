import { promises as fs } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import Handlebars from "handlebars";

/**
 * T060 — build-time template validation (FR-036, R13).
 *
 * Every `.hbs` under `packages/backend/src/` and
 * `packages/scripts/src/embed-templates/` is compiled and rendered
 * against a canonical fixture context. Compilation failures (e.g. the
 * `{{/if}}}` parse-error class regression caught in 009) are reported
 * with the file name + line. When `runTsc: true`, rendered backend
 * outputs are additionally type-checked with `tsc --noEmit` against the
 * backend's tsconfig.
 *
 * The lib is re-used by the build-validation CLI and a vitest test so
 * the same fixture is exercised in CI and during `npm run build`.
 */

export interface ValidationIssue {
  file: string;
  phase: "compile" | "render" | "tsc";
  message: string;
}

export interface ValidateOptions {
  backendDir?: string;
  embedDir?: string;
  /** When true, also run `tsc --noEmit` against rendered backend output. */
  runTsc?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  rendered: number;
  issues: ValidationIssue[];
  /** Path to the temp dir containing rendered backend output (kept on tsc failures for inspection). */
  renderDir?: string;
}

const here = fileURLToPath(import.meta.url);

export function defaultBackendDir(): string {
  // here = packages/scripts/{dist|src}/lib/validate-templates.{js|ts}
  return path.resolve(here, "..", "..", "..", "..", "backend", "src");
}

export function defaultEmbedDir(): string {
  return path.resolve(here, "..", "..", "embed-templates");
}

/**
 * Canonical fixture context used to render every backend template. The
 * fields mirror what `render-backend.ts` emits at runtime; values are
 * representative but synthetic so renders are deterministic.
 */
export function canonicalBackendContext(): Record<string, unknown> {
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
export function canonicalEmbedContext(): Record<string, unknown> {
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

async function listHbs(dir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(d: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(d, e.name);
      if (e.isDirectory()) await walk(abs);
      else if (e.isFile() && e.name.endsWith(".hbs")) out.push(abs);
    }
  }
  await walk(dir);
  out.sort();
  return out;
}

function freshHandlebars(): typeof Handlebars {
  const h = Handlebars.create();
  h.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  h.registerHelper("json", (v: unknown) => JSON.stringify(v));
  return h;
}

export async function validateTemplates(
  opts: ValidateOptions = {},
): Promise<ValidationResult> {
  const backendDir = opts.backendDir ?? defaultBackendDir();
  const embedDir = opts.embedDir ?? defaultEmbedDir();
  const issues: ValidationIssue[] = [];
  let rendered = 0;
  let renderDir: string | undefined;

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
      let tpl: HandlebarsTemplateDelegate;
      try {
        tpl = hb.compile(src, { noEscape: true, strict: false });
      } catch (err) {
        issues.push({ file: rel, phase: "compile", message: (err as Error).message });
        continue;
      }
      let out: string;
      try {
        out = tpl(ctx);
      } catch (err) {
        issues.push({ file: rel, phase: "render", message: (err as Error).message });
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
      let tpl: HandlebarsTemplateDelegate;
      try {
        tpl = hb.compile(src, { noEscape: true, strict: false });
      } catch (err) {
        issues.push({ file: rel, phase: "compile", message: (err as Error).message });
        continue;
      }
      try {
        tpl(ctx);
        rendered += 1;
      } catch (err) {
        issues.push({ file: rel, phase: "render", message: (err as Error).message });
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

async function runTscNoEmit(
  renderDir: string,
  backendSourceDir: string,
): Promise<ValidationIssue[]> {
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
  } catch {
    // Fallback: leave it; tsc will fail with "Cannot find module" — surfaced as issues.
  }

  const tscBin =
    process.platform === "win32"
      ? path.join(backendPkg, "node_modules", ".bin", "tsc.cmd")
      : path.join(backendPkg, "node_modules", ".bin", "tsc");
  const res = spawnSync(tscBin, ["--noEmit", "-p", tsconfigPath], {
    encoding: "utf8",
    shell: false,
  });
  if (res.status === 0) return [];
  const stdout = (res.stdout ?? "") + (res.stderr ?? "");
  return [{ file: "<tsc>", phase: "tsc", message: stdout.trim() }];
}

// When invoked directly (e.g. `node ./dist/lib/validate-templates.js --tsc`)
// run the CLI and propagate the exit code. Wired as a postbuild step in
// `packages/scripts/package.json` so renders happen before `dist/` is
// considered shippable.
const invokedAsScript =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedAsScript) {
  runValidateTemplatesCli(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      process.stderr.write(`atw-validate-templates: ${(err as Error).message}\n`);
      process.exit(1);
    },
  );
}

export async function runValidateTemplatesCli(argv: string[]): Promise<number> {
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

/**
 * Dist-staleness gate (FR-032, R8). Each `bin/atw-X.js` shim invokes this
 * before importing compiled code. If any `src` TypeScript file's mtime is
 * newer than its `dist` JavaScript counterpart (or the `.js` artifact is
 * missing), the runner aborts with the message:
 *
 *   [atw] dist/ is stale: src/<file>.ts modified after dist/<file>.js.
 *   [atw] Run `npm run build` and try again.
 *
 * The `ATW_SKIP_DIST_CHECK=1` env var bypasses the gate (escape hatch for
 * ATW maintainers running with `tsx`).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export interface StalenessReport {
  stale: boolean;
  /** Source files newer than (or missing) their dist counterpart. */
  offendingFiles: string[];
}

export interface CheckOptions {
  packageRoot: string;
  srcDir?: string;
  distDir?: string;
}

const SKIP_FRAGMENTS = ["__tests__", ".test.ts", ".spec.ts"];

function walkTs(dir: string, root: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkTs(abs, root, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".ts")) continue;
    if (entry.name.endsWith(".d.ts")) continue;
    const rel = relative(root, abs);
    if (SKIP_FRAGMENTS.some((s) => rel.includes(s))) continue;
    out.push(abs);
  }
}

export function checkDistStaleness(opts: CheckOptions): StalenessReport {
  const srcAbs = join(opts.packageRoot, opts.srcDir ?? "src");
  const distAbs = join(opts.packageRoot, opts.distDir ?? "dist");

  const sources: string[] = [];
  walkTs(srcAbs, srcAbs, sources);

  const offending: string[] = [];
  for (const src of sources) {
    const rel = relative(srcAbs, src).split(sep).join("/");
    const distFile = join(distAbs, rel.replace(/\.ts$/, ".js"));
    if (!existsSync(distFile)) {
      offending.push(rel);
      continue;
    }
    const srcMtime = statSync(src).mtimeMs;
    const distMtime = statSync(distFile).mtimeMs;
    if (srcMtime > distMtime) offending.push(rel);
  }
  return { stale: offending.length > 0, offendingFiles: offending };
}

/**
 * Convenience wrapper used by the bin shims. Reads `ATW_SKIP_DIST_CHECK`
 * itself, prints the standard message, and exits non-zero on staleness.
 * No-ops when the gate is satisfied or skipped.
 */
export function enforceDistFreshness(opts: CheckOptions): void {
  if (process.env.ATW_SKIP_DIST_CHECK === "1") return;
  const report = checkDistStaleness(opts);
  if (!report.stale) return;
  const list = report.offendingFiles.slice(0, 5).join(", ");
  const more = report.offendingFiles.length > 5 ? ` (+${report.offendingFiles.length - 5} more)` : "";
  process.stderr.write(
    `[atw] dist/ is stale: ${list}${more} — source newer than (or missing) compiled output.\n` +
      `[atw] Run \`npm run build\` and try again.\n`,
  );
  process.exit(2);
}

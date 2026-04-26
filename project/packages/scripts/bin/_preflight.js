/**
 * Dist-staleness preflight for /atw.* shims (FR-032, R8). Pure-JS so it can
 * run BEFORE any dist/ import. Each shim should call `enforceFreshDist()`
 * as the very first statement after the shebang.
 *
 * Bypass with `ATW_SKIP_DIST_CHECK=1`.
 *
 * The mirror module `packages/scripts/src/lib/dist-staleness.ts` is the
 * authoritative implementation; this file duplicates the small check so
 * the shim can fail fast when dist is missing entirely.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const SKIP_FRAGMENTS = ["__tests__", ".test.ts", ".spec.ts"];

function walkTs(dir, root, out) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      walkTs(abs, root, out);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;
    const rel = relative(root, abs);
    if (SKIP_FRAGMENTS.some((s) => rel.includes(s))) continue;
    out.push(abs);
  }
}

export function enforceFreshDist() {
  if (process.env.ATW_SKIP_DIST_CHECK === "1") return;

  // bin/<shim>.js → packages/scripts/{src,dist}
  const here = dirname(fileURLToPath(import.meta.url));
  const packageRoot = dirname(here);
  const srcAbs = join(packageRoot, "src");
  const distAbs = join(packageRoot, "dist");

  const sources = [];
  walkTs(srcAbs, srcAbs, sources);

  const offending = [];
  for (const src of sources) {
    const rel = relative(srcAbs, src).split(sep).join("/");
    const distFile = join(distAbs, rel.replace(/\.ts$/, ".js"));
    if (!existsSync(distFile)) {
      offending.push(rel);
      continue;
    }
    if (statSync(src).mtimeMs > statSync(distFile).mtimeMs) offending.push(rel);
  }
  if (offending.length === 0) return;

  const list = offending.slice(0, 5).join(", ");
  const more = offending.length > 5 ? ` (+${offending.length - 5} more)` : "";
  process.stderr.write(
    `[atw] dist/ is stale: ${list}${more} — source newer than (or missing) compiled output.\n` +
      `[atw] Run \`npm run build\` and try again.\n`,
  );
  process.exit(2);
}

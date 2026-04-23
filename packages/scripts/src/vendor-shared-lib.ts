import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Debug from "debug";

import { SHARED_LIB_ALLOWLIST } from "./_shared-lib-allowlist.js";

const log = Debug("atw:vendor-shared-lib");

export type VendorAction = "unchanged" | "created" | "rewritten";

export interface VendoredFile {
  path: string;
  sha256: string;
  bytes: number;
  action: VendorAction;
  backup?: string;
}

export interface VendorSharedLibOptions {
  projectRoot: string;
  /** Override the source `packages/scripts/src/lib/` directory (tests). */
  sourceDir?: string;
  /** If provided, only vendor files whose `<name>.ts` is both in the
   * allowlist AND referenced by the rendered backend source tree. */
  referencedNames?: readonly string[];
  backup?: boolean;
}

export function defaultSourceDir(): string {
  // Runtime this module lives at one of:
  //   packages/scripts/dist/vendor-shared-lib.js
  //   packages/scripts/src/vendor-shared-lib.ts
  // Vendored .ts sources always live under packages/scripts/src/lib/.
  const here = fileURLToPath(import.meta.url);
  const dir = path.dirname(here);
  const pkgRoot = path.resolve(dir, ".."); // packages/scripts
  return path.join(pkgRoot, "src", "lib");
}

export async function vendorSharedLib(
  opts: VendorSharedLibOptions,
): Promise<VendoredFile[]> {
  const src = opts.sourceDir ?? defaultSourceDir();
  const destDir = path.join(opts.projectRoot, "backend", "src", "_shared");
  await fs.mkdir(destDir, { recursive: true });

  const needs = opts.referencedNames
    ? new Set(opts.referencedNames.map((n) => n.replace(/\.ts$/, "")))
    : null;

  // Validate that every referenced name is allowlisted.
  if (needs) {
    const allowStems = new Set(
      SHARED_LIB_ALLOWLIST.map((f) => f.replace(/\.ts$/, "")),
    );
    for (const n of needs) {
      if (!allowStems.has(n)) {
        const e = new Error(
          `vendor-shared-lib: "${n}" is referenced by the backend but is not in the shared-lib allowlist`,
        );
        (e as { code?: string }).code = "VENDOR_NOT_ALLOWED";
        throw e;
      }
    }
  }

  const results: VendoredFile[] = [];
  const toCopy = SHARED_LIB_ALLOWLIST.filter((f) => {
    if (!needs) return true;
    return needs.has(f.replace(/\.ts$/, ""));
  });
  // Sort for deterministic emission.
  const sorted = [...toCopy].sort();

  for (const name of sorted) {
    const srcAbs = path.join(src, name);
    let content: string;
    try {
      content = await fs.readFile(srcAbs, "utf8");
    } catch (err) {
      const e = new Error(
        `vendor-shared-lib: source file missing: ${srcAbs}`,
      );
      (e as { code?: string }).code = "VENDOR_SOURCE_MISSING";
      (e as { cause?: unknown }).cause = err;
      throw e;
    }
    // Normalise line endings.
    const normalised = content.replace(/\r\n/g, "\n");

    const targetAbs = path.join(destDir, name);
    let prior: string | null = null;
    try {
      prior = await fs.readFile(targetAbs, "utf8");
    } catch {
      prior = null;
    }
    let action: VendorAction = "created";
    let backup: string | undefined;
    if (prior !== null) {
      if (prior === normalised) {
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
      await fs.writeFile(targetAbs, normalised, "utf8");
    }
    const buf = Buffer.from(normalised, "utf8");
    const sha256 = createHash("sha256").update(buf).digest("hex");
    results.push({
      path: `backend/src/_shared/${name}`,
      sha256,
      bytes: buf.byteLength,
      action,
      backup: backup
        ? path.relative(opts.projectRoot, backup).replace(/\\/g, "/")
        : undefined,
    });
    log("%s -> %s (%s)", srcAbs, targetAbs, action);
  }
  return results;
}

/** Scan a rendered backend source tree for `../_shared/<name>.js` /
 * `./_shared/<name>.js` specifiers (post-render, post-rewrite). Not
 * currently used by the orchestrator — it just copies the whole allowlist
 * for determinism — but exposed for tests and for future trimming. */
export async function collectReferencedSharedNames(
  backendSrcDir: string,
): Promise<string[]> {
  const names = new Set<string>();
  const re = /["'](?:\.\/|(?:\.\.\/)+)_shared\/([a-zA-Z0-9_-]+)\.js["']/g;
  const walk = async (dir: string): Promise<void> => {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "_shared") continue;
        await walk(abs);
        continue;
      }
      if (!e.isFile() || !e.name.endsWith(".ts")) continue;
      const content = await fs.readFile(abs, "utf8");
      let m: RegExpExecArray | null;
      while ((m = re.exec(content)) !== null) {
        names.add(m[1]);
      }
    }
  };
  await walk(backendSrcDir).catch(() => void 0);
  return [...names].sort();
}

#!/usr/bin/env node
/**
 * Dev-install harness: runs the create-atw installer against a local
 * `dev-out/` directory so a Builder can iterate on Feature 001 without
 * publishing to npm. Intended for `npm run dev:install` from the repo root.
 */
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const target = path.resolve(repoRoot, "dev-out");
const installerBin = path.resolve(repoRoot, "packages", "installer", "bin", "create-atw.js");

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const force = argv.includes("--force");

  if (!(await exists(installerBin))) {
    console.error(
      `[dev-install] Installer binary not found at ${installerBin}. Run 'npm run build' first.`,
    );
    process.exit(1);
  }

  if (await exists(target)) {
    if (!force) {
      console.error(
        `[dev-install] ${target} already exists. Pass --force to re-scaffold (this deletes dev-out/ first).`,
      );
      process.exit(1);
    }
    console.log(`[dev-install] Removing existing ${target}`);
    await fs.rm(target, { recursive: true, force: true });
  }

  await fs.mkdir(target, { recursive: true });
  console.log(`[dev-install] Scaffolding into ${target}`);

  const result = spawnSync(process.execPath, [installerBin, target, ...(force ? ["--force"] : [])], {
    stdio: "inherit",
    cwd: repoRoot,
  });

  if (result.status !== 0) {
    console.error(`[dev-install] Installer exited with status ${result.status}`);
    process.exit(result.status ?? 1);
  }

  console.log(`[dev-install] Done. Inspect ${path.relative(repoRoot, target)}/ and open it in Claude Code.`);
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

void main();

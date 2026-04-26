import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fsExtra from "fs-extra";
import writeFileAtomic from "write-file-atomic";
import { ensureGitignoreBlock } from "./gitignore.js";
import { step } from "./messages.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// installer layout:
//   packages/installer/dist/scaffold.js   (runtime)
//   repo-root/templates/...
//   repo-root/commands/...
// so we climb three from dist/.
function assetsRoot(): string {
  return path.resolve(__dirname, "..", "..", "..");
}

export interface ScaffoldOptions {
  targetDir: string;
  force: boolean;
  dryRun: boolean;
}

export interface ScaffoldResult {
  createdPaths: string[];
  gitignore: "created" | "appended" | "unchanged";
  preservedBuilderPaths: string[];
}

const ATW_SUBDIRS = ["config", "artifacts", "inputs", "state", "templates"];

export async function scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult> {
  const { targetDir, force, dryRun } = opts;
  const created: string[] = [];
  const preserved: string[] = [];

  if (!dryRun) {
    await fs.mkdir(targetDir, { recursive: true });
  }

  // 1. .atw tree
  for (const sub of ATW_SUBDIRS) {
    const dir = path.join(targetDir, ".atw", sub);
    if (!dryRun) await fs.mkdir(dir, { recursive: true });
    created.push(path.relative(targetDir, dir));
    const gitkeep = path.join(dir, ".gitkeep");
    if (!dryRun && !(await pathExists(gitkeep))) {
      await writeFileAtomic(gitkeep, "");
    }
  }

  // 2. templates → copy docker-compose.yml, README-atw.md, package.json
  const tmplRoot = path.join(assetsRoot(), "templates");
  const copies: [string, string][] = [
    [path.join(tmplRoot, "docker-compose.yml.tmpl"), path.join(targetDir, "docker-compose.yml")],
    [path.join(tmplRoot, "README-atw.md.tmpl"), path.join(targetDir, "README-atw.md")],
  ];
  for (const [src, dst] of copies) {
    const exists = await pathExists(dst);
    if (exists && !force) {
      preserved.push(path.relative(targetDir, dst));
      continue;
    }
    if (!dryRun) await fsExtra.copy(src, dst, { overwrite: true });
    step("wrote", path.relative(targetDir, dst));
    created.push(path.relative(targetDir, dst));
  }

  // 3. package.json — only if absent (never overwrite Builder's own)
  const pkgDst = path.join(targetDir, "package.json");
  if (!(await pathExists(pkgDst))) {
    if (!dryRun) {
      await fsExtra.copy(path.join(tmplRoot, "package.json.tmpl"), pkgDst);
    }
    step("wrote", "package.json");
    created.push("package.json");
  } else {
    preserved.push("package.json");
  }

  // 4. .claude/commands/atw.*.md
  const cmdSrc = path.join(assetsRoot(), "commands");
  const cmdDst = path.join(targetDir, ".claude", "commands");
  if (!dryRun) await fs.mkdir(cmdDst, { recursive: true });
  const cmdFiles = await fs.readdir(cmdSrc);
  for (const file of cmdFiles) {
    if (!file.startsWith("atw.") || !file.endsWith(".md")) continue;
    const src = path.join(cmdSrc, file);
    const dst = path.join(cmdDst, file);
    if ((await pathExists(dst)) && !force) {
      preserved.push(path.relative(targetDir, dst));
      continue;
    }
    if (!dryRun) await fsExtra.copy(src, dst, { overwrite: true });
    step("wrote", path.relative(targetDir, dst));
    created.push(path.relative(targetDir, dst));
  }

  // 5. .gitignore
  const blockPath = path.join(tmplRoot, "gitignore-atw-block.txt");
  const block = await fs.readFile(blockPath, "utf8");
  const outcome = dryRun ? "unchanged" : await ensureGitignoreBlock(targetDir, block);

  return { createdPaths: created, gitignore: outcome, preservedBuilderPaths: preserved };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

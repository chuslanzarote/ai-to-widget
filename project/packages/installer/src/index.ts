import path from "node:path";
import { Command } from "commander";
import { detectConflicts } from "./conflicts.js";
import { scaffold } from "./scaffold.js";
import { conflictList, error, info, nextCommand, success } from "./messages.js";

export interface CliRunOptions {
  argv: string[];
}

export async function runCli(opts: CliRunOptions): Promise<number> {
  const program = new Command();
  program
    .name("create-atw")
    .description("Scaffold an AI-to-Widget project.")
    .argument("[target]", "Target directory", ".")
    .option("--force", "Overwrite structural files; Builder edits to .atw/config and .atw/artifacts preserved", false)
    .option("--dry-run", "Plan but do not write", false)
    .exitOverride();

  let parsed: { args: string[]; opts: { force: boolean; dryRun: boolean } };
  try {
    program.parse(opts.argv, { from: "user" });
    parsed = {
      args: program.args,
      opts: program.opts<{ force: boolean; dryRun: boolean }>(),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(msg);
    return 3;
  }

  const targetArg = parsed.args[0] ?? ".";
  const targetDir = path.resolve(process.cwd(), targetArg);
  const { conflicts } = await detectConflicts(targetDir);

  if (conflicts.length > 0 && !parsed.opts.force) {
    process.stderr.write(conflictList(conflicts));
    return 2;
  }

  info(`Scaffolding into ${targetDir}${parsed.opts.dryRun ? " (dry run)" : ""}`);

  try {
    const result = await scaffold({
      targetDir,
      force: parsed.opts.force,
      dryRun: parsed.opts.dryRun,
    });
    if (result.preservedBuilderPaths.length > 0) {
      info(`Preserved ${result.preservedBuilderPaths.length} Builder-owned path(s).`);
    }
    info(`.gitignore: ${result.gitignore}`);
    success(`Wrote ${result.createdPaths.length} path(s).`);
    process.stdout.write(nextCommand("/atw.init"));
    return 0;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    error(`Scaffold failed: ${msg}`);
    return 1;
  }
}

import { parseArgs } from "node:util";
import path from "node:path";
import { writeArtifactAtomic } from "./lib/atomic.js";

interface CliOptions {
  target: string;
  backupSuffix: string;
  verbose: boolean;
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      target: { type: "string" },
      "backup-suffix": { type: "string", default: ".bak" },
      verbose: { type: "boolean", default: false },
    },
    strict: true,
  });
  if (!values.target) throw new Error("--target <path> is required");
  return {
    target: values.target as string,
    backupSuffix: (values["backup-suffix"] as string) ?? ".bak",
    verbose: Boolean(values.verbose),
  };
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function runWriteArtifact(
  argv: string[],
  opts: { stdinContent?: string } = {},
): Promise<number> {
  let cli: CliOptions;
  try {
    cli = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-write-artifact: ${(err as Error).message}\n`);
    return 3;
  }

  const content = opts.stdinContent ?? (await readStdin());
  const target = path.resolve(cli.target);

  try {
    await writeArtifactAtomic(target, content, { backupSuffix: cli.backupSuffix });
    if (cli.verbose) {
      process.stderr.write(`atw-write-artifact: wrote ${target}\n`);
    }
    return 0;
  } catch (err) {
    const msg = (err as NodeJS.ErrnoException).message;
    const code = (err as NodeJS.ErrnoException).code;
    process.stderr.write(`atw-write-artifact: write failed (${code ?? "?"}): ${msg}\n`);
    return code === "EACCES" || code === "EPERM" || code === "ENOENT" ? 2 : 1;
  }
}

#!/usr/bin/env node
import { runBuild, parseArgs } from "../dist/orchestrator.js";

const argv = process.argv.slice(2);
let flags;
try {
  flags = parseArgs(argv, process.cwd());
} catch (err) {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(3);
}

runBuild(flags).then(
  ({ exitCode }) => process.exit(exitCode),
  (err) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  },
);

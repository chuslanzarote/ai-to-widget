#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runEmbedCli } = await import("../dist/embed.js");

runEmbedCli(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    process.stderr.write(
      `${err instanceof Error ? err.message : String(err)}\n`,
    );
    process.exit(1);
  },
);

#!/usr/bin/env node
import { runCli } from "../dist/index.js";

runCli({ argv: process.argv.slice(2) })
  .then((code) => process.exit(code))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });

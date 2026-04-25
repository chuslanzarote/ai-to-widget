#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runImportDump } = await import("../dist/import-dump.js");

const exitCode = await runImportDump(process.argv.slice(2));
process.exit(exitCode);

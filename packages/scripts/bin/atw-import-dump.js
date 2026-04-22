#!/usr/bin/env node
import { runImportDump } from "../dist/import-dump.js";

const exitCode = await runImportDump(process.argv.slice(2));
process.exit(exitCode);

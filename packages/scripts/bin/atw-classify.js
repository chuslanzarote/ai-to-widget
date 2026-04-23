#!/usr/bin/env node
import { runAtwClassifyCli } from "../dist/atw-classify.js";

const exitCode = await runAtwClassifyCli(process.argv.slice(2));
process.exit(exitCode);

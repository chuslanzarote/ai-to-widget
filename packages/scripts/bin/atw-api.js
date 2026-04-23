#!/usr/bin/env node
import { runAtwApiCli } from "../dist/atw-api.js";

const exitCode = await runAtwApiCli(process.argv.slice(2));
process.exit(exitCode);

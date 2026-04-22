#!/usr/bin/env node
import { runParseOpenAPI } from "../dist/parse-openapi.js";

const exitCode = await runParseOpenAPI(process.argv.slice(2));
process.exit(exitCode);

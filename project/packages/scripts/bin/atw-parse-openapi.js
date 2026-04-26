#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runParseOpenAPI } = await import("../dist/parse-openapi.js");

const exitCode = await runParseOpenAPI(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runParseSchema } = await import("../dist/parse-schema.js");

const exitCode = await runParseSchema(process.argv.slice(2));
process.exit(exitCode);

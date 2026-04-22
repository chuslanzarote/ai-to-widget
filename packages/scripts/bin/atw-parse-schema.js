#!/usr/bin/env node
import { runParseSchema } from "../dist/parse-schema.js";

const exitCode = await runParseSchema(process.argv.slice(2));
process.exit(exitCode);

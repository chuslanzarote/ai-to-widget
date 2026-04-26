#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runHashInputs } = await import("../dist/hash-inputs.js");

const exitCode = await runHashInputs(process.argv.slice(2));
process.exit(exitCode);

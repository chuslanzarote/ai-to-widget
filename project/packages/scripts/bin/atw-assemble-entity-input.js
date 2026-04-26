#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runAssembleEntityInput } = await import("../dist/assemble-entity-input.js");

const exitCode = await runAssembleEntityInput(process.argv.slice(2));
process.exit(exitCode);

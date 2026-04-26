#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runComposeActivate } = await import("../dist/compose-activate.js");

const exitCode = await runComposeActivate(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runRenderBackend } = await import("../dist/render-backend.js");

const exitCode = await runRenderBackend(process.argv.slice(2));
process.exit(exitCode);

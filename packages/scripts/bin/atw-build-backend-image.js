#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runBuildBackendImage } = await import("../dist/build-backend-image.js");

const exitCode = await runBuildBackendImage(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runWriteManifest } = await import("../dist/write-manifest.js");

const exitCode = await runWriteManifest(process.argv.slice(2));
process.exit(exitCode);

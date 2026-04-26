#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runWriteArtifact } = await import("../dist/write-artifact.js");

const exitCode = await runWriteArtifact(process.argv.slice(2));
process.exit(exitCode);

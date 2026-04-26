#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runLoadArtifact } = await import("../dist/load-artifact.js");

const exitCode = await runLoadArtifact(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runValidateArtifacts } = await import("../dist/validate-artifacts.js");
const exitCode = await runValidateArtifacts(process.argv.slice(2));
process.exit(exitCode);

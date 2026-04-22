#!/usr/bin/env node
import { runLoadArtifact } from "../dist/load-artifact.js";

const exitCode = await runLoadArtifact(process.argv.slice(2));
process.exit(exitCode);

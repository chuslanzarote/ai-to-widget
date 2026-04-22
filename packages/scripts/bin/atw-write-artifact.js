#!/usr/bin/env node
import { runWriteArtifact } from "../dist/write-artifact.js";

const exitCode = await runWriteArtifact(process.argv.slice(2));
process.exit(exitCode);

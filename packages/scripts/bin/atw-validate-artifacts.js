#!/usr/bin/env node
import { runValidateArtifacts } from "../dist/validate-artifacts.js";
const exitCode = await runValidateArtifacts(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { runHashInputs } from "../dist/hash-inputs.js";

const exitCode = await runHashInputs(process.argv.slice(2));
process.exit(exitCode);

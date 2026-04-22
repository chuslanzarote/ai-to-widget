#!/usr/bin/env node
import { runAssembleEntityInput } from "../dist/assemble-entity-input.js";

const exitCode = await runAssembleEntityInput(process.argv.slice(2));
process.exit(exitCode);

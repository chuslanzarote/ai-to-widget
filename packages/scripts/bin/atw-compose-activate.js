#!/usr/bin/env node
import { runComposeActivate } from "../dist/compose-activate.js";

const exitCode = await runComposeActivate(process.argv.slice(2));
process.exit(exitCode);

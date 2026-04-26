#!/usr/bin/env node
// Feature 009 / R11 — `/atw.api` and `/atw.classify` both invoke
// classify-actions.ts. The two bin entries are kept as aliases.
import { runClassifyActions } from "../dist/classify-actions.js";

const exitCode = await runClassifyActions(process.argv.slice(2));
process.exit(exitCode);

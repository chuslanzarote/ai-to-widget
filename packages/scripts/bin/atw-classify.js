#!/usr/bin/env node
// Feature 009 / R11 — `/atw.classify` is an alias for `/atw.api`.
import { runClassifyActions } from "../dist/classify-actions.js";

const exitCode = await runClassifyActions(process.argv.slice(2));
process.exit(exitCode);

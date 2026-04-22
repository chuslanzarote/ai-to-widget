#!/usr/bin/env node
import { runUpsertDocument } from "../dist/upsert-document.js";

const exitCode = await runUpsertDocument(process.argv.slice(2));
process.exit(exitCode);

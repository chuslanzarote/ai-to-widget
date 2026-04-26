#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runUpsertDocument } = await import("../dist/upsert-document.js");

const exitCode = await runUpsertDocument(process.argv.slice(2));
process.exit(exitCode);

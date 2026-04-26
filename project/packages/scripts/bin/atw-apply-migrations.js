#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runApplyMigrations } = await import("../dist/apply-migrations.js");

const exitCode = await runApplyMigrations(process.argv.slice(2));
process.exit(exitCode);

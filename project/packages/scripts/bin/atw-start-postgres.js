#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runStartPostgres } = await import("../dist/start-postgres.js");

const exitCode = await runStartPostgres(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { runStartPostgres } from "../dist/start-postgres.js";

const exitCode = await runStartPostgres(process.argv.slice(2));
process.exit(exitCode);

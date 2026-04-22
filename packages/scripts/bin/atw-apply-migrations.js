#!/usr/bin/env node
import { runApplyMigrations } from "../dist/apply-migrations.js";

const exitCode = await runApplyMigrations(process.argv.slice(2));
process.exit(exitCode);

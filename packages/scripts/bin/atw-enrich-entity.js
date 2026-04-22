#!/usr/bin/env node
import { runEnrichEntity } from "../dist/enrich-entity.js";

const exitCode = await runEnrichEntity(process.argv.slice(2));
process.exit(exitCode);

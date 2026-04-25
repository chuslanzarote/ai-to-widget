#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runEnrichEntity } = await import("../dist/enrich-entity.js");

const exitCode = await runEnrichEntity(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runScanPiiLeaks } = await import("../dist/scan-pii-leaks.js");

const exitCode = await runScanPiiLeaks(process.argv.slice(2));
process.exit(exitCode);

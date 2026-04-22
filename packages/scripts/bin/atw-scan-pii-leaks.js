#!/usr/bin/env node
import { runScanPiiLeaks } from "../dist/scan-pii-leaks.js";

const exitCode = await runScanPiiLeaks(process.argv.slice(2));
process.exit(exitCode);

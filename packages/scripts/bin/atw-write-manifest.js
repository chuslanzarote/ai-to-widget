#!/usr/bin/env node
import { runWriteManifest } from "../dist/write-manifest.js";

const exitCode = await runWriteManifest(process.argv.slice(2));
process.exit(exitCode);

#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runEmbedText } = await import("../dist/embed-text.js");

const exitCode = await runEmbedText(process.argv.slice(2));
process.exit(exitCode);

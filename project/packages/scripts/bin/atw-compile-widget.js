#!/usr/bin/env node
import { enforceFreshDist } from "./_preflight.js";
enforceFreshDist();
const { runCompileWidget } = await import("../dist/compile-widget.js");

const exitCode = await runCompileWidget(process.argv.slice(2));
process.exit(exitCode);

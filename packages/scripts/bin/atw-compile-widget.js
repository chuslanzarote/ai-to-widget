#!/usr/bin/env node
import { runCompileWidget } from "../dist/compile-widget.js";

const exitCode = await runCompileWidget(process.argv.slice(2));
process.exit(exitCode);

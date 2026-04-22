#!/usr/bin/env node
import { runEmbedText } from "../dist/embed-text.js";

const exitCode = await runEmbedText(process.argv.slice(2));
process.exit(exitCode);

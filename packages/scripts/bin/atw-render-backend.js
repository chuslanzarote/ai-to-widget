#!/usr/bin/env node
import { runRenderBackend } from "../dist/render-backend.js";

const exitCode = await runRenderBackend(process.argv.slice(2));
process.exit(exitCode);

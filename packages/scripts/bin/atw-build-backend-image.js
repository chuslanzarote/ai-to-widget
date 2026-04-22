#!/usr/bin/env node
import { runBuildBackendImage } from "../dist/build-backend-image.js";

const exitCode = await runBuildBackendImage(process.argv.slice(2));
process.exit(exitCode);

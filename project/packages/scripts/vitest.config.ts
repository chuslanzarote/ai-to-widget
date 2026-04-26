import { defineConfig } from "vitest/config";

// Vitest 1.x does not support `projects`. We emulate the unit/contract/
// integration split with explicit include patterns and a flag-selectable
// default: by default we run unit + contract; pass
// `--config vitest.integration.config.ts` (or just use the include override)
// to opt into the slow integration suite.
export default defineConfig({
  test: {
    include: [
      "test/**/*.unit.test.ts",
      "test/**/*.contract.test.ts",
      "src/**/*.unit.test.ts",
    ],
    exclude: ["test/**/*.integration.test.ts", "node_modules/**", "dist/**"],
    testTimeout: 30_000,
    environment: "node",
    pool: "forks",
    reporters: ["default"],
  },
});

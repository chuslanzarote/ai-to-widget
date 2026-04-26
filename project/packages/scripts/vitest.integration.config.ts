import { defineConfig } from "vitest/config";

// Opt-in integration suite: slow tests that bind real filesystem/network
// resources. Default `vitest.config.ts` skips these; run explicitly with
// `npx vitest --config vitest.integration.config.ts`.
export default defineConfig({
  test: {
    include: ["test/**/*.integration.test.ts"],
    testTimeout: 120_000,
    environment: "node",
    pool: "forks",
    reporters: ["default"],
  },
});

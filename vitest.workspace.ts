import { defineWorkspace } from "vitest/config";

/**
 * Vitest workspace — lets `npx vitest run` at the repo root honour each
 * package's local `vitest.config.ts` (jsdom for the widget, node for
 * scripts + integration).
 */
export default defineWorkspace([
  "./packages/*/vitest.config.ts",
  {
    test: {
      name: "root",
      include: [
        "packages/installer/test/**/*.test.ts",
        "tests/**/*.test.ts",
      ],
      environment: "node",
      testTimeout: 30_000,
      hookTimeout: 30_000,
      pool: "forks",
    },
  },
]);

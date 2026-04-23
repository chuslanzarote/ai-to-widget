import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "test/**/*.unit.test.ts",
      "test/**/*.unit.test.tsx",
      "test/**/*.contract.test.ts",
    ],
    environment: "jsdom",
    globals: false,
    setupFiles: [],
  },
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "preact",
  },
});

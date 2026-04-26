import { defineConfig } from "vitest/config";

/**
 * Integration test config for Feature 002 build pipeline.
 *
 * These tests boot real Docker + Postgres (via @testcontainers/postgresql)
 * and mock Opus to fixture responses. They require a running Docker daemon.
 *
 * Run with: npx vitest run --config tests/integration/vitest.config.ts
 */
export default defineConfig({
  test: {
    name: "build-pipeline-integration",
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    pool: "forks",
    testTimeout: 20 * 60 * 1000,
    hookTimeout: 5 * 60 * 1000,
    reporters: ["default"],
    isolate: true,
  },
});

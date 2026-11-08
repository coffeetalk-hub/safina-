import { defineConfig } from "vitest/config";

/** End-to-end checks against a running, demo-seeded server. See tests/e2e. */
export default defineConfig({
  test: { include: ["tests/e2e/**/*.test.ts"], environment: "node", testTimeout: 120_000, fileParallelism: false },
});

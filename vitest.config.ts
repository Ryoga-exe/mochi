import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    testTimeout: 15000,
    hookTimeout: 30000,
  },
});

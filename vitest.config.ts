import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // The process bootstrap is exercised by the stdio smoke tests; unit
      // coverage targets the importable application modules.
      exclude: ["src/index.ts"],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100,
        perFile: true,
      },
    },
  },
});

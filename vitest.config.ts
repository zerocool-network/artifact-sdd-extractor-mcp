import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: 'v8',
      reporter: ["text", "json", "html"],
      exclude: [
        "src/index.ts",
        "src/transport/**",
        "dist/**",
        "test/**",
        "scripts/**",
        "vitest.config.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});

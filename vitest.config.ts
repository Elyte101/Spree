import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next", "e2e"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // See lib/__stubs__/server-only.ts for why this alias exists.
      "server-only": path.resolve(__dirname, "lib/__stubs__/server-only.ts"),
    },
  },
});

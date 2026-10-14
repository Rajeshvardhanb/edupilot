import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" throws outside a React Server Components bundle; in unit tests it is a no-op.
      "server-only": fileURLToPath(new URL("./tests/unit/server-only.stub.ts", import.meta.url)),
    },
  },
});

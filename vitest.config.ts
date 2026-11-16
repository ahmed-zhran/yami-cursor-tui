import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // OpenTUI frame tests need Bun FFI; run via `pnpm test:ui`.
    exclude: ["src/chat/ChatShell.test.tsx"],
  },
});

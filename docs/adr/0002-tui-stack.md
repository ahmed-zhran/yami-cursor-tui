# TUI uses TypeScript, OpenTUI, Bun, pnpm, and Vitest

The TUI is a single TypeScript package so `@cursor/sdk` stays in-process. OpenTUI (`@opentui/react` + `@opentui/core`) provides OpenCode-like terminal chrome (borders, backgrounds, scroll, input). Bun (≥1.3.14) is the runtime for `yami` / `pnpm start` because OpenTUI’s native core needs Bun or Node ≥26.4. pnpm remains the package manager. Vitest covers pure agent/chrome helpers with the SDK mocked; ChatShell frame tests run under `bun test` (`pnpm test:ui`).

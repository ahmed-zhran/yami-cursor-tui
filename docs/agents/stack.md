# Stack

Read this before adding a dependency. A slot already filled here is decided: use it, or propose a reversal with `/stack-decision`. Never add a second library for a filled slot.

## tui

- **Language / package manager**: TypeScript + pnpm ([ADR-0002](../adr/0002-tui-stack.md))
- **Runtime**: Bun ≥1.3.14 for the TUI binary ([ADR-0002](../adr/0002-tui-stack.md))
- **Framework**: OpenTUI (`@opentui/react` + `@opentui/core`) ([ADR-0002](../adr/0002-tui-stack.md))
- **Agent runtime**: `@cursor/sdk` — `Agent.create` + `send` + stream, local cwd ([ADR-0003](../adr/0003-cursor-sdk-session.md))
- **Testing**: Vitest (logic) + `bun test` for ChatShell frames ([ADR-0002](../adr/0002-tui-stack.md))
- **Binary**: `yami`

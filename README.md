# yami-cursor-tui

Terminal chat UI for driving a Cursor agent session from the project directory.

## Status: on hold

**This project is paused.** It cannot fully replace the interactive Cursor CLI (`agent`) while it is built on `@cursor/sdk` local/headless runs. That path is headless by design: interactive AskQuestion, tool-approval cards, and several CLI-native flows are not available to a host TUI.

Gap research (sources + table): **[docs/research/cursor-sdk-vs-cli-gaps.md](docs/research/cursor-sdk-vs-cli-gaps.md)**

### Strong limitations (why hold)

- **AskQuestion** — local SDK auto-rejects / filters interactive questions; no host callback to answer them
- **Tool approvals** — no Run once / Run Everything HITL; tools auto-run, or sandbox/`autoReview` silently deny
- **Plan confirmation** — `createPlan` interaction is auto-accepted in local SDK; host cannot block/approve
- **Ask mode** — SDK only exposes `agent` \| `plan`; “ask” in the TUI is a soft prompt prefix, not platform read-only mode
- **No in-process approval API** — hooks are file-based only; dialog “answers” are just new chat turns, not completed interaction queries

A realistic path to CLI-parity is likely **`agent acp`** (custom client), not waiting on SDK alone — see the research note. Until that (or SDK interaction callbacks) lands as a deliberate restart, treat this repo as shelved.

## Setup (when resumed)

```bash
pnpm install
pnpm start          # or: pnpm build && yami (when installed as a package)
pnpm test
pnpm test:ui
pnpm lint:deps
```

Requires `CURSOR_API_KEY`. Default model is `auto` (`CURSOR_MODEL` to override).

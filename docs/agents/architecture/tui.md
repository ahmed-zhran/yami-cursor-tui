# TUI architecture

**Style:** vertical slices ([ADR-0004](../../adr/0004-tui-vertical-slices.md))

## Tree

```
src/
  app/          # OpenTUI bootstrap, process argv, env fail-fast for CURSOR_API_KEY
  chat/         # themed bubbles, full-width input, status chrome, steer/cancel, LTR paint
  agent/        # Cursor SDK wrapper (create session, send, stream, cancel, usage/edits)
  shared/       # thin shared types only (Message, RunStatus); no feature logic
```

## Dependency rule

- `app` may import `chat`, `agent`, `shared`
- `chat` may import `agent` (via its public API) and `shared`
- `agent` may import `shared` only (no OpenTUI)
- `shared` imports nothing from `app` / `chat` / `agent`
- Outside `src/` only the package entry imports `app`

## Where things go

| Concern | Location | Rule |
|---------|----------|------|
| UI state (transcript, prompt draft, run status, chrome) | `chat/` | Keep OpenTUI React components here |
| SDK I/O | `agent/` | No OpenTUI imports |
| Env / process bootstrap | `app/` | Fail fast on missing `CURSOR_API_KEY`; Bun runtime |
| Tests | colocated `*.test.ts(x)` | Vitest for logic; `bun test` for ChatShell frames |

## Adding a feature

1. Extend or add a module under the owning slice (`chat` or `agent`).
2. Wire it from `app` only if bootstrap changes.
3. Cover the external behaviour at the slice seam (Vitest or `bun test`).

## Limits

- Split a file before ~400 lines; never cross 1000.
- `shared/` holds types/constants only — if it needs logic, it belongs in a slice.
- Default layout is forced LTR: ECMA-48 SCP LTR **after** OpenTUI mounts. Ink theme (carbon + volt-mint) brands the header and status; bubble and prompt text use visual order (`toVisualLtr`); soft `you` / `yami` labels mark roles. Multi-line prompt: Enter sends, Shift+Enter newline, blinking cursor; status chrome sits under the prompt. Typing `/` opens a slash menu (built-ins + discovered skills); ↑/↓ select, Tab/Enter complete. On send, the feed shows **Working…** immediately; a sticky spinner strip above the prompt tracks Working → Thinking → Running `<tool>` (with arg detail) → Writing. Stream feed keeps thinking and in-flight tools visible together. Chat text is mouse-selectable; finishing a selection copies to the clipboard and shows a top-right “Copied to clipboard” toast. Ctrl+C quits; Esc cancels a run (or dismisses the slash menu).
- Status chrome: meta row (branch · model · context % · files · colored mode · activity), then cwd alone on the last row (no `cwd` prefix). Mode accents: build blue, plan yellow, ask green, debug red. Shift+Tab cycles mode (`plan` → SDK plan; `ask`/`debug` use soft prompt prefixes on agent). Agent `request` / AskQuestion open as selectable popups (↑/↓ · Enter · Esc) — answers never go through the main prompt. Cursor SDK headless runs auto-approve tools — CLI-style “Run one / Run Everything” is not available through the SDK yet.

## Enforced by

`dependency-cruiser` (added with the scaffold) forbidding `agent` → `chat`/`app` and `shared` → slice imports. Run via `pnpm lint:deps`.

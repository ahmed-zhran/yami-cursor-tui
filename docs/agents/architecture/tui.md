# TUI architecture

**Style:** vertical slices ([ADR-0004](../../adr/0004-tui-vertical-slices.md))

## Tree

```
src/
  app/          # Ink bootstrap, process argv, env fail-fast for CURSOR_API_KEY
  chat/         # transcript bubbles, prompt, steer/cancel keybindings, activity line
  agent/        # Cursor SDK wrapper (create session, send, stream, cancel)
  shared/       # thin shared types only (Message, RunStatus); no feature logic
```

## Dependency rule

- `app` may import `chat`, `agent`, `shared`
- `chat` may import `agent` (via its public API) and `shared`
- `agent` may import `shared` only (no Ink)
- `shared` imports nothing from `app` / `chat` / `agent`
- Outside `src/` only the package entry imports `app`

## Where things go

| Concern | Location | Rule |
|---------|----------|------|
| UI state (transcript, prompt draft, run status) | `chat/` | Keep Ink components here |
| SDK I/O | `agent/` | No Ink imports |
| Env / process bootstrap | `app/` | Fail fast on missing `CURSOR_API_KEY` |
| Tests | colocated `*.test.ts` next to the module | Mock `@cursor/sdk` |

## Adding a feature

1. Extend or add a module under the owning slice (`chat` or `agent`).
2. Wire it from `app` only if bootstrap changes.
3. Add a Vitest covering the external behaviour at the slice seam.

## Limits

- Split a file before ~400 lines; never cross 1000.
- `shared/` holds types/constants only — if it needs logic, it belongs in a slice.
- RTL layout is deferred; keep layout LTR and avoid hard-coded assumptions that make RTL impossible later.

## Enforced by

`dependency-cruiser` (added with the scaffold) forbidding `agent` → `chat`/`app` and `shared` → slice imports. Run via `pnpm lint:deps`.

# Changelog

## v0.1.0 (2026-11-15)

### Added

- Run `yami` to open a stacked-transcript chat TUI with a fixed bottom prompt. (#2)
- Send a prompt with Enter; assistant Bubbles stream in. Enter while a Run is active Steers; Esc cancels. The Activity line shows working or idle. (#3)
- With `CURSOR_API_KEY`, `yami` opens a local Cursor Session (default model `composer-2.5`, override with `CURSOR_MODEL`) and streams replies. Missing the key exits before the TUI mounts. (#4)

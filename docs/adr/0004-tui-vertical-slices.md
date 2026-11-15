# TUI code is organised in vertical slices

`src/app/` boots Ink, `src/chat/` owns bubbles/prompt/steering UI, `src/agent/` wraps the Cursor SDK. Shared types stay thin. This keeps each tracer-bullet ticket a complete path through UI and agent seams without a deep shared layer in v1.

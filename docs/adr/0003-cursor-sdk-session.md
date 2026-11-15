# Agent sessions use @cursor/sdk create + send + stream

A steerable session is `Agent.create` with local `cwd: process.cwd()`, then `agent.send` with streamed assistant text. Enter while a run is active steers (cancel + new send); Esc cancels. Auth is `CURSOR_API_KEY` (fail fast). Default model is `composer-2.5`, overridable with `CURSOR_MODEL`. Resume-by-id and cloud runtime are out of v1.

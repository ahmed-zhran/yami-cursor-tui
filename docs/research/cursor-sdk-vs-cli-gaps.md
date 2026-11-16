# Cursor SDK vs CLI — replacement gaps

**Researched:** 2026-11-16  
**SDK under test in this repo:** `@cursor/sdk@1.3.1` (`node_modules/@cursor/sdk`)  
**yami adapter:** `src/agent/`

## Verdict (1-2 sentences)

**No — a TUI built on `@cursor/sdk` local/headless runs cannot fully replace the interactive Cursor CLI (`agent` / cursor-agent).** Local SDK runs are deliberately headless: AskQuestion is auto-rejected, interactive tool approvals do not exist (auto-run or deny via sandbox/autoReview/hooks only), plan confirmation is auto-accepted, and modes stop at `agent` | `plan`.

## Gap table (Capability | CLI | @cursor/sdk local | Impact on yami TUI)

| Capability | CLI (`agent`) | `@cursor/sdk` local | Impact on yami TUI |
| --- | --- | --- | --- |
| AskQuestion (answerable) | Interactive CLI surfaces it; IDE/CLI are the interactive clients | Auto-rejected: “Interactive questions are not supported in local SDK runs.” Filtered from stream (staff: by design) | Dialog UI + `parseAskQuestion` cannot receive/answer real questions; answers as follow-up prompts do not satisfy the interaction query |
| Shell / tool approvals (“Run once”, “Run Everything”, y/n) | Interactive approve/reject; `/run-everything`; `-p` rejects needing-approval unless `--force` | No HITL: default auto-runs tools; with sandbox/autoReview, needs-approval is denied, not prompted | Approval dialogs cannot gate native tools; “Approve” reply is just another chat message |
| Plan confirmation | Plan mode + clarifying Qs; ACP documents blocking `cursor/create_plan` | `createPlanRequestQuery` auto-succeeds with empty `planUri` in local SDK runtime | Plan “confirm before build” UX cannot block; host cannot accept/reject plan |
| Auto-run / allowlist / Run Everything | First-class CLI/IDE modes; `/run-everything`; headless `--force` / `approvalMode: unrestricted` | Headless only: unrestricted auto-run **or** sandbox / `autoReview` / file hooks — no “ask user” mode | Cannot offer CLI-parity approval modes; must pick auto-run vs silent deny |
| Programmatic pre-tool approval | N/A (CLI owns UI) | Hooks are **file-based only**; no in-process callback | Host cannot wire its own approval panel into tool execution without external IPC hooks |
| Modes | `agent`, `plan`, `ask`, `/debug` | `AgentModeOption = "agent" \| "plan"` only | Ask/debug are chrome + prompt prefixes mapped to `agent`; no read-only tool enforcement from mode |
| Model selection | `/model`, `--model`, `agent models` | `model` on create/send; `Cursor.models.list()` | Feasible; yami uses env/`CURSOR_MODEL` only today |
| MCP | Auto-loads mcp.json; `agent mcp login/enable`; `--approve-mcps` | Inline `mcpServers` and/or `settingSources`; **cannot prompt OAuth/approval**; sandbox + approval-needed MCP fails closed | Without settingSources + trusted configs, MCP silent; OAuth/approval UX missing |
| Skills / rules / AGENTS.md | Loaded automatically | Loaded when workspace scan / `settingSources` allows; rules+skills in scan | Feasible if yami enables settingSources; currently create only passes `local: { cwd }` |
| Subagents | Task tool; CLI UI for tasks | `task` tool + `agents` / `.cursor/agents`; stream `task` / nested deltas | Partial: stream visible; richer CLI task chrome not in SDK events |
| Session resume / history | `--resume`, `--continue`, `agent ls`, `/resume`, `/fork`, `/rewind` | `Agent.resume(agentId)`, `Agent.list`, `Agent.messages.list`, local store | Not wired in yami; API exists but session UX is CLI-shaped |
| Cloud handoff | `&` mid-chat → Cloud Agent | Separate `cloud: {…}` runtime on `Agent.create` | Not a drop-in mid-session handoff like CLI |
| Streaming to host | Interactive UI + `-p stream-json` | Rich `run.stream()` / `onDelta` `SDKMessage`s | Good for transcript/tools/thinking; **not** for interactive queries |
| Auth | `agent login` or `CURSOR_API_KEY` / `--api-key` | `apiKey` / `CURSOR_API_KEY` or `Cursor.auth.login()` → `~/.cursor/sdk/auth.json` | yami requires `CURSOR_API_KEY` only; no CLI-login reuse documented for SDK store |
| ACP as alternate host API | `agent acp`: permissions, ask/plan modes, `cursor/ask_question`, `cursor/create_plan` | Different product surface (not `@cursor/sdk`) | Better *documented* replacement path than SDK — but AskQuestion currently not offered on ACP either |

## Detailed findings (by category, with source links)

### Interactive tools: AskQuestion, approvals, plan confirmations

**AskQuestion — hard blocker for SDK local**

- Cursor staff (@mohitjain): AskQuestion is **not exposed through the SDK**. In local SDK runs, clarifying-question requests are **filtered out of the event stream and automatically declined**, “by design today.” Only interactive UI clients (IDE, CLI on recent versions) surface them. In Plan mode, unanswered clarifications fold into `createPlan` “Pending your confirmation.”  
  Source: https://forum.cursor.com/t/cursor-python-sdk-use/163238
- Feature request still open Oct 2026: `@cursor/sdk` 1.2.0 answers `askQuestionInteractionQuery` with **“Interactive questions are not supported in local SDK runs.”** No host callback.  
  Source: https://forum.cursor.com/t/local-sdk-let-the-host-answer-askquestion/176635
- Confirmed in this repo’s package **1.3.1** compiled runtime:  
  `askQuestionInteractionQuery` → reject reason `"Interactive questions are not supported in local SDK runs"`  
  (also subagent: `"…local subagent mode"`).  
  Source: `node_modules/.pnpm/@cursor+sdk@1.3.1_zod@4.6.7/node_modules/@cursor/sdk/dist/esm/305.js`
- Headless CLI print mode likewise auto-rejects AskQuestion (same “Questions skipped by the user” wording); staff confirm `-p` never shows the question. Interactive answer path is interactive CLI / intended ACP `cursor/ask_question`.  
  Source: https://forum.cursor.com/t/cursor-agent-p-askquestion-is-auto-skipped-in-headless-mode-and-only-some-models-get-the-tool/173657  
  Source: https://cursor.com/docs/cli/acp (`cursor/ask_question`)
- Caveat: ACP docs describe `cursor/ask_question`, but staff-confirmed bug: **`agent acp` never offers the AskQuestion tool**, so the extension method is never sent.  
  Source: https://forum.cursor.com/t/agent-acp-never-offers-the-askquestion-tool-so-cursor-ask-question-is-never-sent/172976

**Approvals (Run once / Run Everything) — hard blocker for SDK local**

- SDK docs: default local agent runs tool calls **without asking for approval**; “no human-in-the-loop prompt in headless mode.” Gate via hooks or `local.sandboxOptions.enabled: true`.  
  Source: https://cursor.com/docs/sdk/typescript
- Local approval provider in SDK 1.3.1 returns `approved: false` with:  
  `Local SDK runs cannot request interactive approval for … Keep the action within the configured sandbox policy or Smart Auto Review's auto-approval boundary, or re-run without sandboxing/autoReview enabled.`  
  Source: `…/@cursor/sdk/dist/esm/305.js`
- Staff: with `sandboxOptions.enabled: true`, MCP calls needing approval fail with that interactive-approval limitation; no trust/pre-approve mechanism for sandboxed local SDK.  
  Source: https://forum.cursor.com/t/mcp-issues-with-cursor-sdk/161629
- CLI contrast: interactive CLI asks before terminal commands; `/run-everything` toggles unrestricted auto-run; headless `-p` rejects approval-needed actions unless `--force` / unrestricted `approvalMode`.  
  Sources: https://cursor.com/docs/cli/using · https://cursor.com/docs/cli/reference/slash-commands · https://cursor.com/docs/cli/headless

**Plan confirmations — hard blocker for SDK local**

- Local SDK handles `createPlanRequestQuery` by **auto-success** (`success` + `planUri: ""`), not by waiting for the host.  
  Source: `…/@cursor/sdk/dist/esm/305.js`
- Staff: without AskQuestion, plan clarifications appear inside createPlan content; host only sees createPlan — and SDK auto-accepts the plan request query.  
  Source: https://forum.cursor.com/t/cursor-python-sdk-use/163238
- ACP documents blocking `cursor/create_plan` for hosts that implement it (closer to CLI/IDE).  
  Source: https://cursor.com/docs/cli/acp
- Separate SDK gap: Plan mode may not emit standalone todo updates the way Agent mode’s todo tool does.  
  Source: https://forum.cursor.com/t/cursor-sdk-plan-mode/164118

### Tool availability / auto-run / sandbox / autoReview / hooks

| Mechanism | What docs/types say | Replacement implication |
| --- | --- | --- |
| Default local | Unrestricted auto-run of tools | Matches CLI “Run Everything” more than interactive allowlist — **without** a toggle to ask the user |
| `local.sandboxOptions` | Constrains FS/shell/network; no HITL; sandbox-by-default avoided because no approval callback | Safety without UX; MCP needing approval fails closed |
| `local.autoReview` | Classifier allow/deny; blocked calls **denied** (not escalated) because no interactive approval | Partial “smart allow”; not Run-once prompts |
| Hooks | **File-based only** (`.cursor/hooks.json` / `~/.cursor/hooks.json`); “no programmatic hook callback” | Host UI approvals need out-of-process IPC; feature-requested, not shipped |
| `tools` / `disallowedTools` | Local-only allow/deny lists | Can fake Ask-mode read-only by disallowing `shell`/`edit`/etc. — host-enforced, not SDK “ask” mode |

Sources: https://cursor.com/docs/sdk/typescript · https://forum.cursor.com/t/sdk-support-programmatic-pre-tool-hooks-for-local-agents/173879 · `node_modules/@cursor/sdk/dist/esm/options.d.ts`

CLI side still owns interactive permission UX and MCP enable/login/`--approve-mcps`.  
Sources: https://cursor.com/docs/cli/mcp · https://cursor.com/docs/cli/reference/parameters

### Modes, model selection, MCP, skills, rules, subagents

**Modes**

- CLI: Agent / Plan / Ask (+ `/debug`). Flags: `--mode=plan|ask`, `/plan`, `/ask`, `/debug`.  
  Sources: https://cursor.com/docs/cli/overview · https://cursor.com/docs/cli/using · https://cursor.com/docs/cli/reference/slash-commands · https://cursor.com/docs/cli/reference/parameters
- SDK: `mode?: "agent" | "plan"` only (`AgentModeOption`).  
  Sources: https://cursor.com/docs/sdk/typescript · `…/options.d.ts` line `export type AgentModeOption = "agent" | "plan"`
- yami maps `ask`/`debug` → SDK `agent` + soft prompt prefix (and even instructs the model to use AskQuestion — which local SDK will reject).  
  Source: `src/chat/chatMode.ts`

**Model selection**

- Both support model pick; SDK: `Cursor.models.list()`, sticky per-send overrides, Router `auto-smart` + `optimize_for`.  
  Source: https://cursor.com/docs/sdk/typescript

**MCP / skills / rules / subagents**

- CLI auto-detects mcp.json; rules + `AGENTS.md` / `CLAUDE.md`.  
  Source: https://cursor.com/docs/cli/using
- SDK: MCP from inline + optional `local.settingSources` (`project`/`user`/…); without settingSources, **only inline** MCP. Local OAuth: “SDK can’t prompt you to sign in”; reuse Cursor app login (staff: local reuse also flaky vs docs). Subagents via `agents` / `.cursor/agents/*.md`. Skills/rules part of workspace scan.  
  Source: https://cursor.com/docs/sdk/typescript · https://forum.cursor.com/t/mcp-issues-with-cursor-sdk/161629
- yami `createCursorAgent` passes only `local: { cwd }` — no `settingSources`, sandbox, autoReview, or mcpServers.  
  Source: `src/agent/createCursorAgent.ts`

### Session resume, conversation history, cloud vs local

- CLI: `agent ls` / `resume` / `--resume` / `--continue` / `/resume` / `/fork` / `/rewind` / `/summarize`; cloud handoff with `&`.  
  Sources: https://cursor.com/docs/cli/overview · https://cursor.com/docs/cli/using · https://cursor.com/docs/cli/reference/slash-commands
- SDK: durable Agent + Run; `Agent.resume(agentId)`; `Agent.list` / `get` / `messages.list`; `agent.summarize()` (local); cloud is a **separate** `cloud:` create path, not mid-chat `&`. Inline MCP not persisted across resume.  
  Source: https://cursor.com/docs/sdk/typescript
- yami: single in-process session; no resume/list UI; comment notes dispose not wired.  
  Sources: `src/agent/createCursorAgent.ts` · `src/app/start.ts`

### Streaming events the host can see vs CLI UI features

**SDK host can see** (`run.stream()` / docs): `system`, `user`, `assistant`, `thinking`, `tool_call`, `status`, `task`, `request` (bare `request_id`), `usage`, plus `onDelta` interaction updates (text/thinking/tool partials, nested task, shell-output deltas).  
Source: https://cursor.com/docs/sdk/typescript · `…/messages.d.ts`

**SDK host cannot meaningfully drive**

- Answer AskQuestion / plan confirm / interactive approval (rejected or auto-handled inside runtime — see above).
- `SDKRequestMessage` exposes only `request_id` — no documented `answer(request_id, …)` on `SDKAgent`.  
  Sources: `…/messages.d.ts` · `…/agent.d.ts`
- CLI-only chrome: review panes (Ctrl+R), `@` context picker, vim, plugins marketplace UI, sudo password prompt, worktree wizard, QR login, etc.  
  Sources: https://cursor.com/docs/cli/using · https://cursor.com/docs/cli/overview · https://cursor.com/docs/cli/reference/slash-commands

**yami adapter maps** assistant/thinking/status/tool/task/usage/`request`→dialog / AskQuestion-shaped tool args→dialog / edit tools→file_edit. Dialog confirm sends a **new** `send()` with formatted text — not an interaction-query response.  
Sources: `src/agent/createCursorAgent.ts` · `src/chat/ChatShell.tsx` (`confirmDialog` → `startRun(reply)`) · `src/chat/dialog.ts`

### Auth (API key vs CLI login)

- CLI: `agent login` (browser, stored credentials) **or** `CURSOR_API_KEY` / `--api-key`.  
  Source: https://cursor.com/docs/cli/reference/authentication
- SDK: `apiKey` / `CURSOR_API_KEY`, or `Cursor.auth.login()` minting a key into `~/.cursor/sdk/auth.json`. Credential order: explicit key → env → SDK stored login. “Stored login does **not** read credentials from a local Cursor app installation.”  
  Source: https://cursor.com/docs/sdk/typescript
- yami: fail-fast `CURSOR_API_KEY` only (`src/app/requireCursorApiKey.ts`, `src/app/start.ts`).

### Anything else that blocks CLI replacement

1. **Headless team policy asymmetry:** “Disable CLI headless mode” does **not** cover the Cursor SDK — interactive CLI can be required while SDK still runs headless.  
   Source: https://cursor.com/docs/cli/headless
2. **README vs runtime contradiction:** SDK README claims under `local.fs`, “Todos, AskQuestion, CreatePlan, SwitchMode, Await — Work as usual.” Runtime still rejects AskQuestion on local SDK runs; treat README as incomplete relative to `305.js` + staff posts.  
   Sources: `node_modules/@cursor/sdk/README.md` · `…/dist/esm/305.js` · forum links above
3. **ACP is the documented custom-client path** (permissions, ask/plan modes, create_plan / ask_question extensions), but current ACP builds still miss AskQuestion tooling and have had `request_permission` delivery bugs — closer than SDK for approvals, not yet CLI-parity.  
   Sources: https://cursor.com/docs/cli/acp · https://forum.cursor.com/t/agent-acp-never-offers-the-askquestion-tool-so-cursor-ask-question-is-never-sent/172976 · https://forum.cursor.com/t/acp-permission-rejection-not-reported-to-client/153825
4. **Model gating of AskQuestion** even where the tool exists (some models use plain text instead).  
   Source: https://forum.cursor.com/t/cursor-agent-p-askquestion-is-auto-skipped-in-headless-mode-and-only-some-models-get-the-tool/173657

## What yami already handles in UI vs what SDK blocks

| yami UI / adapter behavior | Backed by SDK? | Reality |
| --- | --- | --- |
| Stream assistant text, thinking, tool rows, run status, usage, file_edit hints | Yes — `SDKMessage` stream | Works as a headless spectator UI |
| Cancel active run | Yes — `run.cancel()` | Works |
| Mode chrome: build/plan/ask/debug + Shift+Tab | Partial — only `agent`/`plan` on wire | Ask/debug are prompt theater; tools still full agent unless you add `tools`/`disallowedTools` |
| Dialog popup for AskQuestion / request / approval | **Blocked for real HITL** | AskQuestion never answerable; approvals never requested; dialog answers are new user turns |
| Plan mode | Partial | Mode flag works; plan confirm + clarifying AskQuestion do not |
| Auth via `CURSOR_API_KEY` | Yes | Matches automation path; not CLI `agent login` UX |
| Resume / ls / fork / cloud `&` / MCP login / Run Everything | Not implemented; partly unavailable on SDK | CLI features missing by product design, not just yami backlog |
| Project MCP/rules/skills | Not enabled (`settingSources` omitted) | Silent gap vs CLI defaults |

## Paths forward (realistic options, not wishful)

1. **Keep `@cursor/sdk` local and redefine product scope**  
   Ship a **headless agent TUI**: stream + cancel + model + plan/agent, optional `sandboxOptions` / `autoReview` / file hooks / `tools` allowlists. Drop or demote AskQuestion/approval dialogs as non-functional. Fake Ask mode with `disallowedTools: ["shell","edit",…]` (or allowlist read tools). Enable `settingSources: ["project","user"]` if you want CLI-like MCP/rules.  
   *Honest fit:* automation companion, not interactive CLI clone.

2. **Switch (or dual) backend to `agent acp`**  
   Documented for custom clients: `session/request_permission` (`allow-once` / `allow-always` / `reject-once`), modes including `ask`, blocking `cursor/create_plan` / `cursor/ask_question`. Best long-term path for a TUI that wants CLI-like HITL — **but** verify current CLI build: AskQuestion still not offered on ACP; permission reporting has had bugs. Treat as engineering bet on Cursor fixing ACP interactive gaps, not as already-solved.  
   Sources: https://cursor.com/docs/cli/acp · forum ACP threads above.

3. **Hybrid**  
   Use SDK for cloud/batch/CI; use ACP or real interactive `agent` for the human terminal product. Do not claim one stack replaces both.

4. **Wait on Cursor SDK roadmaps (not ship-blocking plans)**  
   Staff are “tracking” full interaction stream / AskQuestion for SDK; programmatic `preToolUse` is a feature request only. No public ship date. Building yami’s core UX on those promises is the wishful path.

**Bottom line for yami:** replacing interactive `agent` requires either accepting headless semantics on `@cursor/sdk`, or leaving the SDK for ACP/CLI interactive surfaces — and even ACP is not full CLI parity today on AskQuestion.

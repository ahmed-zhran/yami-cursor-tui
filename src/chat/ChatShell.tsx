import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  createClipboard,
  createHostClipboard,
  createRendererClipboardAdapter,
  decodePasteBytes,
  type ClipboardService,
} from "@opentui/core";
import {
  useKeyboard,
  usePaste,
  useRenderer,
  useSelectionHandler,
  useTerminalDimensions,
} from "@opentui/react";
import type { ActiveRun, AgentPort } from "../agent/index.js";
import type { RunStatus } from "../shared/index.js";
import {
  applyModePrefix,
  nextChatMode,
  toSdkMode,
  type ChatMode,
} from "./chatMode.js";
import {
  contextPercent,
  DEFAULT_CONTEXT_WINDOW,
} from "./contextPercent.js";
import { copySucceeded, selectionCopyText } from "./copySelection.js";
import {
  formatDialogBubble,
  formatDialogReply,
  normalizeDialog,
} from "./dialog.js";
import { DialogPanel, type DialogState } from "./DialogPanel.js";
import {
  activityLabel,
  applyAssistantDelta,
  applyThinkingDelta,
  applyToolEvent,
  formatThinkingLine,
  formatToolLine,
  liveRunLine,
  withoutStaleStatus,
  type FeedItem,
} from "./feed.js";
import {
  bubbleJustify,
  paintAssistantText,
  paintBubbleText,
  paragraphDir,
  promptMarker,
  type ParagraphDir,
} from "./paint.js";
import {
  alignLine,
  clampCaret,
  deleteBackward,
  deleteForward,
  emptyPromptLine,
  insertAt,
  moveCaretVertical,
  moveCaretVisual,
  paintLineWithCaret,
  visualCaretToLogical,
  wrapDraftSegments,
} from "./promptEdit.js";
import { SlashMenu } from "./SlashMenu.js";
import {
  applySlashCompletion,
  filterSlashCommands,
  listSlashCommands,
  slashFilter,
  type SlashCommand,
} from "./slashCommands.js";
import { Header } from "./Header.js";
import { StatusBar } from "./StatusBar.js";
import { theme } from "./theme.js";
import { Toast } from "./Toast.js";
import { readWorkspaceMeta } from "./workspaceMeta.js";

export type ChatShellProps = {
  agent: AgentPort;
  model: string;
  mode?: ChatMode;
  cwd?: string;
  contextWindow?: number;
  /** Test seam: override clipboard writes (select-to-copy). */
  writeClipboard?: (text: string) => Promise<boolean> | boolean;
};

const SELECTABLE_TEXT = {
  selectable: true as const,
  selectionBg: theme.selectionBg,
  selectionFg: theme.selectionFg,
};

const PROMPT_PLACEHOLDER =
  "Message…  Enter send · Shift+Enter newline · Shift+Tab mode · / commands";
const CURSOR_CHAR = "▌";
const MAX_PROMPT_LINES = 8;

/**
 * OpenCode/Cursor-CLI-like chat: themed bubbles, activity feed, multi-line
 * prompt with cursor, slash menu, status under the input.
 */
export function ChatShell({
  agent,
  model,
  mode: initialMode = "build",
  cwd = process.cwd(),
  contextWindow = Number(process.env.CURSOR_CONTEXT_WINDOW) ||
    DEFAULT_CONTEXT_WINDOW,
  writeClipboard,
}: ChatShellProps) {
  const renderer = useRenderer();
  const { width: termWidth } = useTerminalDimensions();
  const workspace = useRef(readWorkspaceMeta(cwd));
  const commands = useMemo(() => listSlashCommands(cwd), [cwd]);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [draft, setDraft] = useState("");
  const [caret, setCaret] = useState(0);
  const [preferredDir, setPreferredDir] = useState<ParagraphDir>("ltr");
  const [mode, setMode] = useState<ChatMode>(initialMode);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [dialogDraft, setDialogDraft] = useState("");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [totalTokens, setTotalTokens] = useState(0);
  const [editedPaths, setEditedPaths] = useState<string[]>([]);
  const [cursorOn, setCursorOn] = useState(true);
  const [spinTick, setSpinTick] = useState(0);
  const [slashIndex, setSlashIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const draftRef = useRef(draft);
  const caretRef = useRef(caret);
  const preferredDirRef = useRef(preferredDir);
  const modeRef = useRef(mode);
  const dialogRef = useRef(dialog);
  const dialogDraftRef = useRef(dialogDraft);
  const runStatusRef = useRef(runStatus);
  const slashIndexRef = useRef(0);
  const activeRun = useRef<ActiveRun | null>(null);
  const runGeneration = useRef(0);
  const clipboardRef = useRef<ClipboardService | null>(null);
  const writeClipboardRef = useRef(writeClipboard);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCopiedRef = useRef("");

  draftRef.current = draft;
  caretRef.current = caret;
  preferredDirRef.current = preferredDir;
  modeRef.current = mode;
  dialogRef.current = dialog;
  dialogDraftRef.current = dialogDraft;
  runStatusRef.current = runStatus;
  slashIndexRef.current = slashIndex;
  writeClipboardRef.current = writeClipboard;

  useEffect(() => {
    const id = setInterval(() => {
      setCursorOn((v) => !v);
      setSpinTick((n) => n + 1);
    }, 120);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (writeClipboard) {
      clipboardRef.current = null;
      return;
    }
    const clipboard = createClipboard({
      host: createHostClipboard(),
      terminal: createRendererClipboardAdapter(renderer),
    });
    clipboardRef.current = clipboard;
    return () => {
      clipboardRef.current = null;
      void clipboard.dispose();
    };
  }, [renderer, writeClipboard]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 1600);
  };

  const showCopiedToast = () => {
    showToast("Copied to clipboard");
  };

  const cycleMode = () => {
    const next = nextChatMode(modeRef.current);
    modeRef.current = next;
    setMode(next);
    showToast(`Mode · ${next}`);
  };

  const dismissDialog = () => {
    dialogRef.current = null;
    dialogDraftRef.current = "";
    setDialog(null);
    setDialogDraft("");
  };

  const confirmDialog = () => {
    const current = dialogRef.current;
    if (!current) return;
    const choice = current.options?.[current.selected];
    const answer = choice?.label ?? dialogDraftRef.current.trim();
    dismissDialog();
    if (!answer) return;
    // Pair question + answer so the agent (and transcript) keep context.
    const bubble = formatDialogBubble(current, answer);
    const reply = formatDialogReply(current, answer);
    setFeed((prev) => [
      ...prev,
      { kind: "bubble", role: "user", text: bubble },
    ]);
    startRun(reply);
  };

  useSelectionHandler((selection) => {
    const text = selectionCopyText(selection);
    if (!text) {
      // Allow re-copying the same phrase after the selection clears.
      if (!selection.isDragging) lastCopiedRef.current = "";
      return;
    }
    if (text === lastCopiedRef.current) return;
    lastCopiedRef.current = text;

    void (async () => {
      const custom = writeClipboardRef.current;
      if (custom) {
        const ok = await custom(text);
        if (ok) showCopiedToast();
        return;
      }
      const clipboard = clipboardRef.current;
      if (!clipboard) return;
      try {
        const result = await clipboard.writeText(text, {
          destination: "best-available",
        });
        if (copySucceeded(result)) showCopiedToast();
      } catch {
        // Host/terminal clipboard unavailable — stay silent.
      }
    })();
  });

  const slashPrefix = slashFilter(draft);
  const slashOpen = slashPrefix !== null;
  const slashOptions = useMemo(
    () =>
      slashOpen ? filterSlashCommands(commands, slashPrefix ?? "") : [],
    [slashOpen, slashPrefix, commands],
  );

  useEffect(() => {
    setSlashIndex(0);
  }, [slashPrefix, slashOptions.length]);

  const rememberDir = (text: string) => {
    if (!text) return;
    const dir = paragraphDir(text);
    preferredDirRef.current = dir;
    setPreferredDir(dir);
  };

  const setDraftAndCaret = (next: string, nextCaret: number) => {
    const c = clampCaret(next, nextCaret);
    draftRef.current = next;
    caretRef.current = c;
    setDraft(next);
    setCaret(c);
    rememberDir(next);
  };

  const setLogicalDraft = (next: string) => {
    if (!next) {
      // Keep preferredDir so an empty field still parks the caret on the
      // last language side (Arabic → right, English → left).
      setDraftAndCaret("", 0);
      return;
    }
    setDraftAndCaret(next, next.length);
  };

  const clearDraft = () => {
    setDraftAndCaret("", 0);
  };

  const moveCaretTo = (next: number) => {
    const c = clampCaret(draftRef.current, next);
    caretRef.current = c;
    setCaret(c);
  };

  const startRun = (prompt: string) => {
    const generation = ++runGeneration.current;
    const chatMode = modeRef.current;
    setRunStatus("running");
    dismissDialog();
    // Immediate feedback before the first SDK thinking/tool event arrives.
    setFeed((prev) => [
      ...prev.filter((item) => item.kind !== "status"),
      { kind: "status", label: "Working…" },
    ]);

    const run = agent.send(
      applyModePrefix(chatMode, prompt),
      (event) => {
      if (generation !== runGeneration.current) return;

      if (event.type === "run_status") {
        if (event.phase === "error") {
          setFeed((prev) =>
            applyAssistantDelta(
              prev,
              `Error: ${event.message ?? "Run failed."}`,
            ),
          );
          return;
        }
        const label =
          event.phase === "starting"
            ? "Starting…"
            : event.message?.trim() || "Working…";
        setFeed((prev) => {
          const without = prev.filter((item) => item.kind !== "status");
          // Keep Working/Starting only until thinking/tools/text appear.
          if (
            without.some(
              (item) =>
                item.kind === "thinking" ||
                item.kind === "tool" ||
                (item.kind === "bubble" && item.role === "assistant"),
            )
          ) {
            return without;
          }
          return [...without, { kind: "status", label }];
        });
        return;
      }

      if (event.type === "assistant_delta") {
        setFeed((prev) => applyAssistantDelta(prev, event.text));
        return;
      }

      if (event.type === "thinking") {
        setFeed((prev) => applyThinkingDelta(prev, event.text));
        return;
      }

      if (event.type === "tool") {
        setFeed((prev) =>
          applyToolEvent(prev, {
            name: event.name,
            status: event.status,
            ...(event.detail ? { detail: event.detail } : {}),
          }),
        );
        return;
      }

      if (event.type === "usage") {
        setTotalTokens(event.totalTokens);
        return;
      }

      if (event.type === "file_edit") {
        setEditedPaths((prev) =>
          prev.includes(event.path) ? prev : [...prev, event.path],
        );
        return;
      }

      if (event.type === "dialog") {
        const next = normalizeDialog({
          id: event.id,
          kind: event.kind,
          title: event.title,
          selected: 0,
          ...(event.prompt ? { prompt: event.prompt } : {}),
          ...(event.options ? { options: event.options } : {}),
        });
        dialogRef.current = next;
        dialogDraftRef.current = "";
        setDialogDraft("");
        setDialog(next);
        return;
      }

      if (event.type === "finished" || event.type === "cancelled") {
        activeRun.current = null;
        setRunStatus("idle");
        setFeed((prev) => withoutStaleStatus(prev));
      }
    },
      { mode: toSdkMode(chatMode) },
    );

    activeRun.current = run;
  };

  const openTestDialog = (
    kind: DialogState["kind"],
    title: string,
    prompt: string,
    options?: DialogState["options"],
  ) => {
    const next = normalizeDialog({
      id: `ui-${kind}-${Date.now()}`,
      kind,
      title,
      prompt,
      selected: 0,
      ...(options ? { options } : {}),
    });
    dialogRef.current = next;
    dialogDraftRef.current = "";
    setDialogDraft("");
    setDialog(next);
    clearDraft();
  };

  const runLocalCommand = (cmd: SlashCommand) => {
    if (cmd.local === "clear") {
      setFeed([]);
      clearDraft();
      return;
    }
    if (cmd.local === "test-dialog") {
      openTestDialog("question", "Continue?", "Ready to continue?", [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ]);
      return;
    }
    if (cmd.local === "test-approval") {
      openTestDialog(
        "approval",
        "Shell command",
        "Run `rm -rf /tmp/demo`?",
      );
      return;
    }
    if (cmd.local === "test-freetext") {
      openTestDialog("question", "Name", "What is your name?");
      return;
    }
    if (cmd.local === "test-arabic") {
      // Sample with Arabic letters so preferredDir flips to RTL and caret paints.
      setLogicalDraft("مرحبا بالعالم");
      return;
    }
    if (cmd.local === "help" || cmd.id === "model" || cmd.id === "commands") {
      const lines =
        cmd.id === "model"
          ? [
              `model: ${model}`,
              `mode: ${mode}`,
              "Shift+Tab cycles build · plan · ask · debug",
            ]
          : [
              "Slash commands:",
              ...commands
                .filter((c) => c.kind === "command")
                .map((c) => `  ${c.label} — ${c.description}`),
              "Modes: Shift+Tab cycles build · plan · ask · debug",
              "Skills (type / to filter):",
              ...commands
                .filter((c) => c.kind === "skill")
                .slice(0, 40)
                .map((c) => `  ${c.label} — ${c.description}`),
              commands.filter((c) => c.kind === "skill").length > 40
                ? "  …"
                : "",
            ].filter(Boolean);
      setFeed((prev) => [
        ...prev,
        { kind: "bubble", role: "assistant", text: lines.join("\n") },
      ]);
      clearDraft();
    }
  };

  const completeSlash = (cmd: SlashCommand) => {
    if (cmd.local) {
      runLocalCommand(cmd);
      return;
    }
    setLogicalDraft(applySlashCompletion(draftRef.current, cmd));
  };

  const submit = () => {
    const prompt = draftRef.current.trim();
    if (!prompt) return;

    // Exact local slash with no args: /clear /help
    const exact = commands.find(
      (c) => c.local && (prompt === c.label || prompt === `/${c.id}`),
    );
    if (exact) {
      runLocalCommand(exact);
      return;
    }

    clearDraft();

    if (runStatusRef.current === "running") {
      runGeneration.current += 1;
      activeRun.current?.cancel();
      activeRun.current = null;
    }

    setFeed((prev) => [...prev, { kind: "bubble", role: "user", text: prompt }]);
    startRun(prompt);
  };

  const cancel = () => {
    if (runStatusRef.current !== "running") return;
    activeRun.current?.cancel();
  };

  useKeyboard((key) => {
    if (key.eventType === "release") return;

    if (key.shift && key.name === "tab") {
      cycleMode();
      key.preventDefault();
      return;
    }

    if (dialogRef.current) {
      const current = dialogRef.current;
      const optionCount = current.options?.length ?? 0;
      const freeText = Boolean(current.freeText) || optionCount === 0;

      if (key.name === "escape") {
        dismissDialog();
        key.preventDefault();
        return;
      }
      if (key.name === "up" && optionCount > 0) {
        const selected = Math.max(0, current.selected - 1);
        const next = { ...current, selected };
        dialogRef.current = next;
        setDialog(next);
        key.preventDefault();
        return;
      }
      if (key.name === "down" && optionCount > 0) {
        const selected = Math.min(optionCount - 1, current.selected + 1);
        const next = { ...current, selected };
        dialogRef.current = next;
        setDialog(next);
        key.preventDefault();
        return;
      }
      if (key.name === "return" && !key.shift) {
        if (optionCount > 0 || dialogDraftRef.current.trim()) {
          confirmDialog();
        }
        key.preventDefault();
        return;
      }

      // Option dialogs never touch the main prompt. Free-text answers stay
      // inside the popup draft.
      if (freeText) {
        if (key.name === "backspace") {
          const next = dialogDraftRef.current.slice(0, -1);
          dialogDraftRef.current = next;
          setDialogDraft(next);
          key.preventDefault();
          return;
        }
        if (key.ctrl || key.meta) {
          key.preventDefault();
          return;
        }
        const ch = key.sequence;
        if (ch && !ch.startsWith("\x1b") && ![...ch].some((c) => c.charCodeAt(0) < 0x20)) {
          const next = dialogDraftRef.current + ch;
          dialogDraftRef.current = next;
          setDialogDraft(next);
        }
      }
      key.preventDefault();
      return;
    }

    if (slashOpen && slashOptions.length > 0) {
      if (key.name === "up") {
        setSlashIndex((i) => Math.max(0, i - 1));
        key.preventDefault();
        return;
      }
      if (key.name === "down") {
        setSlashIndex((i) => Math.min(slashOptions.length - 1, i + 1));
        key.preventDefault();
        return;
      }
      if (
        key.name === "tab" ||
        key.sequence === "\t" ||
        (key.name === "return" && !key.shift)
      ) {
        const choice = slashOptions[slashIndexRef.current];
        if (choice) completeSlash(choice);
        key.preventDefault();
        return;
      }
      if (key.name === "escape") {
        setLogicalDraft(draftRef.current.replace(/\/[^\s]*$/, ""));
        key.preventDefault();
        return;
      }
    }

    if (key.name === "escape") {
      if (dialogRef.current) {
        dismissDialog();
      } else {
        cancel();
      }
      key.preventDefault();
      return;
    }
    if (key.ctrl && key.name === "c") {
      key.preventDefault();
      process.kill(process.pid, "SIGINT");
      return;
    }
    if (key.name === "left" || key.name === "right") {
      const delta = key.name === "left" ? -1 : 1;
      moveCaretTo(
        moveCaretVisual(draftRef.current, caretRef.current, delta),
      );
      key.preventDefault();
      return;
    }
    if (key.name === "home") {
      moveCaretTo(0);
      key.preventDefault();
      return;
    }
    if (key.name === "end") {
      moveCaretTo(draftRef.current.length);
      key.preventDefault();
      return;
    }
    if (key.name === "up" || key.name === "down") {
      const cols = Math.max(8, termWidth - 6);
      moveCaretTo(
        moveCaretVertical(
          draftRef.current,
          caretRef.current,
          cols,
          key.name === "up" ? "up" : "down",
        ),
      );
      key.preventDefault();
      return;
    }
    if (key.name === "return") {
      if (key.shift) {
        const next = insertAt(draftRef.current, caretRef.current, "\n");
        setDraftAndCaret(next.text, next.caret);
      } else {
        submit();
      }
      key.preventDefault();
      return;
    }
    if (key.name === "backspace") {
      const next = deleteBackward(draftRef.current, caretRef.current);
      setDraftAndCaret(next.text, next.caret);
      key.preventDefault();
      return;
    }
    if (key.name === "delete") {
      const next = deleteForward(draftRef.current, caretRef.current);
      setDraftAndCaret(next.text, next.caret);
      key.preventDefault();
      return;
    }
    if (key.ctrl || key.meta) return;

    const ch = key.sequence;
    if (!ch || ch.startsWith("\x1b")) return;
    if ([...ch].some((c) => c.charCodeAt(0) < 0x20)) return;
    const next = insertAt(draftRef.current, caretRef.current, ch);
    setDraftAndCaret(next.text, next.caret);
    key.preventDefault();
  });

  usePaste((event) => {
    const text = decodePasteBytes(event.bytes);
    if (!text) return;
    const open = dialogRef.current;
    if (open) {
      const optionCount = open.options?.length ?? 0;
      if (open.freeText || optionCount === 0) {
        const next = dialogDraftRef.current + text;
        dialogDraftRef.current = next;
        setDialogDraft(next);
      }
      event.preventDefault();
      return;
    }
    const next = insertAt(draftRef.current, caretRef.current, text);
    setDraftAndCaret(next.text, next.caret);
    event.preventDefault();
  });

  const activity = activityLabel(
    runStatus === "running" ? "running" : "idle",
    feed,
  );
  const pct = contextPercent(totalTokens, contextWindow);

  // Borders + horizontal padding + prompt marker ("› "/" ‹") eat columns.
  const inputInnerCols = Math.max(8, termWidth - 6);
  const draftSegs = wrapDraftSegments(draft, inputInnerCols);
  const promptHeight = Math.min(
    MAX_PROMPT_LINES + 2,
    Math.max(3, draftSegs.length + 2),
  );
  const draftDir: ParagraphDir = draft
    ? paragraphDir(draft)
    : preferredDir;
  const marker = promptMarker(draftDir);

  const live = liveRunLine(
    runStatus === "running" ? "running" : "idle",
    feed,
    spinTick,
  );
  const inputBorder =
    draft.length > 0 || runStatus === "running"
      ? theme.inputBorderFocus
      : theme.inputBorder;

  return (
    <box
      width="100%"
      height="100%"
      flexDirection="column"
      backgroundColor={theme.bg}
    >
      {toast ? <Toast message={toast} /> : null}
      <Header model={model} mode={mode} />

      <scrollbox width="100%" flexGrow={1} stickyScroll stickyStart="bottom">
        <box
          width="100%"
          flexDirection="column"
          paddingLeft={1}
          paddingRight={1}
          paddingTop={1}
          gap={0}
        >
          {feed.map((item, i) => {
            if (item.kind === "bubble") {
              const isUser = item.role === "user";
              if (isUser) {
                return (
                  <box
                    key={`b-${i}`}
                    width="100%"
                    flexDirection="column"
                    marginTop={i === 0 ? 0 : 1}
                    marginBottom={1}
                    backgroundColor={theme.userBg}
                    border
                    borderStyle="rounded"
                    borderColor={theme.userBorder}
                    paddingLeft={1}
                    paddingRight={1}
                    paddingTop={0}
                    paddingBottom={0}
                    alignItems={bubbleJustify(item.text)}
                  >
                    <text fg={theme.userLabelFg}>you</text>
                    <text fg={theme.userFg} {...SELECTABLE_TEXT}>
                      {paintBubbleText(item.text)}
                    </text>
                  </box>
                );
              }
              return (
                <box
                  key={`b-${i}`}
                  width="100%"
                  flexDirection="column"
                  marginTop={1}
                  marginBottom={1}
                  backgroundColor={theme.assistantBg}
                  border={["left"]}
                  borderColor={theme.assistantBorder}
                  paddingLeft={1}
                  paddingRight={1}
                  alignItems={bubbleJustify(item.text)}
                >
                  <text fg={theme.assistantLabelFg}>yami</text>
                  <text fg={theme.assistantFg} {...SELECTABLE_TEXT}>
                    {paintAssistantText(item.text)}
                  </text>
                </box>
              );
            }
            if (item.kind === "status") {
              return (
                <box key={`s-${i}`} width="100%" paddingLeft={1} marginTop={0}>
                  <text fg={theme.chromeFg} {...SELECTABLE_TEXT}>
                    {`▹ ${item.label}`}
                  </text>
                </box>
              );
            }
            if (item.kind === "thinking") {
              return (
                <box key={`t-${i}`} width="100%" paddingLeft={1}>
                  <text fg={theme.thinkingFg} {...SELECTABLE_TEXT}>
                    {paintBubbleText(formatThinkingLine(item.text))}
                  </text>
                </box>
              );
            }
            return (
              <box key={`tool-${i}`} width="100%" paddingLeft={1}>
                <text
                  fg={
                    item.status === "error"
                      ? theme.errorFg
                      : item.status === "completed"
                        ? theme.toolDoneFg
                        : theme.toolFg
                  }
                  {...SELECTABLE_TEXT}
                >
                  {formatToolLine(item.name, item.status, item.detail)}
                </text>
              </box>
            );
          })}
        </box>
      </scrollbox>

      {dialog ? (
        <DialogPanel
          dialog={dialog}
          answer={dialogDraft}
          cursorOn={cursorOn}
        />
      ) : null}

      {slashOpen ? (
        <SlashMenu options={slashOptions} selected={slashIndex} />
      ) : null}

      {live ? (
        <box
          width="100%"
          backgroundColor={theme.liveBg}
          paddingLeft={1}
          paddingRight={1}
          border={["top"]}
          borderColor={theme.brandMuted}
        >
          <text fg={theme.liveFg}>{live}</text>
        </box>
      ) : null}

      <box
        width="100%"
        border
        borderStyle="rounded"
        borderColor={inputBorder}
        backgroundColor={theme.inputFocusedBg}
        paddingLeft={1}
        paddingRight={1}
        height={promptHeight}
        flexDirection="column"
        alignItems="flex-start"
        onMouseDown={(event) => {
          // Click-to-place caret: map local cell → wrapped segment → logical index.
          const target = event.currentTarget;
          if (!target) return;
          const localY = Math.max(0, event.y - target.y - 1);
          const localX = Math.max(0, event.x - target.x - 1);
          const segs = wrapDraftSegments(draftRef.current, inputInnerCols);
          const seg = segs[Math.min(localY, segs.length - 1)];
          if (!seg) return;

          let col = localX;
          if (draftDir === "ltr") {
            // Skip leading marker gutter ("› " / "  ").
            col = Math.max(0, col - 2);
          } else {
            // RTL lines are right-padded; marker sits after content.
            const body = paintLineWithCaret(seg.text, null, false);
            const padded = alignLine(
              `${body}${marker.side === "right" ? ` ${marker.glyph}` : ""}`,
              inputInnerCols,
              "rtl",
            );
            const pad = Math.max(0, [...padded].length - [...body].length - 2);
            col = Math.max(0, col - pad);
          }

          const localCaret = visualCaretToLogical(seg.text, col);
          moveCaretTo(seg.start + localCaret);
          event.preventDefault();
        }}
      >
        {draft.length === 0 ? (
          <text fg={theme.inputPlaceholderFg}>
            {emptyPromptLine(
              marker.glyph,
              PROMPT_PLACEHOLDER,
              inputInnerCols,
              draftDir,
              cursorOn,
              CURSOR_CHAR,
            )}
          </text>
        ) : (
          draftSegs.map((seg, i) => {
            const active =
              caret >= seg.start &&
              caret <= seg.end &&
              (caret < seg.end ||
                i === draftSegs.length - 1 ||
                caret !== draftSegs[i + 1]?.start);
            const localCaret = active ? caret - seg.start : null;
            const body = paintLineWithCaret(seg.text, localCaret, cursorOn);
            const lead =
              marker.side === "left" ? (i === 0 ? `${marker.glyph} ` : "  ") : "";
            const trail =
              marker.side === "right"
                ? i === 0
                  ? ` ${marker.glyph}`
                  : "  "
                : "";
            const line = `${lead}${body}${trail}`;
            return (
              <text key={`p-${i}`} fg={theme.inputFg}>
                {alignLine(line, inputInnerCols, draftDir)}
              </text>
            );
          })
        )}
      </box>

      <StatusBar
        pathLabel={workspace.current.pathLabel}
        branch={workspace.current.branch}
        model={model}
        mode={mode}
        contextPct={pct}
        filesEdited={editedPaths.length}
        activity={activity}
      />
    </box>
  );
}

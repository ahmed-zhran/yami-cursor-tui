import React from "react";
import { theme } from "./theme.js";

export type DialogOption = {
  id: string;
  label: string;
};

export type DialogState = {
  id: string;
  kind: "request" | "question" | "approval";
  title: string;
  prompt?: string;
  options?: DialogOption[];
  /** Selected option index when options are present. */
  selected: number;
  /** When true, answer is typed inside this popup (not the main prompt). */
  freeText?: boolean;
};

export type DialogPanelProps = {
  dialog: DialogState;
  /** Free-text answer draft when `dialog.freeText`. */
  answer?: string;
  cursorOn?: boolean;
};

/**
 * Modal overlay for agent requests / questions / approvals.
 * Keyboard (wired in ChatShell): ↑/↓ select · Enter confirm · Esc dismiss.
 * Answers never go through the main prompt field.
 */
export function DialogPanel({
  dialog,
  answer = "",
  cursorOn = true,
}: DialogPanelProps) {
  const options = dialog.options ?? [];
  const kindLabel =
    dialog.kind === "approval"
      ? "Approval"
      : dialog.kind === "question"
        ? "Question"
        : "Waiting";

  return (
    <box
      width="100%"
      flexDirection="column"
      flexShrink={0}
      border
      borderStyle="rounded"
      borderColor={theme.chromeAccent}
      backgroundColor={theme.surfaceRaised}
      paddingLeft={1}
      paddingRight={1}
      marginBottom={0}
    >
      <text>
        <span fg={theme.chromeAccent}>{kindLabel}</span>
        <span fg={theme.chromeDim}>{` · ${dialog.title}`}</span>
      </text>
      {dialog.prompt ? (
        <text fg={theme.userFg}>{dialog.prompt}</text>
      ) : null}
      {options.length > 0 ? (
        <>
          {options.map((opt, i) => {
            const active = i === dialog.selected;
            return (
              <text key={opt.id}>
                <span fg={active ? theme.slashActiveFg : theme.chromeDim}>
                  {active ? "▸ " : "  "}
                </span>
                <span fg={active ? theme.userFg : theme.chromeFg}>
                  {opt.label}
                </span>
              </text>
            );
          })}
          <text fg={theme.chromeDim}>↑/↓ select · Enter confirm · Esc dismiss</text>
        </>
      ) : (
        <>
          <text fg={theme.chromeDim}>
            Type below · Enter confirm · Esc dismiss
          </text>
          <text fg={theme.inputFg}>
            {`› ${answer}${cursorOn ? "▌" : " "}`}
          </text>
        </>
      )}
      {dialog.kind === "approval" ? (
        <text fg={theme.chromeDim}>
          Note: Cursor SDK auto-runs tools in headless mode — CLI-style “Run
          Everything” is not available yet.
        </text>
      ) : null}
    </box>
  );
}

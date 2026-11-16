import React from "react";
import type { SlashCommand } from "./slashCommands.js";
import { theme } from "./theme.js";

export type SlashMenuProps = {
  options: SlashCommand[];
  selected: number;
};

/** Popup list above the prompt when draft is `/…`. */
export function SlashMenu({ options, selected }: SlashMenuProps) {
  if (options.length === 0) {
    return (
      <box
        width="100%"
        border
        borderStyle="rounded"
        borderColor={theme.inputBorder}
        backgroundColor={theme.slashBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text fg={theme.chromeDim}>No matching commands</text>
      </box>
    );
  }

  const windowSize = 8;
  const start = Math.max(
    0,
    Math.min(selected - 3, options.length - windowSize),
  );
  const visible = options.slice(start, start + windowSize);

  return (
    <box
      width="100%"
      flexDirection="column"
      border
      borderStyle="rounded"
      borderColor={theme.slashBorder}
      backgroundColor={theme.slashBg}
      paddingLeft={0}
      paddingRight={0}
      height={Math.min(windowSize, options.length) + 2}
    >
      {visible.map((opt, i) => {
        const index = start + i;
        const active = index === selected;
        const desc =
          opt.description.length > 48
            ? `${opt.description.slice(0, 45)}…`
            : opt.description;
        const kind = opt.kind === "skill" ? "skill" : "cmd";
        return (
          <box
            key={opt.label}
            width="100%"
            backgroundColor={active ? theme.slashActiveBg : theme.slashBg}
            paddingLeft={1}
            paddingRight={1}
          >
            <text>
              <span fg={active ? theme.slashActiveFg : theme.chromeDim}>
                {active ? "▸ " : "  "}
              </span>
              <span fg={active ? theme.slashActiveFg : theme.userFg}>
                {opt.label}
              </span>
              <span fg={theme.chromeDim}>{`  ${kind} · ${desc}`}</span>
            </text>
          </box>
        );
      })}
    </box>
  );
}

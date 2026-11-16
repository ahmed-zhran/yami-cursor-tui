import React from "react";
import type { ChatMode } from "./chatMode.js";
import { modeAccent } from "./chatMode.js";
import { theme } from "./theme.js";

export type HeaderProps = {
  model: string;
  mode: ChatMode;
};

/** Compact brand strip — product signal without crowding the transcript. */
export function Header({ model, mode }: HeaderProps) {
  return (
    <box
      width="100%"
      height={1}
      backgroundColor={theme.headerBg}
      paddingLeft={1}
      paddingRight={1}
      flexDirection="row"
      justifyContent="space-between"
    >
      <text>
        <span fg={theme.brandFg}>▌yami</span>
        <span fg={theme.chromeDim}>  chat</span>
      </text>
      <text>
        <span fg={modeAccent(mode)}>{mode}</span>
        <span fg={theme.chromeDim}> · </span>
        <span fg={theme.chromeAccent}>{model}</span>
      </text>
    </box>
  );
}

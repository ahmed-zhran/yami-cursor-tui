import React from "react";
import type { ChatMode } from "./chatMode.js";
import { modeAccent } from "./chatMode.js";
import { formatContextPercent } from "./contextPercent.js";
import type { StatusLineInput } from "./statusLine.js";
import { theme } from "./theme.js";

export type StatusBarProps = StatusLineInput & {
  mode: ChatMode;
};

/**
 * Bottom chrome: meta + colored mode on row 1, cwd path alone on the last row
 * (no "cwd" prefix — Cursor-CLI-like).
 */
export function StatusBar(props: StatusBarProps) {
  const files =
    props.filesEdited === 1 ? "1 file" : `${props.filesEdited} files`;
  const pct = formatContextPercent(props.contextPct);
  const busy = props.activity !== "idle";
  const modeFg = modeAccent(props.mode);

  return (
    <box width="100%" flexDirection="column">
      <box width="100%" height={1} backgroundColor={theme.headerRule} />
      <box
        width="100%"
        height={1}
        backgroundColor={theme.chromeBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text>
          <span fg={theme.chromeFg}>{props.branch}</span>
          <span fg={theme.chromeDim}> · </span>
          <span fg={theme.chromeAccent}>{props.model}</span>
          <span fg={theme.chromeDim}> · </span>
          <span fg={theme.chromeFg}>{pct}</span>
          <span fg={theme.chromeDim}> · </span>
          <span fg={theme.chromeFg}>{files}</span>
          <span fg={theme.chromeDim}> · </span>
          <span fg={modeFg}>{props.mode}</span>
          <span fg={theme.chromeDim}> · </span>
          <span fg={busy ? theme.liveFg : theme.chromeDim}>
            {props.activity}
          </span>
        </text>
      </box>
      <box
        width="100%"
        height={1}
        backgroundColor={theme.chromeBg}
        paddingLeft={1}
        paddingRight={1}
      >
        <text>
          <span fg={theme.brandFg}>{props.pathLabel}</span>
        </text>
      </box>
    </box>
  );
}

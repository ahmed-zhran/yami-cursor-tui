import React from "react";
import { theme } from "./theme.js";

export type ToastProps = {
  message: string;
};

/** Floating notice anchored top-right (select-to-copy, etc.). */
export function Toast({ message }: ToastProps) {
  return (
    <box
      position="absolute"
      top={1}
      right={1}
      zIndex={100}
      backgroundColor={theme.toastBg}
      border
      borderStyle="rounded"
      borderColor={theme.toastBorder}
      paddingLeft={1}
      paddingRight={1}
    >
      <text>
        <span fg={theme.toastBorder}>✓ </span>
        <span fg={theme.toastFg}>{message}</span>
      </text>
    </box>
  );
}
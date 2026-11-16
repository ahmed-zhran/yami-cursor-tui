/**
 * Product chat modes (CLI-like). SDK only understands `agent` | `plan`;
 * ask/debug map to agent with a soft instruction prefix.
 */

import { theme } from "./theme.js";

export type ChatMode = "build" | "plan" | "ask" | "debug";

export const CHAT_MODES: readonly ChatMode[] = [
  "build",
  "plan",
  "ask",
  "debug",
] as const;

/** Accent color for the active chat mode. */
export function modeAccent(mode: ChatMode): string {
  switch (mode) {
    case "plan":
      return theme.modePlan;
    case "ask":
      return theme.modeAsk;
    case "debug":
      return theme.modeDebug;
    case "build":
    default:
      return theme.modeBuild;
  }
}

export function nextChatMode(current: ChatMode): ChatMode {
  const i = CHAT_MODES.indexOf(current);
  const next = CHAT_MODES[(i + 1) % CHAT_MODES.length];
  return next ?? "build";
}

export function parseChatMode(raw: string | undefined): ChatMode {
  const v = raw?.trim().toLowerCase();
  if (v === "plan" || v === "ask" || v === "debug" || v === "build") return v;
  if (v === "agent") return "build";
  return "build";
}

/** SDK conversation mode for this UI mode. */
export function toSdkMode(mode: ChatMode): "agent" | "plan" {
  return mode === "plan" ? "plan" : "agent";
}

/** Soft instruction prepended for modes the SDK cannot express natively. */
export function modePromptPrefix(mode: ChatMode): string | null {
  if (mode === "ask") {
    return [
      "[Ask mode — answer questions only.",
      "Do not edit files, run shell commands, or make other changes.",
      "Read the codebase when needed to answer.",
      "When you need a choice from the user, use AskQuestion with explicit",
      "options (yes/no or a short selectable list) — never free-text only.]",
    ].join(" ");
  }
  if (mode === "debug") {
    return [
      "[Debug mode — investigate failures and root causes.",
      "Prefer diagnosis and evidence; only change code when fixing the bug.",
      "When you need a choice from the user, use AskQuestion with explicit options.]",
    ].join(" ");
  }
  return null;
}

export function applyModePrefix(mode: ChatMode, prompt: string): string {
  const prefix = modePromptPrefix(mode);
  return prefix ? `${prefix}\n\n${prompt}` : prompt;
}

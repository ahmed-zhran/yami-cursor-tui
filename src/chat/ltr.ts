/**
 * Force left-to-right TUI layout.
 *
 * Ink's cell renderer drops Unicode bidi controls (they are Default_Ignorable),
 * so LRI/PDI never reach the terminal. We use two layers instead:
 *
 * 1. ECMA-48 SCP → LTR (`CSI 1 SP k`) on the TTY before Ink mounts.
 * 2. A visible LTR-strong gutter on every chrome/bubble line so auto-bidi
 *    paragraphs still resolve LTR even when the host ignores SCP.
 *
 * Full RTL mode is deferred; do not remove these without an explicit feature.
 */

/** Visible left gutter; LTR-strong so auto paragraph direction stays LTR. */
export const LTR_GUTTER = "▏ ";

/** Prefix one visual line for LTR layout (safe through Ink). */
export function asLtr(text: string): string {
  return `${LTR_GUTTER}${text}`;
}

/** ECMA-48 Select Character Path — LTR (`CSI 1 SP k`). */
export const SCP_LTR = "\u001b[1 k";
/** ECMA-48 Select Character Path — terminal default (`CSI 0 SP k`). */
export const SCP_DEFAULT = "\u001b[0 k";

/**
 * Ask the host TTY for an LTR character path. No-op when stdout is not a TTY.
 * Call before Ink mounts; pair with {@link restoreTerminalDirection} on exit.
 */
export function forceTerminalLtr(
  stream: NodeJS.WriteStream = process.stdout,
): void {
  if (!stream.isTTY) return;
  stream.write(SCP_LTR);
}

/** Restore the terminal's default character path after the TUI exits. */
export function restoreTerminalDirection(
  stream: NodeJS.WriteStream = process.stdout,
): void {
  if (!stream.isTTY) return;
  stream.write(SCP_DEFAULT);
}

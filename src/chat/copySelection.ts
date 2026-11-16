/**
 * Select-to-copy helpers. Copy only when a selection finishes (not while
 * dragging), and only when there is real text.
 */

export function selectionCopyText(
  selection: { isDragging: boolean; getSelectedText(): string },
): string | null {
  if (selection.isDragging) return null;
  const text = selection.getSelectedText();
  if (!text || !text.trim()) return null;
  // Keep internal newlines; trim only a trailing newline from the gesture.
  return text.replace(/\n$/, "");
}

export function copySucceeded(result: {
  host: { status: string };
  terminal: { status: string };
}): boolean {
  return (
    result.host.status === "written" ||
    result.terminal.status === "attempted"
  );
}

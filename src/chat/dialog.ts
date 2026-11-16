import type { DialogOption, DialogState } from "./DialogPanel.js";

const YES_NO: DialogOption[] = [
  { id: "yes", label: "Yes" },
  { id: "no", label: "No" },
];

const APPROVAL: DialogOption[] = [
  { id: "approve", label: "Approve" },
  { id: "reject", label: "Reject" },
];

function clampSelected(selected: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(Math.floor(selected), count - 1));
}

/** Best question text for display / agent context. */
export function dialogQuestionText(dialog: DialogState): string {
  const prompt = dialog.prompt?.trim();
  if (prompt) return prompt;
  const title = dialog.title.trim();
  return title || "Question";
}

/**
 * Compact bubble label shown in the transcript after a popup answer.
 * Keeps the question attached so the thread is readable.
 */
export function formatDialogBubble(dialog: DialogState, answer: string): string {
  return `${dialogQuestionText(dialog)} → ${answer}`;
}

/**
 * Prompt sent to the agent when the user confirms a popup.
 * Bare answers like "Yes" / "Ahmed" lose the question; this pairs them.
 */
export function formatDialogReply(dialog: DialogState, answer: string): string {
  const kind =
    dialog.kind === "approval"
      ? "Approval"
      : dialog.kind === "request"
        ? "Request"
        : "Question";
  const question = dialogQuestionText(dialog);
  const lines = [
    `[Dialog reply — ${kind}]`,
    `Question: ${question}`,
    `Answer: ${answer}`,
    "",
    "Treat this as the user's answer to that dialog question (not a new standalone request).",
  ];
  return lines.join("\n");
}

/**
 * Ensure every dialog is answerable inside the popup:
 * - keep provided options
 * - approval → Approve / Reject
 * - request → Yes / No
 * - question without options → free-text (`freeText: true`)
 */
export function normalizeDialog(raw: DialogState): DialogState {
  const existing = raw.options?.filter((o) => o.label.trim()) ?? [];
  if (existing.length > 0) {
    return {
      ...raw,
      options: existing,
      selected: clampSelected(raw.selected, existing.length),
      freeText: false,
    };
  }

  if (raw.kind === "approval") {
    return {
      ...raw,
      options: APPROVAL,
      selected: clampSelected(raw.selected, APPROVAL.length),
      freeText: false,
    };
  }

  if (raw.kind === "request") {
    return {
      ...raw,
      options: YES_NO,
      selected: clampSelected(raw.selected, YES_NO.length),
      freeText: false,
    };
  }

  // Open question — answer typed inside the dialog, not the main prompt.
  const { options: _drop, ...rest } = raw;
  void _drop;
  return {
    ...rest,
    selected: 0,
    freeText: true,
  };
}

import { describe, expect, it } from "vitest";
import {
  formatDialogBubble,
  formatDialogReply,
  normalizeDialog,
} from "./dialog.js";

describe("normalizeDialog", () => {
  it("keeps provided options", () => {
    const next = normalizeDialog({
      id: "1",
      kind: "question",
      title: "Pick",
      selected: 1,
      options: [
        { id: "a", label: "Alpha" },
        { id: "b", label: "Beta" },
      ],
    });
    expect(next.options?.map((o) => o.label)).toEqual(["Alpha", "Beta"]);
    expect(next.selected).toBe(1);
    expect(next.freeText).toBe(false);
  });

  it("defaults request dialogs to Yes/No", () => {
    const next = normalizeDialog({
      id: "r",
      kind: "request",
      title: "Need input",
      selected: 0,
    });
    expect(next.options?.map((o) => o.label)).toEqual(["Yes", "No"]);
    expect(next.freeText).toBe(false);
  });

  it("defaults approval dialogs to Approve/Reject", () => {
    const next = normalizeDialog({
      id: "a",
      kind: "approval",
      title: "Shell",
      selected: 0,
    });
    expect(next.options?.map((o) => o.label)).toEqual(["Approve", "Reject"]);
  });

  it("marks option-less questions as free-text", () => {
    const next = normalizeDialog({
      id: "q",
      kind: "question",
      title: "Name?",
      prompt: "What is your name?",
      selected: 0,
    });
    expect(next.options).toBeUndefined();
    expect(next.freeText).toBe(true);
  });
});

describe("formatDialogReply", () => {
  it("pairs the question with the answer for the agent", () => {
    const dialog = normalizeDialog({
      id: "q",
      kind: "question",
      title: "Continue?",
      prompt: "Ready to continue?",
      selected: 0,
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    });
    const reply = formatDialogReply(dialog, "Yes");
    expect(reply).toContain("Question: Ready to continue?");
    expect(reply).toContain("Answer: Yes");
    expect(reply).toMatch(/dialog question/i);
    expect(formatDialogBubble(dialog, "Yes")).toBe(
      "Ready to continue? → Yes",
    );
  });
});

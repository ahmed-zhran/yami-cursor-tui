import { describe, expect, it } from "vitest";
import {
  alignLine,
  deleteBackward,
  emptyPromptLine,
  insertAt,
  logicalCaretToVisual,
  moveCaretVertical,
  moveCaretVisual,
  paintLineWithCaret,
  wrapDraftSegments,
} from "./promptEdit.js";

describe("promptEdit caret", () => {
  it("inserts and deletes at the caret", () => {
    expect(insertAt("abc", 1, "X")).toEqual({ text: "aXbc", caret: 2 });
    expect(deleteBackward("abc", 2)).toEqual({ text: "ac", caret: 1 });
  });

  it("moves the caret by visual columns in Latin text", () => {
    expect(moveCaretVisual("hello", 5, -1)).toBe(4);
    expect(moveCaretVisual("hello", 0, 1)).toBe(1);
  });

  it("maps caret into the painted line", () => {
    const painted = paintLineWithCaret("ab", 1, true);
    expect(painted).toContain("▌");
    expect(painted.indexOf("▌")).toBe(1);
  });

  it("wraps with absolute ranges", () => {
    const segs = wrapDraftSegments("abcdefghij", 4);
    expect(segs.map((s) => s.text)).toEqual(["abcd", "efgh", "ij"]);
    expect(segs[0]).toMatchObject({ start: 0, end: 4 });
    expect(segs[1]).toMatchObject({ start: 4, end: 8 });
  });
});

describe("alignLine", () => {
  it("pads RTL lines to the right", () => {
    expect(alignLine("hi", 6, "rtl")).toBe("    hi");
    expect(alignLine("hi", 6, "ltr")).toBe("hi");
  });
});

describe("logicalCaretToVisual", () => {
  it("puts end caret after the visual string", () => {
    expect(logicalCaretToVisual("ab", 2)).toBe(2);
    expect(logicalCaretToVisual("ab", 0)).toBe(0);
  });
});

describe("moveCaretVertical", () => {
  it("goes to start of line when there is no line above", () => {
    expect(moveCaretVertical("hello", 3, 40, "up")).toBe(0);
  });

  it("goes to end of draft when there is no line below", () => {
    expect(moveCaretVertical("hello", 1, 40, "down")).toBe(5);
  });

  it("moves between hard-wrapped lines preserving column", () => {
    const text = "abcd\nefgh";
    // caret after "ab" (index 2) → down should land after "ef"
    expect(moveCaretVertical(text, 2, 40, "down")).toBe(7);
    expect(moveCaretVertical(text, 7, 40, "up")).toBe(2);
  });
});

describe("emptyPromptLine", () => {
  it("keeps the caret next to the marker so it stays on-screen", () => {
    const line = emptyPromptLine(
      "›",
      "Message…  Enter send · Shift+Enter newline · Shift+Tab mode · / commands",
      40,
      "ltr",
      true,
    );
    expect(line.startsWith("› ▌")).toBe(true);
    expect([...line].length).toBeLessThanOrEqual(40);
  });
});

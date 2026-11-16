import { describe, expect, it } from "vitest";
import {
  bubbleJustify,
  lineJustify,
  paintAssistantText,
  paintBubbleText,
  paragraphDir,
  promptMarker,
  wrapDraftLines,
} from "./paint.js";
import { toVisualLtr } from "./visualLtr.js";

describe("paintBubbleText", () => {
  it("paints Arabic in visual order without a gutter pipe", () => {
    const logical = "مرحبا";
    expect(paintBubbleText(logical)).toBe(toVisualLtr(logical));
    expect(paintBubbleText(logical)).not.toContain("▏");
    expect(paintBubbleText(logical)).not.toBe(logical);
  });
});

describe("paintAssistantText", () => {
  it("softens common markdown markers for plain terminal text", () => {
    expect(paintAssistantText("This is **yami-cursor-tui** and `yami`.")).toBe(
      "This is yami-cursor-tui and yami.",
    );
  });
});

describe("paragraphDir / lineJustify", () => {
  it("follows the first strong character for mixed input text", () => {
    expect(paragraphDir("how محمد doing today")).toBe("ltr");
    expect(lineJustify("how محمد doing today")).toBe("flex-start");

    expect(paragraphDir("اخبار mohamed النهاردا ايه")).toBe("rtl");
    expect(lineJustify("اخبار mohamed النهاردا ايه")).toBe("flex-end");
  });

  it("does not right-align merely because Arabic appears later", () => {
    expect(lineJustify("hello مرحبا")).toBe("flex-start");
  });

  it("right-aligns Arabic-leading input; bubbles stay left", () => {
    expect(lineJustify("مرحبا")).toBe("flex-end");
    expect(lineJustify("")).toBe("flex-start");
    expect(bubbleJustify("مرحبا")).toBe("flex-start");
    expect(bubbleJustify("اخبار mohamed")).toBe("flex-start");
  });
});

describe("wrapDraftLines", () => {
  it("wraps long lines instead of overflowing", () => {
    expect(wrapDraftLines("abcdefghij", 4)).toEqual([
      "abcd",
      "efgh",
      "ij",
    ]);
  });

  it("keeps hard newlines", () => {
    expect(wrapDraftLines("hi\nthere", 10)).toEqual(["hi", "there"]);
  });
});

describe("promptMarker", () => {
  it("puts the arrow on the reading-start side", () => {
    expect(promptMarker("ltr")).toEqual({ side: "left", glyph: "›" });
    expect(promptMarker("rtl")).toEqual({ side: "right", glyph: "‹" });
  });
});

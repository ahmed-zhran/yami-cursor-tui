import { describe, expect, it } from "vitest";
import { copySucceeded, selectionCopyText } from "./copySelection.js";

describe("selectionCopyText", () => {
  it("ignores in-progress drags and empty selections", () => {
    expect(
      selectionCopyText({
        isDragging: true,
        getSelectedText: () => "hello",
      }),
    ).toBeNull();
    expect(
      selectionCopyText({
        isDragging: false,
        getSelectedText: () => "   ",
      }),
    ).toBeNull();
  });

  it("returns finished selection text", () => {
    expect(
      selectionCopyText({
        isDragging: false,
        getSelectedText: () => "hello world\n",
      }),
    ).toBe("hello world");
  });
});

describe("copySucceeded", () => {
  it("treats host write or OSC52 attempt as success", () => {
    expect(
      copySucceeded({
        host: { status: "written" },
        terminal: { status: "not-attempted" },
      }),
    ).toBe(true);
    expect(
      copySucceeded({
        host: { status: "unsupported" },
        terminal: { status: "attempted" },
      }),
    ).toBe(true);
    expect(
      copySucceeded({
        host: { status: "failed" },
        terminal: { status: "local-failure" },
      }),
    ).toBe(false);
  });
});

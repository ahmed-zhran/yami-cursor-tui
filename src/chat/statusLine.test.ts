import { describe, expect, it } from "vitest";
import { formatStatusLine } from "./statusLine.js";

describe("formatStatusLine", () => {
  it("joins Cursor-CLI-like chrome fields", () => {
    expect(
      formatStatusLine({
        pathLabel: "yami-cursor-tui",
        branch: "main",
        model: "auto",
        mode: "agent",
        contextPct: 12.5,
        filesEdited: 3,
        activity: "idle",
      }),
    ).toBe("yami-cursor-tui · main · auto · 12.5% · 3 files · agent · idle");
  });
});

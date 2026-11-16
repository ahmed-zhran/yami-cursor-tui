import { describe, expect, it } from "vitest";
import { formatPathLabel } from "./workspaceMeta.js";

describe("formatPathLabel", () => {
  it("shortens home-relative paths", () => {
    expect(formatPathLabel("/home/zhran/proj", "/home/zhran")).toBe("~/proj");
    expect(formatPathLabel("/home/zhran", "/home/zhran")).toBe("~");
  });

  it("keeps the full cwd outside home (not just basename)", () => {
    expect(formatPathLabel("/data/projects/yami-cursor-tui", "/home/zhran")).toBe(
      "/data/projects/yami-cursor-tui",
    );
  });
});

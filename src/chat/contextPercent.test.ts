import { describe, expect, it } from "vitest";
import {
  contextPercent,
  formatContextPercent,
} from "./contextPercent.js";

describe("contextPercent", () => {
  it("returns 0 for empty usage", () => {
    expect(contextPercent(0)).toBe(0);
  });

  it("computes percent of the window", () => {
    expect(contextPercent(50_000, 200_000)).toBe(25);
  });

  it("clamps at 100", () => {
    expect(contextPercent(500_000, 200_000)).toBe(100);
  });
});

describe("formatContextPercent", () => {
  it("shows em dash when unknown", () => {
    expect(formatContextPercent(0)).toBe("—");
  });

  it("formats a percentage", () => {
    expect(formatContextPercent(12.5)).toBe("12.5%");
    expect(formatContextPercent(25)).toBe("25%");
  });
});

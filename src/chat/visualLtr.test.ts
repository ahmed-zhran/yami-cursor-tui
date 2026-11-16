import { describe, expect, it } from "vitest";
import { fromVisualLtr, hasRtlScript, toVisualLtr } from "./visualLtr.js";

describe("toVisualLtr", () => {
  it("leaves pure LTR text unchanged", () => {
    expect(toVisualLtr("hello")).toBe("hello");
    expect(toVisualLtr("You: hi")).toBe("You: hi");
  });

  it("reorders Arabic so LTR cell painting reads correctly", () => {
    const logical = "السلام عليكم";
    const visual = toVisualLtr(logical);
    expect(visual).not.toBe(logical);
    // First painted glyph should be the visual start of عليكم (meem), not alef of السلام.
    expect(visual.startsWith("ا")).toBe(false);
    expect(hasRtlScript(visual)).toBe(true);
  });

  it("keeps Latin labels on the left of Arabic bodies", () => {
    const visual = toVisualLtr("You: السلام");
    expect(visual.startsWith("You: ")).toBe(true);
  });
});

describe("fromVisualLtr", () => {
  it("round-trips Arabic through visual paint", () => {
    const logical = "مرحبا";
    expect(fromVisualLtr(toVisualLtr(logical))).toBe(logical);
  });

  it("round-trips mixed Latin and Arabic", () => {
    const logical = "hi مرحبا there";
    expect(fromVisualLtr(toVisualLtr(logical))).toBe(logical);
  });

  it("leaves pure LTR unchanged", () => {
    expect(fromVisualLtr("hello")).toBe("hello");
  });
});

describe("hasRtlScript", () => {
  it("detects Arabic and ignores Latin", () => {
    expect(hasRtlScript("hello")).toBe(false);
    expect(hasRtlScript("مرحبا")).toBe(true);
  });
});


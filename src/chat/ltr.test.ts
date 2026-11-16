import { describe, expect, it, vi } from "vitest";
import {
  LTR_GUTTER,
  SCP_DEFAULT,
  SCP_LTR,
  asLtr,
  forceTerminalLtr,
  restoreTerminalDirection,
} from "./ltr.js";

describe("asLtr", () => {
  it("prefixes a visible LTR gutter so Ink cannot strip the direction cue", () => {
    expect(asLtr("idle")).toBe(`${LTR_GUTTER}idle`);
    expect(asLtr("> hello")).toBe(`${LTR_GUTTER}> hello`);
  });

  it("keeps English labels ahead of Arabic payload in source order", () => {
    const arabic = "مرحبا";
    const wrapped = asLtr(`You: ${arabic}`);
    expect(wrapped.startsWith(LTR_GUTTER)).toBe(true);
    expect(wrapped.indexOf("You: ")).toBeLessThan(wrapped.indexOf(arabic));
  });
});

describe("forceTerminalLtr", () => {
  it("writes SCP LTR to a TTY stdout", () => {
    const write = vi.fn();
    forceTerminalLtr({ isTTY: true, write } as unknown as NodeJS.WriteStream);
    expect(write).toHaveBeenCalledWith(SCP_LTR);
  });

  it("does nothing when stdout is not a TTY", () => {
    const write = vi.fn();
    forceTerminalLtr({ isTTY: false, write } as unknown as NodeJS.WriteStream);
    expect(write).not.toHaveBeenCalled();
  });
});

describe("restoreTerminalDirection", () => {
  it("writes SCP default to a TTY stdout", () => {
    const write = vi.fn();
    restoreTerminalDirection({
      isTTY: true,
      write,
    } as unknown as NodeJS.WriteStream);
    expect(write).toHaveBeenCalledWith(SCP_DEFAULT);
  });
});

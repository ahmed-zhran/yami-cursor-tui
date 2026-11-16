import { describe, expect, it } from "vitest";
import {
  applyModePrefix,
  modeAccent,
  nextChatMode,
  parseChatMode,
  toSdkMode,
} from "./chatMode.js";
import { theme } from "./theme.js";

describe("chatMode", () => {
  it("cycles build → plan → ask → debug → build", () => {
    expect(nextChatMode("build")).toBe("plan");
    expect(nextChatMode("plan")).toBe("ask");
    expect(nextChatMode("ask")).toBe("debug");
    expect(nextChatMode("debug")).toBe("build");
  });

  it("maps UI modes onto SDK agent/plan", () => {
    expect(toSdkMode("build")).toBe("agent");
    expect(toSdkMode("plan")).toBe("plan");
    expect(toSdkMode("ask")).toBe("agent");
    expect(toSdkMode("debug")).toBe("agent");
  });

  it("prefixes ask/debug prompts", () => {
    expect(applyModePrefix("ask", "why?")).toMatch(/Ask mode/);
    expect(applyModePrefix("ask", "why?")).toMatch(/why\?$/);
    expect(applyModePrefix("build", "go")).toBe("go");
  });

  it("parses env aliases", () => {
    expect(parseChatMode("agent")).toBe("build");
    expect(parseChatMode("PLAN")).toBe("plan");
  });

  it("maps modes to distinct accent colors", () => {
    expect(modeAccent("build")).toBe(theme.modeBuild);
    expect(modeAccent("plan")).toBe(theme.modePlan);
    expect(modeAccent("ask")).toBe(theme.modeAsk);
    expect(modeAccent("debug")).toBe(theme.modeDebug);
  });
});

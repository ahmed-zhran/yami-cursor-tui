import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { ChatShell } from "./ChatShell.js";

describe("ChatShell", () => {
  it("renders an empty transcript above bottom prompt chrome", () => {
    const { lastFrame } = render(<ChatShell />);
    const frame = lastFrame();

    expect(frame).toBeTruthy();
    expect(frame).not.toMatch(/bubble|assistant|user/i);
    expect(frame).toContain(">");
  });
});

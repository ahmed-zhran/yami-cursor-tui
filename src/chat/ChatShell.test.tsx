import React from "react";
import { describe, expect, it } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import {
  createMockAgent,
  type ActiveRun,
  type AgentPort,
  type AgentStreamEvent,
} from "../agent/index.js";
import { ChatShell } from "./ChatShell.js";

async function waitForFrame(
  setup: { captureCharFrame: () => string; renderOnce: () => Promise<void> },
  match: RegExp | string,
  timeoutMs = 3000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    const ok =
      typeof match === "string" ? frame.includes(match) : match.test(frame);
    if (ok) return frame;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error(
    `timed out waiting for ${String(match)}; last frame:\n${setup.captureCharFrame()}`,
  );
}

function createControllableAgent(): {
  agent: AgentPort;
  emits: AgentStreamEvent[][];
  active: ActiveRun | null;
  lastPrompt: string | null;
} {
  const emits: AgentStreamEvent[][] = [];
  let active: ActiveRun | null = null;
  let lastPrompt: string | null = null;

  const agent: AgentPort = {
    send(prompt, onEvent) {
      lastPrompt = prompt;
      const events: AgentStreamEvent[] = [];
      emits.push(events);
      let cancelled = false;

      const run: ActiveRun = {
        cancel() {
          if (cancelled) return;
          cancelled = true;
          const event = { type: "cancelled" as const };
          events.push(event);
          onEvent(event);
          if (active === run) active = null;
        },
      };

      active = run;
      Object.assign(run, {
        emit(text: string) {
          if (cancelled) return;
          const event = { type: "assistant_delta" as const, text };
          events.push(event);
          onEvent(event);
        },
        push(event: AgentStreamEvent) {
          if (cancelled) return;
          events.push(event);
          onEvent(event);
        },
        finish() {
          if (cancelled) return;
          const event = { type: "finished" as const };
          events.push(event);
          onEvent(event);
          if (active === run) active = null;
        },
      });

      return run;
    },
  };

  return {
    agent,
    emits,
    get active() {
      return active;
    },
    get lastPrompt() {
      return lastPrompt;
    },
  };
}

type ControllableRun = ActiveRun & {
  emit(text: string): void;
  push(event: AgentStreamEvent): void;
  finish(): void;
};

describe("ChatShell", () => {
  it("renders status chrome and a full-width input", async () => {
    const agent = createMockAgent({ chunkDelayMs: 10 });
    const setup = await testRender(
      <ChatShell agent={agent} model="auto" cwd="/tmp/demo-project" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/demo-project/);
      expect(frame).toMatch(/auto/);
      expect(frame).toMatch(/build/);
      expect(frame).toMatch(/idle/);
      expect(frame).toMatch(/Message/);
      // Status chrome sits under the prompt.
      expect(frame.indexOf("Message")).toBeLessThan(frame.indexOf("demo-project"));
    } finally {
      setup.renderer.destroy();
    }
  });

  it("opens a slash menu on / and completes with Tab", async () => {
    const agent = createMockAgent({ chunkDelayMs: 10 });
    const setup = await testRender(
      <ChatShell agent={agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("/");
      await waitForFrame(setup, /\/help/);
      await setup.mockInput.typeText("pl");
      await waitForFrame(setup, /\/plan/);
      setup.mockInput.pressTab();
      await setup.flush();
      // Completes into the prompt draft (non-local command).
      const frame = await waitForFrame(setup, /\/plan /);
      expect(frame).not.toMatch(/No matching commands/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("Shift+Enter inserts a newline instead of sending", async () => {
    const agent = createMockAgent({
      replyFor: () => "ok",
      chunksFor: () => ["ok"],
      chunkDelayMs: 5,
    });
    const setup = await testRender(
      <ChatShell agent={agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("line1");
      setup.mockInput.pressKey("return", { shift: true });
      await setup.mockInput.typeText("line2");
      await setup.renderOnce();
      expect(setup.captureCharFrame()).toMatch(/line1/);
      expect(setup.captureCharFrame()).toMatch(/line2/);
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /line1/);
      const frame = await waitForFrame(setup, /ok/);
      expect(frame).toMatch(/line2/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("streams an assistant reply into a distinct bubble", async () => {
    const agent = createMockAgent({
      replyFor: () => "pong",
      chunksFor: () => ["po", "ng"],
      chunkDelayMs: 15,
    });
    const setup = await testRender(
      <ChatShell agent={agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("ping");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /ping/);
      await waitForFrame(setup, /pong/);
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/idle/);
      // Soft role labels; avoid the old "Assistant" chrome.
      expect(frame).toMatch(/\byou\b/);
      expect(frame).toMatch(/\byami\b/);
      expect(frame).not.toMatch(/Assistant/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("Enter during an active Run steers", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("first");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /first/);
      expect(ctl.lastPrompt).toBe("first");
      // Let React remount the cleared <input> before the follow-up draft.
      await setup.flush();

      await setup.mockInput.typeText("second");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /second/);
      expect(ctl.lastPrompt).toBe("second");
      expect(ctl.emits[0]?.some((e) => e.type === "cancelled")).toBe(true);

      const run = ctl.active as ControllableRun | null;
      expect(run).toBeTruthy();
      run!.emit("reply:second");
      run!.finish();
      await waitForFrame(setup, /reply:second/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("Esc cancels an active Run", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("abort");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /abort/);
      setup.mockInput.pressEscape();
      await waitForFrame(setup, /idle/);
      expect(ctl.emits[0]?.some((e) => e.type === "cancelled")).toBe(true);
      expect(setup.captureCharFrame()).not.toMatch(/reply/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("shows Working before thinking and tools during thinking", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("go");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Working/);

      const run = ctl.active as ControllableRun | null;
      expect(run).toBeTruthy();
      run!.push({ type: "thinking", text: "considering options" });
      await waitForFrame(setup, /◆/);
      await waitForFrame(setup, /considering/);

      run!.push({
        type: "tool",
        name: "Read",
        status: "running",
        detail: "feed.ts",
      });
      await waitForFrame(setup, /Read/);
      await waitForFrame(setup, /feed\.ts/);
      await waitForFrame(setup, /Running Read/);

      run!.push({
        type: "tool",
        name: "Read",
        status: "completed",
        detail: "feed.ts",
      });
      run!.emit("done");
      run!.finish();
      await waitForFrame(setup, /done/);
      await waitForFrame(setup, /idle/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("copies a finished selection and shows a toast", async () => {
    const copied: string[] = [];
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell
        agent={ctl.agent}
        model="auto"
        cwd="/tmp/demo"
        writeClipboard={(text) => {
          copied.push(text);
          return true;
        }}
      />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("hi");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Working/);
      const run = ctl.active as ControllableRun | null;
      expect(run).toBeTruthy();
      run!.emit("copyable reply text");
      run!.finish();
      await waitForFrame(setup, /copyable reply text/);

      // OpenTUI selection needs press → move → release (not a synthetic drag helper).
      const frame = setup.captureCharFrame();
      const replyY = frame
        .split("\n")
        .findIndex((line) => line.includes("copyable reply text"));
      expect(replyY).toBeGreaterThan(-1);
      await setup.mockMouse.pressDown(3, replyY);
      await setup.mockMouse.moveTo(40, replyY);
      await setup.mockMouse.release(40, replyY);
      await waitForFrame(setup, /Copied to clipboard/);
      expect(copied.some((t) => t.includes("copyable"))).toBe(true);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("keeps the final reply after interim text, tools, and thinking", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("name?");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Working/);

      const run = ctl.active as ControllableRun | null;
      expect(run).toBeTruthy();
      run!.push({ type: "thinking", text: "check package.json" });
      run!.emit("Checking the repo.");
      run!.push({
        type: "tool",
        name: "read",
        status: "completed",
        detail: "/tmp/demo/package.json",
      });
      run!.push({ type: "thinking", text: "got the name" });
      run!.emit("This project is yami-cursor-tui.");
      run!.finish();

      const frame = await waitForFrame(setup, /yami-cursor-tui/);
      expect(frame).toMatch(/Checking the repo/);
      expect(frame).toMatch(/✓ read/);
      // Final answer must appear after the tool row, not merged above it.
      const toolAt = frame.search(/✓ read/i);
      const finalAt = frame.indexOf("This project is yami-cursor-tui");
      expect(toolAt).toBeGreaterThan(-1);
      expect(finalAt).toBeGreaterThan(toolAt);
      await waitForFrame(setup, /idle/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("shows cwd alone on the last status row without a cwd prefix", async () => {
    const agent = createMockAgent({ chunkDelayMs: 10 });
    const setup = await testRender(
      <ChatShell agent={agent} model="auto" cwd="/tmp/demo-project" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.renderOnce();
      const frame = setup.captureCharFrame();
      expect(frame).toMatch(/demo-project/);
      expect(frame).not.toMatch(/cwd /);
      // Empty prompt still shows the caret next to the marker.
      expect(frame).toMatch(/›\s*▌/);
    } finally {
      setup.renderer.destroy();
    }
  });

  it("opens a selectable dialog popup and confirms with Enter", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("ask me");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Working/);

      const run = ctl.active as ControllableRun | null;
      expect(run).toBeTruthy();
      run!.push({
        type: "dialog",
        kind: "question",
        id: "q1",
        title: "Continue?",
        prompt: "Do you want to continue?",
        options: [
          { id: "yes", label: "Yes" },
          { id: "no", label: "No" },
        ],
      });

      await waitForFrame(setup, /Do you want to continue/);
      await waitForFrame(setup, /▸ Yes/);
      // Typing into the main field must not leak while the popup is open.
      await setup.mockInput.typeText("leak");
      expect(setup.captureCharFrame()).not.toMatch(/leak/);

      setup.mockInput.pressArrow("down");
      await waitForFrame(setup, /▸ No/);
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Do you want to continue\? → No/);
      expect(ctl.lastPrompt).toContain("Question: Do you want to continue?");
      expect(ctl.lastPrompt).toContain("Answer: No");
    } finally {
      setup.renderer.destroy();
    }
  });

  it("accepts free-text answers inside the dialog, not the main prompt", async () => {
    const ctl = createControllableAgent();
    const setup = await testRender(
      <ChatShell agent={ctl.agent} model="auto" cwd="/tmp/demo" />,
      { width: 80, height: 40 },
    );

    try {
      await setup.mockInput.typeText("name");
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /Working/);
      const run = ctl.active as ControllableRun | null;
      run!.push({
        type: "dialog",
        kind: "question",
        id: "q-name",
        title: "Name",
        prompt: "What is your name?",
      });
      await waitForFrame(setup, /What is your name/);
      await setup.mockInput.typeText("Ahmed");
      await waitForFrame(setup, /Ahmed/);
      setup.mockInput.pressEnter();
      await waitForFrame(setup, /What is your name\? → Ahmed/);
      expect(ctl.lastPrompt).toContain("Question: What is your name?");
      expect(ctl.lastPrompt).toContain("Answer: Ahmed");
    } finally {
      setup.renderer.destroy();
    }
  });
});

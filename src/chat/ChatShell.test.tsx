import React from "react";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import {
  createMockAgent,
  type ActiveRun,
  type AgentPort,
  type AgentStreamEvent,
} from "../agent/index.js";
import { ChatShell } from "./ChatShell.js";

async function waitForFrame(
  lastFrame: () => string | undefined,
  match: RegExp | string,
  timeoutMs = 2000,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const frame = lastFrame() ?? "";
    const ok =
      typeof match === "string" ? frame.includes(match) : match.test(frame);
    if (ok) return frame;
    await new Promise((r) => setTimeout(r, 15));
  }
  throw new Error(
    `timed out waiting for ${String(match)}; last frame:\n${lastFrame()}`,
  );
}

function typeText(
  stdin: { write: (data: string) => void },
  text: string,
): void {
  for (const ch of text) {
    stdin.write(ch);
  }
}

/** Agent that holds a Run open until test code emits/finishes/cancels. */
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

      // Expose helpers on the run for tests via closure object.
      Object.assign(run, {
        emit(text: string) {
          if (cancelled) return;
          const event = { type: "assistant_delta" as const, text };
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
  finish(): void;
};

describe("ChatShell", () => {
  it("renders an empty transcript above bottom prompt chrome", () => {
    const agent = createMockAgent({ chunkDelayMs: 10 });
    const { lastFrame } = render(<ChatShell agent={agent} />);
    const frame = lastFrame();

    expect(frame).toBeTruthy();
    expect(frame).toContain(">");
    expect(frame).toMatch(/idle/i);
  });

  it("Enter appends a user Bubble and streams an assistant Bubble", async () => {
    const agent = createMockAgent({
      replyFor: () => "pong",
      chunksFor: () => ["po", "ng"],
      chunkDelayMs: 20,
    });
    const { lastFrame, stdin, unmount } = render(<ChatShell agent={agent} />);

    typeText(stdin, "ping");
    stdin.write("\r");

    await waitForFrame(lastFrame, /You: ping/);
    expect(lastFrame()).toMatch(/working/i);

    await waitForFrame(lastFrame, /Assistant: po/);
    const frame = await waitForFrame(lastFrame, /Assistant: pong/);
    expect(frame).toMatch(/You: ping/);
    expect(frame).toMatch(/idle/i);
    unmount();
  });

  it("Enter during an active Run Steers (cancel + new Run)", async () => {
    const ctl = createControllableAgent();
    const { lastFrame, stdin, unmount } = render(
      <ChatShell agent={ctl.agent} />,
    );

    typeText(stdin, "first");
    stdin.write("\r");
    await waitForFrame(lastFrame, /You: first/);
    expect(lastFrame()).toMatch(/working/i);
    expect(ctl.lastPrompt).toBe("first");

    typeText(stdin, "second");
    stdin.write("\r");

    await waitForFrame(lastFrame, /You: second/);
    expect(ctl.lastPrompt).toBe("second");
    expect(ctl.emits[0]?.some((e) => e.type === "cancelled")).toBe(true);

    const run = ctl.active as ControllableRun | null;
    expect(run).toBeTruthy();
    run!.emit("reply:second");
    run!.finish();

    const frame = await waitForFrame(lastFrame, /Assistant: reply:second/);
    expect(frame).toMatch(/You: first/);
    expect(frame).toMatch(/You: second/);
    expect(frame).not.toMatch(/reply:first/);
    expect(frame).toMatch(/idle/i);
    unmount();
  });

  it("Esc cancels an active Run without a follow-up Bubble", async () => {
    const ctl = createControllableAgent();
    const { lastFrame, stdin, unmount } = render(
      <ChatShell agent={ctl.agent} />,
    );

    typeText(stdin, "abort-me");
    stdin.write("\r");
    await waitForFrame(lastFrame, /You: abort-me/);
    expect(lastFrame()).toMatch(/working/i);

    stdin.write("\x1b");
    await waitForFrame(lastFrame, /idle/i);

    const frame = lastFrame() ?? "";
    expect(frame).toMatch(/You: abort-me/);
    expect(frame).not.toMatch(/Assistant:/);
    expect(ctl.emits[0]?.some((e) => e.type === "cancelled")).toBe(true);
    unmount();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockAgent } from "./createMockAgent.js";
import type { AgentStreamEvent } from "./port.js";

function collect(
  send: ReturnType<typeof createMockAgent>["send"],
  prompt: string,
): { events: AgentStreamEvent[]; cancel: () => void } {
  const events: AgentStreamEvent[] = [];
  const run = send(prompt, (e) => {
    events.push(e);
  });
  return { events, cancel: () => run.cancel() };
}

describe("createMockAgent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("streams assistant deltas then finished for a prompt", async () => {
    const agent = createMockAgent({
      replyFor: () => "hello world",
      chunksFor: (reply) => reply.split(" "),
      chunkDelayMs: 10,
    });
    const { events } = collect(agent.send, "hi");

    await vi.advanceTimersByTimeAsync(10);
    expect(events).toEqual([{ type: "assistant_delta", text: "hello" }]);

    await vi.advanceTimersByTimeAsync(10);
    // Last chunk and finished land in the same turn (finished is sync after the final delta).
    expect(events).toEqual([
      { type: "assistant_delta", text: "hello" },
      { type: "assistant_delta", text: "world" },
      { type: "finished" },
    ]);
  });

  it("cancel stops further deltas and emits cancelled", async () => {
    const agent = createMockAgent({
      replyFor: () => "abcdef",
      chunksFor: (reply) => reply.split(""),
      chunkDelayMs: 10,
    });
    const { events, cancel } = collect(agent.send, "x");

    await vi.advanceTimersByTimeAsync(10);
    expect(events).toEqual([{ type: "assistant_delta", text: "a" }]);

    cancel();
    expect(events.at(-1)).toEqual({ type: "cancelled" });

    await vi.advanceTimersByTimeAsync(100);
    expect(events.filter((e) => e.type === "assistant_delta")).toHaveLength(1);
  });
});

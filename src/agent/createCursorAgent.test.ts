import { afterEach, describe, expect, it, vi } from "vitest";
import type { AgentStreamEvent } from "./port.js";

type FakeRun = {
  status: "running" | "finished" | "cancelled" | "error";
  stream: () => AsyncGenerator<{
    type: string;
    message?: { content: Array<{ type: string; text?: string }> };
  }>;
  wait: () => Promise<{
    status: "finished" | "cancelled" | "error";
    error?: { message?: string };
  }>;
  cancel: () => Promise<void>;
};

function collect(
  send: (
    prompt: string,
    onEvent: (event: AgentStreamEvent) => void,
  ) => { cancel(): void },
  prompt: string,
): { events: AgentStreamEvent[]; cancel: () => void } {
  const events: AgentStreamEvent[] = [];
  const run = send(prompt, (e) => {
    events.push(e);
  });
  return { events, cancel: () => run.cancel() };
}

async function flush(): Promise<void> {
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
}

describe("createCursorAgent", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("streams assistant text then finished from the SDK run", async () => {
    const fakeRun: FakeRun = {
      status: "running",
      async *stream() {
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "hello " }],
          },
        };
        yield {
          type: "assistant",
          message: {
            content: [{ type: "text", text: "world" }],
          },
        };
      },
      async wait() {
        this.status = "finished";
        return { status: "finished" };
      },
      async cancel() {
        this.status = "cancelled";
      },
    };

    const create = vi.fn().mockResolvedValue({
      send: vi.fn().mockResolvedValue(fakeRun),
      close: vi.fn(),
      [Symbol.asyncDispose]: async () => undefined,
    });

    const { createCursorAgent } = await import("./createCursorAgent.js");
    const agent = await createCursorAgent({
      apiKey: "cursor_test",
      createAgent: create,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "cursor_test",
        model: { id: "auto" },
        mode: "agent",
        local: { cwd: process.cwd() },
      }),
    );

    const { events } = collect(agent.send, "hi");
    await flush();
    await flush();

    expect(events).toEqual([
      { type: "assistant_delta", text: "hello " },
      { type: "assistant_delta", text: "world" },
      { type: "finished" },
    ]);
  });

  it("surfaces SDK run errors as assistant text instead of silent idle", async () => {
    const fakeRun: FakeRun = {
      status: "running",
      async *stream() {},
      async wait() {
        this.status = "error";
        return {
          status: "error",
          error: { message: "You're out of usage. Switch to Auto." },
        };
      },
      async cancel() {},
    };

    const create = vi.fn().mockResolvedValue({
      send: vi.fn().mockResolvedValue(fakeRun),
      close: vi.fn(),
      [Symbol.asyncDispose]: async () => undefined,
    });

    const { createCursorAgent } = await import("./createCursorAgent.js");
    const agent = await createCursorAgent({
      apiKey: "cursor_test",
      createAgent: create,
    });

    const { events } = collect(agent.send, "hi");
    await flush();
    await flush();

    expect(events).toEqual([
      {
        type: "assistant_delta",
        text: "Error: You're out of usage. Switch to Auto.",
      },
      { type: "finished" },
    ]);
  });

  it("uses CURSOR_MODEL when provided via options.model", async () => {
    const create = vi.fn().mockResolvedValue({
      send: vi.fn().mockResolvedValue({
        status: "running",
        async *stream() {},
        async wait() {
          return { status: "finished" };
        },
        async cancel() {},
      }),
      close: vi.fn(),
      [Symbol.asyncDispose]: async () => undefined,
    });

    const { createCursorAgent } = await import("./createCursorAgent.js");
    await createCursorAgent({
      apiKey: "cursor_test",
      model: "gpt-5.2",
      createAgent: create,
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { id: "gpt-5.2" },
      }),
    );
  });

  it("cancel stops the SDK run and emits cancelled", async () => {
    let resolveGate: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      resolveGate = resolve;
    });

    const cancel = vi.fn(async () => {
      fakeRun.status = "cancelled";
    });

    const fakeRun: FakeRun = {
      status: "running",
      async *stream() {
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: "partial" }] },
        };
        await gate;
        yield {
          type: "assistant",
          message: { content: [{ type: "text", text: " more" }] },
        };
      },
      async wait() {
        return { status: this.status === "cancelled" ? "cancelled" : "finished" };
      },
      cancel,
    };

    const create = vi.fn().mockResolvedValue({
      send: vi.fn().mockResolvedValue(fakeRun),
      close: vi.fn(),
      [Symbol.asyncDispose]: async () => undefined,
    });

    const { createCursorAgent } = await import("./createCursorAgent.js");
    const agent = await createCursorAgent({
      apiKey: "cursor_test",
      createAgent: create,
    });

    const { events, cancel: cancelRun } = collect(agent.send, "x");
    await flush();
    expect(events).toEqual([{ type: "assistant_delta", text: "partial" }]);

    cancelRun();
    expect(events.at(-1)).toEqual({ type: "cancelled" });
    expect(cancel).toHaveBeenCalled();

    resolveGate?.();
    await flush();
    await flush();

    expect(events.filter((e) => e.type === "assistant_delta")).toHaveLength(1);
    expect(events.filter((e) => e.type === "cancelled")).toHaveLength(1);
  });

  it("serializes steer: next send waits until prior cancel settles", async () => {
    const cancelOrder: string[] = [];
    let firstCancelResolve: (() => void) | undefined;
    const firstCancelDone = new Promise<void>((resolve) => {
      firstCancelResolve = resolve;
    });
    let firstStreamResolve: (() => void) | undefined;
    const firstStreamHold = new Promise<void>((resolve) => {
      firstStreamResolve = resolve;
    });

    let sendCount = 0;
    const send = vi.fn(async () => {
      sendCount += 1;
      const id = sendCount;
      const run: FakeRun = {
        status: "running",
        async *stream() {
          yield {
            type: "assistant",
            message: { content: [{ type: "text", text: `r${id}` }] },
          };
          if (id === 1) await firstStreamHold;
        },
        async wait() {
          return {
            status: this.status === "cancelled" ? "cancelled" : "finished",
          };
        },
        async cancel() {
          cancelOrder.push(`cancel-${id}`);
          this.status = "cancelled";
          firstStreamResolve?.();
          if (id === 1) {
            await firstCancelDone;
          }
        },
      };
      return run;
    });

    const create = vi.fn().mockResolvedValue({
      send,
      close: vi.fn(),
      [Symbol.asyncDispose]: async () => undefined,
    });

    const { createCursorAgent } = await import("./createCursorAgent.js");
    const agent = await createCursorAgent({
      apiKey: "cursor_test",
      createAgent: create,
    });

    const first = collect(agent.send, "one");
    await flush();
    expect(first.events).toEqual([{ type: "assistant_delta", text: "r1" }]);

    first.cancel();
    const second = collect(agent.send, "two");

    // Second send must not start until first cancel finishes.
    await flush();
    expect(send).toHaveBeenCalledTimes(1);

    firstCancelResolve?.();
    await flush();
    await flush();
    await flush();

    expect(send).toHaveBeenCalledTimes(2);
    expect(cancelOrder[0]).toBe("cancel-1");
    expect(second.events).toContainEqual({
      type: "assistant_delta",
      text: "r2",
    });
  });
});

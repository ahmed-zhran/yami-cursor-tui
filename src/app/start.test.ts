import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createCliRenderer = vi.fn();
const createRoot = vi.fn();
const createCursorAgent = vi.fn();
const destroy = vi.fn();
const unmount = vi.fn();
const render = vi.fn();

vi.mock("@opentui/core", () => ({
  createCliRenderer: (...args: unknown[]) => createCliRenderer(...args),
}));

vi.mock("@opentui/react", () => ({
  createRoot: (...args: unknown[]) => createRoot(...args),
}));

vi.mock("../agent/createCursorAgent.js", () => ({
  createCursorAgent: (...args: unknown[]) => createCursorAgent(...args),
}));

describe("startApp", () => {
  const originalKey = process.env.CURSOR_API_KEY;

  beforeEach(() => {
    createCliRenderer.mockReset();
    createRoot.mockReset();
    createCursorAgent.mockReset();
    destroy.mockReset();
    unmount.mockReset();
    render.mockReset();
    createCursorAgent.mockResolvedValue({ send: vi.fn() });
    createCliRenderer.mockResolvedValue({ destroy, on: vi.fn() });
    createRoot.mockReturnValue({ render, unmount });
  });

  it("enables exitOnCtrlC so Ctrl+C quits the TUI", async () => {
    process.env.CURSOR_API_KEY = "cursor_test";
    const { startApp } = await import("./start.js");
    startApp();

    await vi.waitFor(() => {
      expect(createCliRenderer).toHaveBeenCalled();
    });
    expect(createCliRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ exitOnCtrlC: true }),
    );
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.CURSOR_API_KEY;
    } else {
      process.env.CURSOR_API_KEY = originalKey;
    }
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("exits non-zero with a clear message before OpenTUI mounts when key is missing", async () => {
    delete process.env.CURSOR_API_KEY;
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const { startApp } = await import("./start.js");
    expect(() => startApp()).toThrow("process.exit");
    expect(exit).toHaveBeenCalledWith(1);
    expect(error).toHaveBeenCalledWith(
      expect.stringMatching(/CURSOR_API_KEY is required/),
    );
    expect(createCliRenderer).not.toHaveBeenCalled();
    expect(createCursorAgent).not.toHaveBeenCalled();
  });

  it("creates the Cursor agent and mounts OpenTUI when the key is set", async () => {
    process.env.CURSOR_API_KEY = "cursor_test";
    const { startApp } = await import("./start.js");
    startApp();

    await vi.waitFor(() => {
      expect(createCursorAgent).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(createCliRenderer).toHaveBeenCalled();
      expect(render).toHaveBeenCalled();
    });

    expect(createCursorAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "cursor_test",
        model: expect.any(String),
        mode: "agent",
      }),
    );
  });
});

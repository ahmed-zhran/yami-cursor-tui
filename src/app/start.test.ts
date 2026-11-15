import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const render = vi.fn();
const createCursorAgent = vi.fn();

vi.mock("ink", () => ({
  render: (...args: unknown[]) => render(...args),
}));

vi.mock("../agent/createCursorAgent.js", () => ({
  createCursorAgent: (...args: unknown[]) => createCursorAgent(...args),
}));

describe("startApp", () => {
  const originalKey = process.env.CURSOR_API_KEY;

  beforeEach(() => {
    render.mockReset();
    createCursorAgent.mockReset();
    createCursorAgent.mockResolvedValue({ send: vi.fn() });
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

  it("exits non-zero with a clear message before Ink mounts when key is missing", async () => {
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
    expect(render).not.toHaveBeenCalled();
    expect(createCursorAgent).not.toHaveBeenCalled();
  });

  it("creates the Cursor agent and mounts Ink when the key is set", async () => {
    process.env.CURSOR_API_KEY = "cursor_test";
    const { startApp } = await import("./start.js");
    startApp();

    await vi.waitFor(() => {
      expect(createCursorAgent).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(render).toHaveBeenCalled();
    });

    expect(createCursorAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "cursor_test",
      }),
    );
  });
});

import { describe, expect, it } from "vitest";
import { requireCursorApiKey } from "./requireCursorApiKey.js";

describe("requireCursorApiKey", () => {
  it("returns the trimmed key when set", () => {
    expect(requireCursorApiKey({ CURSOR_API_KEY: "  cursor_test  " })).toBe(
      "cursor_test",
    );
  });

  it("throws a clear message when missing", () => {
    expect(() => requireCursorApiKey({})).toThrow(/CURSOR_API_KEY is required/);
  });

  it("throws when blank", () => {
    expect(() => requireCursorApiKey({ CURSOR_API_KEY: "   " })).toThrow(
      /CURSOR_API_KEY is required/,
    );
  });
});

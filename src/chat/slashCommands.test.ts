import { describe, expect, it } from "vitest";
import {
  applySlashCompletion,
  filterSlashCommands,
  listSlashCommands,
  resetSlashCommandCache,
  slashFilter,
  type SlashCommand,
} from "./slashCommands.js";

describe("slashCommands", () => {
  it("detects a trailing slash token", () => {
    expect(slashFilter("")).toBe(null);
    expect(slashFilter("hello")).toBe(null);
    expect(slashFilter("/")).toBe("");
    expect(slashFilter("/pl")).toBe("pl");
    expect(slashFilter("hi\n/te")).toBe("te");
    expect(slashFilter("/plan now")).toBe(null);
  });

  it("filters by prefix", () => {
    const cmds: SlashCommand[] = [
      {
        id: "plan",
        label: "/plan",
        description: "d",
        kind: "command",
      },
      {
        id: "help",
        label: "/help",
        description: "d",
        kind: "command",
      },
    ];
    expect(filterSlashCommands(cmds, "p").map((c) => c.id)).toEqual(["plan"]);
  });

  it("applies completion on the last line", () => {
    expect(
      applySlashCompletion("hi\n/pl", {
        id: "plan",
        label: "/plan",
        description: "d",
        kind: "command",
      }),
    ).toBe("hi\n/plan ");
  });

  it("lists builtins including help and clear", () => {
    resetSlashCommandCache();
    const ids = listSlashCommands(process.cwd()).map((c) => c.id);
    expect(ids).toContain("help");
    expect(ids).toContain("clear");
    expect(ids).toContain("plan");
    expect(ids).toContain("test-dialog");
    expect(ids).toContain("test-approval");
    expect(ids).toContain("test-freetext");
    expect(ids).toContain("test-arabic");
  });
});

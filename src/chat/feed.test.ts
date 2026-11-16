import { describe, expect, it } from "vitest";
import {
  activityLabel,
  applyAssistantDelta,
  applyThinkingDelta,
  applyToolEvent,
  formatThinkingLine,
  formatToolLine,
  joinAssistantText,
  liveRunLine,
  withoutStaleStatus,
  type FeedItem,
} from "./feed.js";

describe("feed helpers", () => {
  it("formats tool and thinking lines", () => {
    expect(formatToolLine("Shell", "running")).toBe("◉ Shell");
    expect(
      formatToolLine(
        "Read",
        "completed",
        "/data/projects/yami-cursor-tui/package.json",
      ),
    ).toBe("✓ Read  yami-cursor-tui/package.json");
    expect(formatThinkingLine("  hello   world  ")).toBe("◆ hello world");
    expect(formatThinkingLine("")).toBe("◆ Thinking…");
  });

  it("joins assistant chunks without gluing sentences or splitting tokens", () => {
    expect(joinAssistantText("name.", "This project")).toBe(
      "name. This project",
    );
    expect(joinAssistantText("po", "ng")).toBe("pong");
    expect(joinAssistantText("hello ", "world")).toBe("hello world");
  });

  it("keeps the reply bubble at the end after tools/thinking", () => {
    let feed: FeedItem[] = [{ kind: "status", label: "Working…" }];
    feed = applyThinkingDelta(feed, "looking up the name");
    feed = applyAssistantDelta(feed, "Checking the repo.");
    feed = applyToolEvent(feed, {
      name: "read",
      status: "running",
      detail: "package.json",
    });
    feed = applyToolEvent(feed, {
      name: "read",
      status: "completed",
      detail: "package.json",
    });
    feed = applyThinkingDelta(feed, "got it");
    feed = applyAssistantDelta(feed, "This project is yami-cursor-tui.");

    expect(feed.map((item) => item.kind)).toEqual([
      "thinking",
      "bubble",
      "tool",
      "thinking",
      "bubble",
    ]);
    const last = feed.at(-1);
    expect(last).toMatchObject({
      kind: "bubble",
      role: "assistant",
      text: "This project is yami-cursor-tui.",
    });
    expect(feed[1]).toMatchObject({
      kind: "bubble",
      text: "Checking the repo.",
    });
  });

  it("picks activity from the latest running tool", () => {
    const feed: FeedItem[] = [
      { kind: "thinking", text: "plan" },
      { kind: "tool", name: "Shell", status: "running" },
    ];
    expect(activityLabel("running", feed)).toBe("tool:Shell");
    expect(activityLabel("idle", feed)).toBe("idle");
  });

  it("shows Working before thinking, then tools during thinking", () => {
    expect(
      liveRunLine("running", [{ kind: "status", label: "Working…" }], 0),
    ).toMatch(/Working…/);

    const during: FeedItem[] = [
      { kind: "thinking", text: "looking around" },
      {
        kind: "tool",
        name: "Read",
        status: "running",
        detail: "feed.ts",
      },
    ];
    expect(liveRunLine("running", during, 1)).toMatch(/Running Read/);
    expect(liveRunLine("running", during, 1)).toMatch(/feed\.ts/);
    expect(activityLabel("running", during)).toBe("tool:Read");
  });

  it("drops stale status once real work arrives", () => {
    const feed: FeedItem[] = [
      { kind: "status", label: "Working…" },
      { kind: "thinking", text: "hi" },
    ];
    expect(withoutStaleStatus(feed)).toEqual([
      { kind: "thinking", text: "hi" },
    ]);
  });
});

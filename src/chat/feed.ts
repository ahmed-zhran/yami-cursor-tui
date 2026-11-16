/** Transcript rows beyond user/assistant bubbles (CLI-like activity). */
export type FeedItem =
  | { kind: "bubble"; role: "user" | "assistant"; text: string }
  | { kind: "status"; label: string }
  | { kind: "thinking"; text: string }
  | {
      kind: "tool";
      name: string;
      status: "running" | "completed" | "error";
      detail?: string;
    };

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"] as const;

export function spinnerFrame(tick: number): string {
  return SPINNER[Math.abs(tick) % SPINNER.length] ?? "⠋";
}

export function formatToolLine(
  name: string,
  status: "running" | "completed" | "error",
  detail?: string,
): string {
  const mark =
    status === "running" ? "◉" : status === "completed" ? "✓" : "✗";
  const tail = detail?.trim() ? `  ${clip(shortDetail(detail.trim()), 56)}` : "";
  return `${mark} ${name}${tail}`;
}

export function formatThinkingLine(text: string): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (!oneLine) return "◆ Thinking…";
  return `◆ ${clip(oneLine, 100)}`;
}

/**
 * Join streamed assistant chunks. Token streams stay glued ("po"+"ng");
 * only insert a space when a sentence end butts against a new sentence
 * ("name."+"This" → "name. This").
 */
export function joinAssistantText(prev: string, next: string): string {
  if (!prev) return next;
  if (!next) return prev;
  if (/\s$/.test(prev) || /^\s/.test(next)) return prev + next;
  if (/[.!?]$/.test(prev) && /^[A-Za-z*_`([{]/.test(next)) {
    return `${prev} ${next}`;
  }
  return prev + next;
}

/** Append or extend assistant text chronologically (reply stays at the end). */
export function applyAssistantDelta(
  feed: FeedItem[],
  text: string,
): FeedItem[] {
  const cleaned = withoutStaleStatus(feed);
  const last = cleaned.at(-1);
  if (last?.kind === "bubble" && last.role === "assistant") {
    const copy = cleaned.slice();
    copy[copy.length - 1] = {
      kind: "bubble",
      role: "assistant",
      text: joinAssistantText(last.text, text),
    };
    return copy;
  }
  return [...cleaned, { kind: "bubble", role: "assistant", text }];
}

export function applyThinkingDelta(
  feed: FeedItem[],
  text: string,
): FeedItem[] {
  const cleaned = withoutStaleStatus(feed);
  const last = cleaned.at(-1);
  if (last?.kind === "thinking") {
    const copy = cleaned.slice();
    copy[copy.length - 1] = {
      kind: "thinking",
      text: last.text + text,
    };
    return copy;
  }
  return [...cleaned, { kind: "thinking", text }];
}

export function applyToolEvent(
  feed: FeedItem[],
  event: {
    name: string;
    status: "running" | "completed" | "error";
    detail?: string;
  },
): FeedItem[] {
  const cleaned = withoutStaleStatus(feed);
  for (let i = cleaned.length - 1; i >= 0; i--) {
    const row = cleaned[i];
    if (
      row?.kind === "tool" &&
      row.name === event.name &&
      row.status === "running"
    ) {
      const copy = cleaned.slice();
      copy[i] = {
        kind: "tool",
        name: event.name,
        status: event.status,
        ...(event.detail
          ? { detail: event.detail }
          : row.detail
            ? { detail: row.detail }
            : {}),
      };
      return copy;
    }
  }
  return [
    ...cleaned,
    {
      kind: "tool",
      name: event.name,
      status: event.status,
      ...(event.detail ? { detail: event.detail } : {}),
    },
  ];
}

function shortDetail(detail: string): string {
  // Prefer a short path tail so tool lines wrap less in narrow panes.
  if (detail.includes("/") && !detail.includes(" ")) {
    const parts = detail.split("/").filter(Boolean);
    if (parts.length >= 2) {
      return parts.slice(-2).join("/");
    }
  }
  return detail;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Live label for the sticky run strip + footer activity. */
export function activityLabel(
  runStatus: "idle" | "running",
  feed: FeedItem[],
): string {
  if (runStatus !== "running") return "idle";
  for (let i = feed.length - 1; i >= 0; i--) {
    const item = feed[i];
    if (!item) continue;
    if (item.kind === "tool" && item.status === "running") {
      return `tool:${item.name}`;
    }
    if (item.kind === "thinking") return "thinking";
    if (item.kind === "bubble" && item.role === "assistant") return "writing";
    if (item.kind === "status") return item.label.toLowerCase();
  }
  return "working";
}

/** Human line for the sticky spinner strip while a run is active. */
export function liveRunLine(
  runStatus: "idle" | "running",
  feed: FeedItem[],
  tick: number,
): string | null {
  if (runStatus !== "running") return null;
  const spin = spinnerFrame(tick);

  for (let i = feed.length - 1; i >= 0; i--) {
    const item = feed[i];
    if (!item) continue;
    if (item.kind === "tool" && item.status === "running") {
      const detail = item.detail?.trim()
        ? ` — ${clip(shortDetail(item.detail.trim()), 48)}`
        : "";
      return `${spin} Running ${item.name}${detail}`;
    }
    if (item.kind === "thinking") {
      const snippet = item.text.replace(/\s+/g, " ").trim();
      return snippet
        ? `${spin} Thinking — ${clip(snippet, 70)}`
        : `${spin} Thinking…`;
    }
    if (item.kind === "bubble" && item.role === "assistant") {
      return `${spin} Writing…`;
    }
    if (item.kind === "status") {
      return `${spin} ${item.label}`;
    }
  }
  return `${spin} Working…`;
}

/** Drop transient loading/status rows once real work (or the reply) arrives. */
export function withoutStaleStatus(feed: FeedItem[]): FeedItem[] {
  const last = feed.at(-1);
  if (last?.kind === "status") return feed;
  return feed.filter((item) => item.kind !== "status");
}

/** One message block in the stacked transcript. */
export type BubbleRole = "user" | "assistant";

export type Message = {
  role: BubbleRole;
  text: string;
};

/** Lifecycle of one run on a session. */
export type RunStatus = "idle" | "running" | "cancelled" | "finished";

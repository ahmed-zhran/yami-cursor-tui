/**
 * Narrow agent port: send / stream / cancel.
 * Chat talks only to this seam; `createCursorAgent` adapts `@cursor/sdk`.
 */

export type AgentDialogKind = "request" | "question" | "approval";

export type AgentStreamEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "thinking"; text: string }
  | {
      type: "tool";
      name: string;
      status: "running" | "completed" | "error";
      detail?: string;
    }
  | { type: "run_status"; phase: "starting" | "running" | "error"; message?: string }
  | {
      type: "dialog";
      kind: AgentDialogKind;
      id: string;
      title: string;
      prompt?: string;
      options?: { id: string; label: string }[];
    }
  | { type: "usage"; totalTokens: number }
  | { type: "file_edit"; path: string }
  | { type: "finished" }
  | { type: "cancelled" };

export type SendOptions = {
  /** SDK conversation mode for this send. */
  mode?: "agent" | "plan";
};

export type ActiveRun = {
  cancel(): void;
};

export type AgentPort = {
  /**
   * Start a Run. Invokes `onEvent` for streamed assistant text until finished
   * or cancelled. Caller cancels any prior run before send when Steering.
   */
  send(
    prompt: string,
    onEvent: (event: AgentStreamEvent) => void,
    options?: SendOptions,
  ): ActiveRun;
};

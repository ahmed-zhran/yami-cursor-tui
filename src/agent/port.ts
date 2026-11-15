/**
 * Narrow agent port: send / stream / cancel.
 * Real @cursor/sdk adapter lands in a later ticket; chat talks only to this seam.
 */

export type AgentStreamEvent =
  | { type: "assistant_delta"; text: string }
  | { type: "finished" }
  | { type: "cancelled" };

export type ActiveRun = {
  cancel(): void;
};

export type AgentPort = {
  /**
   * Start a Run. Invokes `onEvent` for streamed assistant text until finished
   * or cancelled. Caller cancels any prior run before send when Steering.
   */
  send(prompt: string, onEvent: (event: AgentStreamEvent) => void): ActiveRun;
};

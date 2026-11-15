import type { ActiveRun, AgentPort, AgentStreamEvent } from "./port.js";

export type CreateMockAgentOptions = {
  /** Full assistant reply for a prompt. Default: echo the prompt. */
  replyFor?: (prompt: string) => string;
  /**
   * Split the reply into streamed pieces. Default: one chunk (the whole reply).
   */
  chunksFor?: (reply: string) => string[];
  /**
   * Delay between chunks in ms. `0` still yields via timers so cancel can win.
   * Use a large value (or fake timers) to keep a Run active for steer/cancel tests.
   */
  chunkDelayMs?: number;
};

/**
 * In-process mock AgentPort that streams canned assistant text.
 * No @cursor/sdk.
 */
export function createMockAgent(
  options: CreateMockAgentOptions = {},
): AgentPort {
  const replyFor = options.replyFor ?? ((prompt: string) => `echo: ${prompt}`);
  const chunksFor = options.chunksFor ?? ((reply: string) => [reply]);
  const chunkDelayMs = options.chunkDelayMs ?? 0;

  let active: { cancel(): void } | null = null;

  return {
    send(prompt: string, onEvent: (event: AgentStreamEvent) => void): ActiveRun {
      active?.cancel();

      const chunks = chunksFor(replyFor(prompt));
      let cancelled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let index = 0;

      const clear = () => {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
      };

      const emit = (event: AgentStreamEvent) => {
        if (cancelled && event.type !== "cancelled") return;
        onEvent(event);
      };

      const scheduleNext = () => {
        if (cancelled) return;
        if (index >= chunks.length) {
          active = null;
          emit({ type: "finished" });
          return;
        }
        timer = setTimeout(() => {
          timer = null;
          if (cancelled) return;
          const piece = chunks[index]!;
          index += 1;
          emit({ type: "assistant_delta", text: piece });
          scheduleNext();
        }, chunkDelayMs);
      };

      const run: ActiveRun = {
        cancel() {
          if (cancelled) return;
          cancelled = true;
          clear();
          if (active === run) active = null;
          emit({ type: "cancelled" });
        },
      };

      active = run;
      scheduleNext();
      return run;
    },
  };
}

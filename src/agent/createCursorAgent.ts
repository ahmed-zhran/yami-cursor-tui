import { Agent } from "@cursor/sdk";
import type { Run, SDKAgent, SDKMessage } from "@cursor/sdk";
import type { ActiveRun, AgentPort, AgentStreamEvent } from "./port.js";

const DEFAULT_MODEL = "composer-2.5";

export type CreateCursorAgentOptions = {
  apiKey: string;
  /** Defaults to `CURSOR_MODEL` or `composer-2.5`. */
  model?: string;
  /** Defaults to `process.cwd()`. */
  cwd?: string;
  /** Injectable for tests; defaults to `Agent.create`. */
  createAgent?: (options: {
    apiKey: string;
    model: { id: string };
    local: { cwd: string };
  }) => Promise<SDKAgent>;
};

/**
 * Real AgentPort backed by `@cursor/sdk` (`Agent.create` + `send` + stream + cancel).
 * shortcut: Session dispose on process exit not wired; upgrade when long-lived hosts care.
 */
export async function createCursorAgent(
  options: CreateCursorAgentOptions,
): Promise<AgentPort> {
  const modelId =
    options.model?.trim() ||
    process.env.CURSOR_MODEL?.trim() ||
    DEFAULT_MODEL;
  const cwd = options.cwd ?? process.cwd();
  const createAgent = options.createAgent ?? Agent.create.bind(Agent);

  const sdkAgent = await createAgent({
    apiKey: options.apiKey,
    model: { id: modelId },
    local: { cwd },
  });

  let opChain: Promise<void> = Promise.resolve();
  let activeRun: Run | null = null;

  return {
    send(prompt: string, onEvent: (event: AgentStreamEvent) => void): ActiveRun {
      let cancelled = false;
      let sdkRun: Run | null = null;
      let emittedTerminal = false;
      let settleCancel: Promise<void> = Promise.resolve();

      const emit = (event: AgentStreamEvent) => {
        if (emittedTerminal && event.type !== "assistant_delta") return;
        if (event.type === "finished" || event.type === "cancelled") {
          emittedTerminal = true;
        }
        onEvent(event);
      };

      const handle: ActiveRun = {
        cancel() {
          if (cancelled || emittedTerminal) return;
          cancelled = true;
          if (sdkRun) {
            const run = sdkRun;
            settleCancel = (async () => {
              await run.cancel().catch(() => undefined);
              await run.wait().catch(() => undefined);
            })();
          }
          emit({ type: "cancelled" });
        },
      };

      opChain = opChain
        .then(async () => {
          if (activeRun) {
            if (activeRun.status === "running") {
              await activeRun.cancel().catch(() => undefined);
            }
            await activeRun.wait().catch(() => undefined);
            activeRun = null;
          }

          if (cancelled) return;

          sdkRun = await sdkAgent.send(prompt);
          activeRun = sdkRun;

          if (cancelled) {
            await sdkRun.cancel().catch(() => undefined);
            await sdkRun.wait().catch(() => undefined);
            if (activeRun === sdkRun) activeRun = null;
            return;
          }

          try {
            for await (const event of sdkRun.stream()) {
              if (cancelled) break;
              emitAssistantDeltas(event, emit);
            }

            if (cancelled) {
              await settleCancel;
              return;
            }

            const result = await sdkRun.wait();
            if (cancelled || emittedTerminal) return;
            if (result.status === "cancelled") {
              emit({ type: "cancelled" });
            } else {
              // error and finished both end the Run for the TUI.
              emit({ type: "finished" });
            }
          } catch {
            if (!cancelled && !emittedTerminal) {
              emit({ type: "finished" });
            }
          } finally {
            if (activeRun === sdkRun) activeRun = null;
          }
        })
        .catch(() => {
          // Keep the chain alive after a failed run so later sends still work.
          if (!cancelled && !emittedTerminal) {
            emit({ type: "finished" });
          }
        });

      return handle;
    },
  };
}

function emitAssistantDeltas(
  event: SDKMessage,
  emit: (event: AgentStreamEvent) => void,
): void {
  if (event.type !== "assistant") return;
  for (const block of event.message.content) {
    if (block.type === "text" && block.text) {
      emit({ type: "assistant_delta", text: block.text });
    }
  }
}

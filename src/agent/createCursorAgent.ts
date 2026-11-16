import { Agent } from "@cursor/sdk";
import type { Run, SDKAgent, SDKMessage } from "@cursor/sdk";
import type {
  ActiveRun,
  AgentPort,
  AgentStreamEvent,
  SendOptions,
} from "./port.js";

/** Auto routes around per-model usage caps; override with `CURSOR_MODEL`. */
const DEFAULT_MODEL = "auto";

const EDIT_TOOL_NAMES = new Set([
  "write",
  "streplace",
  "edit",
  "deletem",
  "delete",
  "applyagentdiff",
]);

export type CreateCursorAgentOptions = {
  apiKey: string;
  /** Defaults to `CURSOR_MODEL` or `auto`. */
  model?: string;
  /** Conversation mode label for chrome; also passed to `Agent.create`. */
  mode?: "agent" | "plan";
  /** Defaults to `process.cwd()`. */
  cwd?: string;
  /** Injectable for tests; defaults to `Agent.create`. */
  createAgent?: (options: {
    apiKey: string;
    model: { id: string };
    mode: "agent" | "plan";
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
  const mode = options.mode ?? "agent";
  const cwd = options.cwd ?? process.cwd();
  const createAgent = options.createAgent ?? Agent.create.bind(Agent);

  const sdkAgent = await createAgent({
    apiKey: options.apiKey,
    model: { id: modelId },
    mode,
    local: { cwd },
  });

  let opChain: Promise<void> = Promise.resolve();
  let activeRun: Run | null = null;

  return {
    send(
      prompt: string,
      onEvent: (event: AgentStreamEvent) => void,
      options?: SendOptions,
    ): ActiveRun {
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

          sdkRun = await sdkAgent.send(
            prompt,
            options?.mode ? { mode: options.mode } : undefined,
          );
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
              emitStreamEvents(event, emit);
            }

            if (cancelled) {
              await settleCancel;
              return;
            }

            const result = await sdkRun.wait();
            if (cancelled || emittedTerminal) return;
            if (result.status === "cancelled") {
              emit({ type: "cancelled" });
            } else if (result.status === "error") {
              const message =
                result.error?.message?.trim() || "Run failed.";
              emit({ type: "assistant_delta", text: `Error: ${message}` });
              emit({ type: "finished" });
            } else {
              emit({ type: "finished" });
            }
          } catch (err) {
            if (!cancelled && !emittedTerminal) {
              const message =
                err instanceof Error && err.message.trim()
                  ? err.message.trim()
                  : "Run failed.";
              emit({ type: "assistant_delta", text: `Error: ${message}` });
              emit({ type: "finished" });
            }
          } finally {
            if (activeRun === sdkRun) activeRun = null;
          }
        })
        .catch((err) => {
          // Keep the chain alive after a failed run so later sends still work.
          if (!cancelled && !emittedTerminal) {
            const message =
              err instanceof Error && err.message.trim()
                ? err.message.trim()
                : "Run failed.";
            emit({ type: "assistant_delta", text: `Error: ${message}` });
            emit({ type: "finished" });
          }
        });

      return handle;
    },
  };
}

function emitStreamEvents(
  event: SDKMessage,
  emit: (event: AgentStreamEvent) => void,
): void {
  if (event.type === "assistant") {
    for (const block of event.message.content) {
      if (block.type === "text" && block.text) {
        emit({ type: "assistant_delta", text: block.text });
      }
    }
    return;
  }

  if (event.type === "thinking") {
    emit({ type: "thinking", text: event.text ?? "" });
    return;
  }

  if (event.type === "status") {
    if (event.status === "CREATING") {
      emit({
        type: "run_status",
        phase: "starting",
        ...(event.message ? { message: event.message } : {}),
      });
    } else if (event.status === "RUNNING") {
      emit({
        type: "run_status",
        phase: "running",
        ...(event.message ? { message: event.message } : {}),
      });
    } else if (event.status === "ERROR") {
      emit({
        type: "run_status",
        phase: "error",
        message: event.message ?? "Run failed.",
      });
    }
    return;
  }

  if (event.type === "tool_call") {
    const detail = toolDetail(event.name, event.args);
    emit({
      type: "tool",
      name: event.name,
      status: event.status,
      ...(detail ? { detail } : {}),
    });
    if (event.status === "running") {
      const question = parseAskQuestion(event.name, event.args);
      if (question) emit({ type: "dialog", ...question });
    }
    if (event.status === "completed") {
      const path = editPathFromTool(event.name, event.args);
      if (path) emit({ type: "file_edit", path });
    }
    return;
  }

  if (event.type === "request") {
    emit({
      type: "dialog",
      kind: "request",
      id: event.request_id,
      title: "Agent needs input",
      prompt: "The run is waiting for a reply.",
      options: [
        { id: "yes", label: "Yes" },
        { id: "no", label: "No" },
      ],
    });
    return;
  }

  if (event.type === "task" && event.text) {
    emit({ type: "thinking", text: event.text });
    return;
  }

  if (event.type === "usage") {
    emit({ type: "usage", totalTokens: event.usage.totalTokens });
  }
}

/** Best-effort parse of AskQuestion tool args into a selectable dialog. */
function parseAskQuestion(
  name: string,
  args: unknown,
): {
  kind: "question";
  id: string;
  title: string;
  prompt?: string;
  options?: { id: string; label: string }[];
} | null {
  const key = name.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (key !== "askquestion" && key !== "ask") return null;
  if (!args || typeof args !== "object") {
    return {
      kind: "question",
      id: `q-${Date.now()}`,
      title: "Question",
      prompt: "The agent asked a question.",
    };
  }
  const record = args as Record<string, unknown>;
  const title =
    (typeof record.title === "string" && record.title.trim()) ||
    (typeof record.prompt === "string" && record.prompt.trim()) ||
    "Question";
  const prompt =
    typeof record.question === "string"
      ? record.question
      : typeof record.prompt === "string"
        ? record.prompt
        : undefined;

  const options: { id: string; label: string }[] = [];
  const rawOptions = record.options ?? record.choices ?? record.answers;
  if (Array.isArray(rawOptions)) {
    for (let i = 0; i < rawOptions.length; i++) {
      const item = rawOptions[i];
      if (typeof item === "string") {
        options.push({ id: String(i), label: item });
      } else if (item && typeof item === "object") {
        const o = item as Record<string, unknown>;
        const label =
          (typeof o.label === "string" && o.label) ||
          (typeof o.text === "string" && o.text) ||
          (typeof o.id === "string" && o.id) ||
          `Option ${i + 1}`;
        const id =
          (typeof o.id === "string" && o.id) || String(i);
        options.push({ id, label });
      }
    }
  }

  // Nested questions[0] shape used by some askQuestion payloads.
  if (options.length === 0 && Array.isArray(record.questions)) {
    const first = record.questions[0];
    if (first && typeof first === "object") {
      return parseAskQuestion(name, first);
    }
  }

  return {
    kind: "question",
    id: `q-${Date.now()}`,
    title,
    ...(prompt ? { prompt } : {}),
    ...(options.length > 0 ? { options } : {}),
  };
}

function editPathFromTool(name: string, args: unknown): string | null {
  const key = name.replace(/[^a-zA-Z]/g, "").toLowerCase();
  if (!EDIT_TOOL_NAMES.has(key)) return null;
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;
  for (const field of ["path", "file_path", "filePath", "target"]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Short tool arg summary for the activity feed (command, path, query…). */
function toolDetail(_name: string, args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const record = args as Record<string, unknown>;
  for (const field of [
    "command",
    "path",
    "file_path",
    "filePath",
    "target",
    "query",
    "pattern",
    "url",
  ]) {
    const value = record[field];
    if (typeof value === "string" && value.trim()) {
      const text = value.trim().replace(/\s+/g, " ");
      return text.length > 80 ? `${text.slice(0, 77)}…` : text;
    }
  }
  return null;
}

import React, { useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ActiveRun, AgentPort } from "../agent/index.js";
import type { Message, RunStatus } from "../shared/index.js";

export type ChatShellProps = {
  agent: AgentPort;
};

/**
 * Stacked Bubbles, bottom prompt, Activity line, steer/cancel keybindings.
 */
export function ChatShell({ agent }: ChatShellProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const draftRef = useRef(draft);
  const runStatusRef = useRef(runStatus);
  const activeRun = useRef<ActiveRun | null>(null);
  const assistantIndex = useRef<number | null>(null);
  const runGeneration = useRef(0);

  draftRef.current = draft;
  runStatusRef.current = runStatus;

  const startRun = (prompt: string) => {
    const generation = ++runGeneration.current;
    setRunStatus("running");
    assistantIndex.current = null;

    const run = agent.send(prompt, (event) => {
      if (generation !== runGeneration.current) return;

      if (event.type === "assistant_delta") {
        setMessages((prev) => {
          const idx = assistantIndex.current;
          if (idx === null) {
            const next = [
              ...prev,
              { role: "assistant" as const, text: event.text },
            ];
            assistantIndex.current = next.length - 1;
            return next;
          }
          const copy = prev.slice();
          const existing = copy[idx];
          if (!existing || existing.role !== "assistant") return prev;
          copy[idx] = { role: "assistant", text: existing.text + event.text };
          return copy;
        });
        return;
      }

      if (event.type === "finished" || event.type === "cancelled") {
        // Do not clear assistantIndex here: finished can arrive in the same
        // turn as the last delta, before React has applied that setMessages.
        activeRun.current = null;
        setRunStatus("idle");
      }
    });

    activeRun.current = run;
  };

  const submit = () => {
    const prompt = draftRef.current.trim();
    if (!prompt) return;

    setDraft("");
    draftRef.current = "";

    if (runStatusRef.current === "running") {
      // Steer: invalidate the active Run's callbacks, cancel it, then send follow-up.
      runGeneration.current += 1;
      activeRun.current?.cancel();
      activeRun.current = null;
    }

    setMessages((prev) => [...prev, { role: "user", text: prompt }]);
    startRun(prompt);
  };

  const cancel = () => {
    if (runStatusRef.current !== "running") return;
    activeRun.current?.cancel();
  };

  useInput((input, key) => {
    if (key.escape) {
      cancel();
      return;
    }
    if (key.return) {
      submit();
      return;
    }
    if (key.backspace || key.delete) {
      const next = draftRef.current.slice(0, -1);
      draftRef.current = next;
      setDraft(next);
      return;
    }
    if (key.ctrl || key.meta) return;
    if (input) {
      const next = draftRef.current + input;
      draftRef.current = next;
      setDraft(next);
    }
  });

  const activity = runStatus === "running" ? "working" : "idle";

  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" flexGrow={1}>
        {messages.map((msg, i) => (
          <Box key={`${msg.role}-${i}`}>
            <Text>
              {msg.role === "user" ? "You: " : "Assistant: "}
              {msg.text}
            </Text>
          </Box>
        ))}
      </Box>
      <Box>
        <Text dimColor>{activity}</Text>
      </Box>
      <Box>
        <Text>{"> "}</Text>
        <Text>{draft}</Text>
      </Box>
    </Box>
  );
}

import React from "react";
import type { AgentPort } from "../agent/index.js";
import type { ChatMode } from "../chat/chatMode.js";
import { ChatShell } from "../chat/index.js";

export type AppProps = {
  agent: AgentPort;
  model: string;
  mode?: ChatMode;
  cwd?: string;
};

/**
 * Boot chat against the injected AgentPort (live SDK Session or test mock).
 */
export function App({
  agent,
  model,
  mode = "build",
  cwd = process.cwd(),
}: AppProps) {
  return <ChatShell agent={agent} model={model} mode={mode} cwd={cwd} />;
}

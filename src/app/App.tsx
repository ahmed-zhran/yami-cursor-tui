import React from "react";
import type { AgentPort } from "../agent/index.js";
import { ChatShell } from "../chat/index.js";

export type AppProps = {
  agent: AgentPort;
};

/**
 * Boot chat against the injected AgentPort (live SDK Session or test mock).
 */
export function App({ agent }: AppProps) {
  return <ChatShell agent={agent} />;
}

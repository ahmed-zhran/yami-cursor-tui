import React from "react";
import { createMockAgent } from "../agent/index.js";
import { ChatShell } from "../chat/index.js";

/**
 * Boot chat against the mock agent port.
 * shortcut: real @cursor/sdk session deferred to a later ticket.
 */
export function App() {
  const agent = React.useMemo(() => createMockAgent(), []);
  return <ChatShell agent={agent} />;
}

import React from "react";
import { Box, Text } from "ink";

/**
 * Empty stacked transcript with bottom prompt chrome.
 * Bubbles and input wiring land in later tickets.
 */
export function ChatShell() {
  return (
    <Box flexDirection="column" width="100%" height="100%">
      <Box flexDirection="column" flexGrow={1} />
      <Box>
        <Text dimColor>{"> "}</Text>
        <Text dimColor>
          Type a prompt… (agent not connected)
        </Text>
      </Box>
    </Box>
  );
}

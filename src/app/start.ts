import React from "react";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createCursorAgent } from "../agent/createCursorAgent.js";
import { parseChatMode, toSdkMode } from "../chat/chatMode.js";
import {
  forceTerminalLtr,
  restoreTerminalDirection,
} from "../chat/ltr.js";
import { App } from "./App.js";
import { requireCursorApiKey } from "./requireCursorApiKey.js";

/**
 * Boot the OpenTUI frame after fail-fast auth and Session create.
 */
export function startApp(): void {
  let apiKey: string;
  try {
    apiKey = requireCursorApiKey();
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "CURSOR_API_KEY is required. Set it to your Cursor API key and try again.";
    console.error(message);
    process.exit(1);
    return;
  }

  void boot(apiKey);
}

async function boot(apiKey: string): Promise<void> {
  const model = process.env.CURSOR_MODEL?.trim() || "auto";
  const chatMode = parseChatMode(process.env.CURSOR_MODE);
  try {
    const agent = await createCursorAgent({
      apiKey,
      model,
      mode: toSdkMode(chatMode),
    });
    // Prefer an English locale for this process so host LC_*=ar_* does not
    // set a default RTL base direction for the child TTY.
    if (!process.env.YAMI_KEEP_LOCALE) {
      process.env.LC_ALL = "en_US.UTF-8";
      process.env.LANG = "en_US.UTF-8";
    }

    // Ctrl+C must quit like other agent TUIs (was false and swallowed the key).
    // Mouse stays on so chat text can be selected and copied.
    const renderer = await createCliRenderer({
      exitOnCtrlC: true,
      useMouse: true,
      enableMouseMovement: true,
      backgroundColor: "#07090d",
    });
    // OpenTUI resets the TTY on mount — re-assert LTR character path after.
    forceTerminalLtr();

    const root = createRoot(renderer);
    root.render(
      React.createElement(App, { agent, model, mode: chatMode }),
    );

    let shuttingDown = false;
    const shutdown = async (code = 0) => {
      if (shuttingDown) return;
      shuttingDown = true;
      restoreTerminalDirection();
      try {
        root.unmount();
      } catch {
        // already unmounted by renderer.destroy
      }
      try {
        renderer.destroy();
      } catch {
        // already destroyed
      }
      process.exit(code);
    };

    renderer.on("destroy", () => {
      restoreTerminalDirection();
      if (!shuttingDown) {
        shuttingDown = true;
        process.exit(0);
      }
    });

    process.once("SIGINT", () => {
      void shutdown(0);
    });
    process.once("SIGTERM", () => {
      void shutdown(0);
    });
  } catch (err) {
    restoreTerminalDirection();
    const message =
      err instanceof Error ? err.message : "Failed to create Cursor agent Session.";
    console.error(message);
    process.exit(1);
  }
}

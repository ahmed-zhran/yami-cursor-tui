import React from "react";
import { render } from "ink";
import { createCursorAgent } from "../agent/createCursorAgent.js";
import { App } from "./App.js";
import { requireCursorApiKey } from "./requireCursorApiKey.js";

/**
 * Boot the Ink frame after fail-fast auth and Session create.
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
  const model = process.env.CURSOR_MODEL?.trim();
  try {
    const agent = await createCursorAgent({
      apiKey,
      ...(model ? { model } : {}),
    });
    render(React.createElement(App, { agent }));
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create Cursor agent Session.";
    console.error(message);
    process.exit(1);
  }
}

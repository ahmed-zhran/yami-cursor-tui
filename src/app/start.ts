import React from "react";
import { render } from "ink";
import { App } from "./App.js";

/**
 * Boot the Ink frame.
 * shortcut: CURSOR_API_KEY fail-fast deferred until agent SDK wiring;
 * this ticket's empty shell must launch without a key.
 */
export function startApp(): void {
  render(React.createElement(App));
}

import React from "react";
import { render } from "ink";
import { App } from "./App.js";

export function startApp(): void {
  render(React.createElement(App));
}

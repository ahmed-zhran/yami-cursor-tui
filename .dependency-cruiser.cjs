/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: "agent-may-only-import-shared",
      comment:
        "agent wraps the Cursor SDK and must not depend on Ink UI (app/chat) or anything outside shared.",
      severity: "error",
      from: { path: "^src/agent/" },
      to: {
        path: "^src/(app|chat)/",
      },
    },
    {
      name: "agent-no-ink",
      comment: "agent must not import Ink or React.",
      severity: "error",
      from: { path: "^src/agent/" },
      to: {
        path: "node_modules/(ink|react)(/|$)",
      },
    },
    {
      name: "shared-imports-nothing-from-slices",
      comment: "shared holds thin types only; it must not import app/chat/agent.",
      severity: "error",
      from: { path: "^src/shared/" },
      to: {
        path: "^src/(app|chat|agent)/",
      },
    },
    {
      name: "chat-must-not-import-app",
      comment: "chat owns UI state; app boots and wires — chat does not import app.",
      severity: "error",
      from: { path: "^src/chat/" },
      to: {
        path: "^src/app/",
      },
    },
    {
      name: "no-circular",
      comment: "No dependency cycles across the TUI slices.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
  },
};

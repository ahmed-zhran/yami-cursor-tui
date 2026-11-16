import { formatContextPercent } from "./contextPercent.js";

export type StatusLineInput = {
  pathLabel: string;
  branch: string;
  model: string;
  mode: string;
  contextPct: number;
  filesEdited: number;
  activity: string;
};

/** Single-line Cursor-CLI-like footer chrome. */
export function formatStatusLine(input: StatusLineInput): string {
  const files =
    input.filesEdited === 1
      ? "1 file"
      : `${input.filesEdited} files`;
  return [
    input.pathLabel,
    input.branch,
    input.model,
    formatContextPercent(input.contextPct),
    files,
    input.mode,
    input.activity,
  ].join(" · ");
}

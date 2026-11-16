import { execFileSync } from "node:child_process";

export type WorkspaceMeta = {
  /** Short cwd label (basename or ~-relative). */
  pathLabel: string;
  /** Current git branch, or `detached` / `-`. */
  branch: string;
};

/**
 * Working path for the status bar: home-relative (`~/…`) when possible,
 * otherwise the absolute cwd (not just the basename).
 */
export function formatPathLabel(
  cwd: string,
  home: string = process.env.HOME ?? "",
): string {
  if (home && (cwd === home || cwd.startsWith(`${home}/`))) {
    return cwd === home ? "~" : `~${cwd.slice(home.length)}`;
  }
  return cwd || ".";
}

/** Read git branch for `cwd`; never throws. */
export function readGitBranch(cwd: string): string {
  try {
    const out = execFileSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 1500,
    }).trim();
    return out || "-";
  } catch {
    return "-";
  }
}

export function readWorkspaceMeta(cwd: string = process.cwd()): WorkspaceMeta {
  return {
    pathLabel: formatPathLabel(cwd),
    branch: readGitBranch(cwd),
  };
}

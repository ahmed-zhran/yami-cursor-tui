import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export type SlashCommand = {
  /** Inserted token without leading slash, e.g. `plan`. */
  id: string;
  /** `/plan` */
  label: string;
  description: string;
  kind: "command" | "skill";
  /** If set, selecting runs locally instead of sending to the agent. */
  local?:
    | "clear"
    | "help"
    | "test-dialog"
    | "test-approval"
    | "test-freetext"
    | "test-arabic";
};

const BUILTIN: SlashCommand[] = [
  {
    id: "help",
    label: "/help",
    description: "Show slash commands and skills",
    kind: "command",
    local: "help",
  },
  {
    id: "clear",
    label: "/clear",
    description: "Clear the transcript",
    kind: "command",
    local: "clear",
  },
  {
    id: "test-dialog",
    label: "/test-dialog",
    description: "Open a Yes/No question popup (UI QA)",
    kind: "command",
    local: "test-dialog",
  },
  {
    id: "test-approval",
    label: "/test-approval",
    description: "Open an Approve/Reject popup (UI QA)",
    kind: "command",
    local: "test-approval",
  },
  {
    id: "test-freetext",
    label: "/test-freetext",
    description: "Open a free-text question popup (UI QA)",
    kind: "command",
    local: "test-freetext",
  },
  {
    id: "test-arabic",
    label: "/test-arabic",
    description: "Load Arabic sample into the prompt (UI QA)",
    kind: "command",
    local: "test-arabic",
  },
  {
    id: "plan",
    label: "/plan",
    description: "Ask the agent to plan (read-only tone)",
    kind: "command",
  },
  {
    id: "ask",
    label: "/ask",
    description: "Ask a question without editing",
    kind: "command",
  },
  {
    id: "model",
    label: "/model",
    description: "Show the active model id",
    kind: "command",
    local: "help",
  },
  {
    id: "commands",
    label: "/commands",
    description: "List built-in commands",
    kind: "command",
    local: "help",
  },
];

function skillDirs(cwd: string): string[] {
  const home = homedir();
  return [
    join(cwd, ".agents", "skills"),
    join(cwd, ".cursor", "skills"),
    join(home, ".cursor", "skills"),
    join(home, ".claude", "skills"),
    join(home, ".agents", "skills"),
  ];
}

function readSkillMeta(
  dir: string,
  folder: string,
): { id: string; description: string } | null {
  const skillMd = join(dir, folder, "SKILL.md");
  if (!existsSync(skillMd)) return null;
  let description = `Skill: ${folder}`;
  try {
    const head = readFileSync(skillMd, "utf8").slice(0, 800);
    const desc = head.match(/^description:\s*(.+)$/m);
    if (desc?.[1]) description = desc[1].trim().replace(/^["']|["']$/g, "");
    const name = head.match(/^name:\s*(.+)$/m);
    const id = (name?.[1]?.trim() || folder).replace(/^["']|["']$/g, "");
    return { id, description };
  } catch {
    return { id: folder, description };
  }
}

/** Discover skills once per process (cwd-scoped dirs + user skill homes). */
let cached: SlashCommand[] | null = null;
let cachedCwd: string | null = null;

export function listSlashCommands(cwd: string = process.cwd()): SlashCommand[] {
  if (cached && cachedCwd === cwd) return cached;

  const skills: SlashCommand[] = [];
  const seen = new Set<string>();

  for (const dir of skillDirs(cwd)) {
    if (!existsSync(dir)) continue;
    let entries: string[] = [];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }
    for (const folder of entries) {
      const meta = readSkillMeta(dir, folder);
      if (!meta) continue;
      const id = meta.id.toLowerCase();
      if (seen.has(id)) continue;
      seen.add(id);
      skills.push({
        id,
        label: `/${id}`,
        description: meta.description,
        kind: "skill",
      });
    }
  }

  skills.sort((a, b) => a.id.localeCompare(b.id));
  cached = [...BUILTIN, ...skills];
  cachedCwd = cwd;
  return cached;
}

/** Reset cache (tests). */
export function resetSlashCommandCache(): void {
  cached = null;
  cachedCwd = null;
}

/**
 * If the last line of the draft is a slash token (`/` or `/foo`), return the
 * filter prefix (without slash). Otherwise null.
 */
export function slashFilter(draft: string): string | null {
  const lastLine = draft.split("\n").at(-1) ?? "";
  const match = lastLine.match(/^\/([^\s]*)$/);
  if (!match) return null;
  return match[1] ?? "";
}

/** Filter commands/skills by id prefix (case-insensitive). */
export function filterSlashCommands(
  commands: SlashCommand[],
  prefix: string,
): SlashCommand[] {
  const p = prefix.toLowerCase();
  return commands.filter((c) => c.id.startsWith(p) || c.label.slice(1).startsWith(p));
}

/** Replace the trailing `/prefix` with the chosen command label + space. */
export function applySlashCompletion(draft: string, command: SlashCommand): string {
  const lines = draft.split("\n");
  lines[lines.length - 1] = `${command.label} `;
  return lines.join("\n");
}

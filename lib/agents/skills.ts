import Fuse from "fuse.js";
import { COMMANDS } from "@/components/apps/terminal/commands";
import { WALLPAPERS } from "@/lib/theme/wallpapers";
import type { Skill } from "./types";

/**
 * Skills are the recipes that turn a plain-language task into real actions. A
 * run picks the skill whose triggers best match the task, then interpolates
 * {{variables}} pulled out of the task and out of earlier steps' results.
 */

export const DEFAULT_SKILL_ID = "skill-brief";

const NAMED_COLORS = ["blue", "purple", "green", "orange", "red", "pink", "teal"];

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "task"
  );
}

/** Trailing words people add to a command that are not part of the command. */
const COMMAND_FILLER = /\s+(?:command|commands|please|now|for me|in (?:the )?terminal|on (?:the )?desktop)\s*$/i;

/**
 * Where a command ends and the sentence resumes. "run ls to show me the files"
 * is a request to run `ls`, not to run `ls to show me the files`.
 */
const PROSE_AFTER_COMMAND = new Set([
  "to", "so", "then", "and", "please", "which", "that", "because", "after", "before",
  "for", "from", "with", "show", "me", "my", "us", "it", "its", "this", "these", "those",
  "into", "of", "also", "will", "would", "can", "could", "in",
]);

/** Keeps arguments (flags, paths, quoted text) and drops trailing prose. */
function takeCommandArgs(words: string[]): string[] {
  const args: string[] = [];
  for (const word of words) {
    const bare = /^[a-z]+$/i.test(word);
    if (bare && PROSE_AFTER_COMMAND.has(word.toLowerCase())) break;
    args.push(word);
  }
  return args;
}

/** Verbs that put an app name right after them — the strongest typo signal. */
const APP_VERB =
  /\b(?:open|launch|start|show|focus|close|quit|switch to)\s+(?:(?:the|a|an|my|up|me)\s+)*([a-z0-9.\-]+)/i;

/** Words that follow an app verb but are never an app. */
const NOT_AN_APP = new Set(["the", "a", "an", "my", "up", "me", "it", "this", "that", "some", "new"]);

/**
 * Finds the app a task refers to. An exact mention wins; otherwise the word
 * after an app verb is fuzzy-matched, so "open termial" still means Terminal.
 * Any other word has to match almost exactly, or unrelated prose would conjure
 * up an app nobody asked for.
 */
export function matchAppName(task: string, appNames: string[]): string {
  const lower = task.toLowerCase();
  const exact = appNames.find((name) => lower.includes(name.toLowerCase()));
  if (exact) return exact;

  const fuse = new Fuse(appNames, { threshold: 0.4, includeScore: true });
  const hinted = task.match(APP_VERB)?.[1]?.toLowerCase();
  // A two-letter article would fuzzy-match almost anything, so require a real word.
  if (hinted && hinted.length >= 3 && !NOT_AN_APP.has(hinted)) {
    const [hit] = fuse.search(hinted);
    if (hit) return hit.item;
  }

  let best: { name: string; score: number } | undefined;
  for (const word of lower.split(/[^a-z0-9]+/).filter((w) => w.length >= 5)) {
    const [hit] = fuse.search(word);
    if (hit?.score !== undefined && hit.score <= 0.2 && (!best || hit.score < best.score)) {
      best = { name: hit.item, score: hit.score };
    }
  }
  return best?.name ?? "";
}

/** Pulls a runnable shell command out of a sentence like "run ls command". */
export function extractCommand(task: string): string {
  const quoted = task.match(/`([^`]+)`/)?.[1];
  if (quoted) return quoted.trim();

  const words = task.split(/\s+/);
  const start = words.findIndex((w) => Object.hasOwn(COMMANDS, w.replace(/[^\w-]/g, "").toLowerCase()));
  if (start === -1) {
    const after = task.match(/\b(?:run|exec|execute)\s+(.+)$/i)?.[1];
    return after ? after.replace(/["']/g, "").replace(COMMAND_FILLER, "").trim() : "";
  }
  const [name, ...rest] = words.slice(start);
  return [name, ...takeCommandArgs(rest)]
    .join(" ")
    .replace(/["']/g, "")
    .replace(COMMAND_FILLER, "")
    .trim();
}

/** Pulls the entities a skill's templates can reference out of the raw task text. */
export function extractVars(task: string, appNames: string[], now: number): Record<string, string> {
  const text = task.trim();
  const lower = text.toLowerCase();
  const date = new Date(now);
  const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const topic = text.split(/\s+/).slice(0, 8).join(" ");

  const path = text.match(/(\/[\w .\-]+(?:\/[\w .\-]+)*)/)?.[1] ?? "";
  const quoted = text.match(/["'`]([^"'`]+)["'`]/)?.[1] ?? "";
  const app = matchAppName(text, appNames);
  const theme = ["dark", "light", "auto"].find((mode) => new RegExp(`\\b${mode}\\b`).test(lower)) ?? "";
  const color = NAMED_COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(lower)) ?? "";
  const wallpaper = WALLPAPERS.find((w) => lower.includes(w.id) || lower.includes(w.label.toLowerCase()))?.id ?? "";
  const command = extractCommand(text);

  return {
    task: text,
    topic,
    slug: slugify(topic),
    date: iso,
    time: date.toLocaleTimeString(),
    datetime: date.toLocaleString(),
    path,
    quoted,
    app,
    theme,
    color,
    wallpaper,
    command,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** The word a request opens with is its verb, and the verb is the intent. */
const LEADING_VERB_WEIGHT = 3;

/**
 * How well a skill's triggers fit a request. Every trigger present scores, but
 * one standing where the verb goes scores far higher — "open the terminal" is a
 * request to open something, not a request about the shell.
 */
export function scoreSkill(task: string, skill: Skill): number {
  const lower = task.toLowerCase().trim();
  const firstWord = lower.split(/[^a-z0-9]+/)[0] ?? "";
  let score = 0;
  for (const trigger of skill.triggers) {
    const t = trigger.trim().toLowerCase();
    if (!t) continue;
    if (!new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(lower)) continue;
    score += t === firstWord ? LEADING_VERB_WEIGHT : 1;
  }
  return score;
}

export function matchSkill(task: string, skills: Skill[]): Skill | undefined {
  const candidates = skills.filter((s) => s.enabled);
  if (candidates.length === 0) return undefined;
  let best = candidates[0];
  let bestScore = scoreSkill(task, best);
  for (const skill of candidates.slice(1)) {
    const score = scoreSkill(task, skill);
    if (score > bestScore) {
      best = skill;
      bestScore = score;
    }
  }
  if (bestScore > 0) return best;
  return candidates.find((s) => s.id === DEFAULT_SKILL_ID) ?? candidates[0];
}

/**
 * A task can ask for more than one thing ("open Terminal and run ls"). Clauses
 * are only treated separately when they resolve to *different* skills — so
 * "search for cats and dogs" stays one task.
 */
export function splitClauses(task: string): string[] {
  return task
    .split(/\s*(?:,|;|\bthen\b|\band then\b|\band\b)\s*/i)
    .map((clause) => clause.trim())
    .filter((clause) => clause.length > 2);
}

/**
 * The parts a request breaks into — the whole thing when it is single-minded.
 * Callers that route or interpret clause by clause all start here.
 */
export function toClauses(text: string): string[] {
  const clauses = splitClauses(text);
  return clauses.length >= 2 ? clauses : [text.trim()];
}

export interface PlannedSkill {
  skill: Skill;
  /** The part of the task this skill was chosen for. */
  clause: string;
  vars: Record<string, string>;
}

export interface TaskPlan {
  steps: PlannedSkill[];
  /** Clauses no granted skill could take — surfaced instead of silently dropped. */
  unhandled: string[];
}

/** Resolves a task into the ordered skills that will run it. */
export function planTask(
  task: string,
  skills: Skill[],
  appNames: string[],
  now: number,
  /** Every skill that exists, used only to spot clauses this agent lacks. */
  allSkills: Skill[] = skills
): TaskPlan {
  const baseVars = extractVars(task, appNames, now);
  const whole = matchSkill(task, skills);
  if (!whole) return { steps: [], unhandled: [task] };

  const clauses = splitClauses(task);
  if (clauses.length < 2) return { steps: [{ skill: whole, clause: task, vars: baseVars }], unhandled: [] };

  const steps: PlannedSkill[] = [];
  const unhandled: string[] = [];
  for (const clause of clauses) {
    // Only a positive trigger hit claims a clause; the fallback skill does not.
    const claims = (pool: Skill[]) => pool.filter((s) => s.enabled && scoreSkill(clause, s) > 0);
    const skill = matchSkill(clause, claims(skills));
    if (!skill) {
      // Silent unless some other agent could have taken this clause — otherwise
      // every stray fragment ("…and dogs") would be reported as a gap.
      if (claims(allSkills).length > 0) unhandled.push(clause);
      continue;
    }
    if (steps.some((s) => s.skill.id === skill.id)) continue;
    steps.push({ skill, clause, vars: { ...baseVars, ...extractVars(clause, appNames, now), task } });
  }

  // One skill claimed everything: run it against the whole task, but still say
  // which clause went unserved.
  if (steps.length < 2) return { steps: [{ skill: whole, clause: task, vars: baseVars }], unhandled };
  return { steps, unhandled };
}

/**
 * Same resolution as planTask, minus the clock: timestamps only feed {{date}}
 * and {{time}}, which never affect which skills match. Safe to call in render.
 */
export function previewTask(
  task: string,
  skills: Skill[],
  appNames: string[],
  allSkills: Skill[] = skills
): TaskPlan {
  return planTask(task, skills, appNames, 0, allSkills);
}

const REPORT_DIR = "/Documents/Agent Reports";

export const BUILTIN_SKILLS: Skill[] = [
  {
    id: DEFAULT_SKILL_ID,
    name: "Desktop brief",
    description: "Surveys apps, files, and settings, then files a written brief.",
    iconKey: "scroll",
    triggers: ["brief", "digest", "summary", "summarise", "summarize", "status", "audit", "overview"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "apps.list", params: {} },
      { actionId: "files.list", params: { path: "/Documents" } },
      { actionId: "settings.read", params: {} },
      {
        actionId: "files.write",
        params: {
          path: `${REPORT_DIR}/brief-{{date}}.md`,
          content:
            "# Desktop brief — {{date}}\n\n**Task** — {{task}}\n\n## Apps\nInstalled: {{apps}}\nOpen windows: {{openWindows}}\n\n## Documents\n{{files}}\n\n## Settings\n{{currentAppearance}} appearance · accent {{currentAccent}} · {{currentWallpaper}} wallpaper\n\n_Filed by {{agent}} at {{datetime}}._\n",
        },
      },
    ],
  },
  {
    id: "skill-workspace",
    name: "Open workspace",
    description: "Opens the app named in the task and reports what is on screen.",
    iconKey: "window",
    triggers: ["open", "launch", "start", "show", "window"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "apps.list", params: {} },
      { actionId: "apps.open", params: { app: "{{app}}" } },
      { actionId: "apps.list", params: {} },
    ],
  },
  {
    id: "skill-research",
    name: "Search and file",
    description: "Searches the filesystem for the topic, reads the best hit, and writes it up.",
    iconKey: "search",
    triggers: ["research", "find", "search", "look", "investigate", "report"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "files.search", params: { query: "{{topic}}" } },
      { actionId: "files.read", params: { path: "{{firstMatch}}" }, optional: true },
      {
        actionId: "files.write",
        params: {
          path: `${REPORT_DIR}/{{slug}}.md`,
          content:
            "# {{topic}}\n\n**Task** — {{task}}\n\n## Matches ({{matchCount}})\n{{matches}}\n\n## From {{contentPath}}\n{{content}}\n\n_Filed by {{agent}} at {{datetime}}._\n",
        },
      },
    ],
  },
  {
    id: "skill-annotate",
    name: "Read and annotate",
    description: "Reads the file named in the task and appends a dated note to it.",
    iconKey: "scroll",
    triggers: ["annotate", "append", "note", "update", "edit", "revise"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "files.read", params: { path: "{{path}}" } },
      {
        actionId: "files.append",
        params: { path: "{{path}}", content: "\n---\n{{agent}} · {{datetime}} — {{task}}" },
      },
    ],
  },
  {
    id: "skill-restyle",
    name: "Restyle desktop",
    description: "Applies whichever of appearance, accent, and wallpaper the task mentions.",
    iconKey: "sliders",
    triggers: ["theme", "appearance", "dark", "light", "wallpaper", "accent", "colour", "color", "restyle"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "settings.read", params: {} },
      { actionId: "settings.appearance", params: { mode: "{{theme}}" }, optional: true },
      { actionId: "settings.accent", params: { color: "{{color}}" }, optional: true },
      { actionId: "settings.wallpaper", params: { wallpaper: "{{wallpaper}}" }, optional: true },
      { actionId: "settings.read", params: {} },
    ],
  },
  {
    id: "skill-shell",
    name: "Shell task",
    description: "Runs the command in the task through the Terminal's command set.",
    iconKey: "terminal",
    triggers: ["run", "shell", "command", "ls", "cat", "mkdir", "echo", "pwd"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "shell.run", params: { command: "{{command}}" } },
      {
        actionId: "files.append",
        params: {
          path: `${REPORT_DIR}/shell-log.md`,
          content: "- `{{command}}` at {{datetime}} by {{agent}}\n  ```\n  {{stdout}}\n  ```",
        },
        optional: true,
      },
    ],
  },
  {
    id: "skill-tidy",
    name: "Tidy documents",
    description: "Indexes /Documents into a dated inventory file.",
    iconKey: "folder",
    triggers: ["tidy", "organise", "organize", "index", "inventory", "catalog", "sweep", "clean"],
    builtin: true,
    enabled: true,
    createdAt: 0,
    steps: [
      { actionId: "files.list", params: { path: "/Documents" } },
      { actionId: "files.mkdir", params: { path: REPORT_DIR } },
      {
        actionId: "files.write",
        params: {
          path: `${REPORT_DIR}/inventory-{{date}}.md`,
          content:
            "# /Documents inventory — {{date}}\n\n{{count}} items:\n\n{{files}}\n\n_Filed by {{agent}} at {{datetime}} for task: {{task}}._\n",
        },
      },
    ],
  },
];

import { WALLPAPERS } from "@/lib/theme/wallpapers";
import { extractCommand, matchAppName, toClauses } from "./skills";
import type { SkillStep } from "./types";

/**
 * Direct instruction → actions, without a pre-written recipe.
 *
 * Skills cover the jobs worth naming; this covers everything else. It reads a
 * plain sentence as verb + object + arguments and emits the concrete actions
 * that carry it out, which is what lets one agent do "create a folder called
 * vikash" without anyone having authored a "create folder" skill first.
 *
 * It is a parser, not a model: it understands the verbs below and says so
 * plainly when a sentence falls outside them, rather than guessing.
 */

export interface InterpreterContext {
  appNames: string[];
  /** Facts carried from earlier work, so "in it" has something to mean. */
  vars?: Record<string, string>;
}

const NAME_MARKER =
  /\b(?:named?|called|titled)\s+["'“]?([\w.\-]+(?:\s+[\w.\-]+)*?)["'”]?(?=\s+(?:in|on|at|under|inside|into|to|with|and|then|from|for)\b|[,.!?]|$)/i;
const QUOTED = /["'`“]([^"'`”]+)["'`”]/;
/**
 * A path may contain spaces ("/Documents/Agent Reports/x.md"), but a sentence
 * continues with spaces too — so a segment never starts with a joining word.
 */
const JOINERS = "to|into|as|and|then|with|for|from|in|on|at|please|now";
const PATH = new RegExp(`(\\/[\\w.\\-]+(?:[ /](?!(?:${JOINERS})\\b)[\\w.\\-]+)*)`, "i");
const KNOWN_FOLDERS = ["Documents", "Desktop", "Downloads"];

/** Refers back to whatever the last run touched. */
const PRONOUN = /\b(it|there|that|this|the same|inside)\b/i;

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  a: 1, an: 1, couple: 2, few: 3,
};

const MAX_BATCH = 10;

/** "2", "two", "a couple of" → a count, capped so a typo cannot flood the disk. */
function extractCount(clause: string): number {
  const digits = clause.match(/\b(\d{1,2})\b/)?.[1];
  if (digits) return Math.min(MAX_BATCH, Number(digits));
  const word = clause.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|couple|few)\b/)?.[1];
  return word ? Math.min(MAX_BATCH, NUMBER_WORDS[word]) : 0;
}

const FILLER = new Set([
  "a", "an", "the", "new", "my", "our", "your", "some", "please", "folder", "directory",
  "file", "note", "document", "doc", "for", "me", "us", "in", "into", "on", "at", "to",
  "with", "and", "it", "this", "that", "here", "there", "called", "named", "name",
  "files", "folders", "directories", "notes", "documents", "copies", "them", "add", "create",
]);

function cleanName(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“]|["'”]$/g, "")
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();
}

/** The name a sentence gives its object: quoted, "named X", or the trailing word. */
function extractName(clause: string): string {
  const marked = clause.match(NAME_MARKER)?.[1];
  if (marked) return cleanName(marked);

  const quoted = clause.match(QUOTED)?.[1];
  if (quoted) return cleanName(quoted);

  const words = clause.trim().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i].replace(/[.,!?]$/, "");
    // A path is the destination, and a number is the count — neither is a name.
    if (!word || word.includes("/") || FILLER.has(word.toLowerCase())) continue;
    if (/^\d+$/.test(word) || word.toLowerCase() in NUMBER_WORDS) continue;
    // The first word of a clause is its verb, never the name of the object.
    if (i === 0) break;
    return cleanName(word);
  }
  return "";
}

/** The folder an earlier run left behind, when the sentence points back at it. */
function carriedFolder(clause: string, ctx?: InterpreterContext): string {
  if (!PRONOUN.test(clause)) return "";
  const path = ctx?.vars?.folderPath || ctx?.vars?.path || "";
  // Only a folder can receive things; a file path means the file itself.
  return path && !/\.\w{1,5}$/.test(path) ? path : "";
}

/** Where the sentence wants it: an explicit path, a carried folder, a home folder, or root. */
function targetPath(clause: string, name: string, ctx?: InterpreterContext): string {
  const explicit = clause.match(PATH)?.[1];
  if (explicit) {
    // "/Documents/notes.md" names the thing; "/Documents" names where it goes.
    const named = explicit.split("/").pop() ?? "";
    if (name && named.toLowerCase() !== name.toLowerCase()) return `${explicit.replace(/\/$/, "")}/${name}`;
    return explicit;
  }
  const carried = carriedFolder(clause, ctx);
  if (carried) return name ? `${carried}/${name}` : carried;
  const folder = KNOWN_FOLDERS.find((f) => new RegExp(`\\b${f}\\b`, "i").test(clause));
  const base = folder ? `/${folder}` : "";
  return name ? `${base}/${name}` : base || "/";
}

function contentOf(clause: string): string {
  const said = clause.match(/\b(?:with|containing|that says|saying|content|text)\b[:\s]+(.+)$/i)?.[1];
  if (said) return said.replace(/^["'“]|["'”]$/g, "").trim();
  const quoted = clause.match(QUOTED)?.[1];
  return quoted ?? "";
}

const COLORS = ["blue", "purple", "green", "orange", "red", "pink", "teal"];

function titleCase(text: string): string {
  return text.replace(/\b\w/g, (c) => c.toUpperCase());
}

type Rule = (clause: string, lower: string, ctx: InterpreterContext) => SkillStep[] | null;

const EXPLICIT_RUN = /\b(run|execute|exec)\b/;

const RULES: Rule[] = [
  // ---- an explicit command beats everything that shares its wording ------
  (clause, lower) => {
    if (!EXPLICIT_RUN.test(lower)) return null;
    const command = extractCommand(clause);
    return command ? [{ actionId: "shell.run", params: { command } }] : null;
  },

  // ---- the fleet itself ---------------------------------------------------
  (clause, lower) => {
    if (!/\b(add|create|new|make)\b/.test(lower) || !/\bagents?\b/.test(lower)) return null;
    if (/\bprompt\b/.test(lower)) return null;
    const name = clause.match(/\bfor\s+([\w \-]+?)(?:[,.]|$)/i)?.[1] ?? extractName(clause);
    return name ? [{ actionId: "fleet.createAgent", params: { name: cleanName(name) } }] : null;
  },
  (clause, lower) => {
    if (!/\bprompt\b/.test(lower)) return null;
    if (!/\b(add|set|create|new|update|change|write)\b/.test(lower)) return null;
    // "…for X" is the subject the prompt is about; "…prompt for Agent Y" names an agent.
    const subject = clause.match(/\bfor\s+([\w \-]+?)(?:[,.]|$)/i)?.[1]?.trim() ?? "";
    const quoted = clause.match(QUOTED)?.[1];
    if (quoted) {
      const named = clause.match(/\b(?:for|of|on)\s+(?:the\s+)?([\w \-]+?)\s+agent\b/i)?.[1];
      return [{ actionId: "fleet.setPrompt", params: { prompt: quoted, agent: named ? cleanName(named) : "" } }];
    }
    // No prompt text given, so make an agent for that subject with a starter prompt.
    return subject ? [{ actionId: "fleet.createAgent", params: { name: titleCase(cleanName(subject)) } }] : null;
  },

  // ---- batches: "add 2 files", "create three folders" --------------------
  (clause, lower, ctx) => {
    const count = extractCount(clause);
    if (count < 2) return null;
    if (!/\b(create|make|add|new|write)\b/.test(lower)) return null;
    const folders = /\bfolders?|directories\b/.test(lower);
    if (!folders && !/\bfiles?|notes?|documents?\b/.test(lower)) return null;
    const base = extractName(clause) || (folders ? "folder" : "file");
    const dir = targetPath(clause, "", ctx).replace(/\/$/, "");
    return Array.from({ length: count }, (_, i) => {
      const path = `${dir}/${base}-${i + 1}${folders ? "" : ".md"}`;
      return folders
        ? { actionId: "files.mkdir", params: { path } }
        : { actionId: "files.write", params: { path, content: `# ${base} ${i + 1}\n` } };
    });
  },

  // ---- filesystem, most specific first ----------------------------------
  (clause, lower, ctx) => {
    if (!/\b(create|make|add|new|mkdir)\b/.test(lower) || !/\b(folder|directory|dir)\b/.test(lower)) return null;
    const name = extractName(clause);
    const explicit = clause.match(PATH)?.[1];
    // "…named x" gives a name; "…/Documents/x" gives the whole path.
    if (!name && !explicit) return null;
    return [{ actionId: "files.mkdir", params: { path: name ? targetPath(clause, name, ctx) : explicit! } }];
  },
  (clause, lower, ctx) => {
    if (!/\b(create|make|add|new|write|save)\b/.test(lower)) return null;
    if (!/\b(file|note|document|doc|\.txt|\.md|\.json)\b/.test(lower)) return null;
    const name = extractName(clause);
    const explicit = clause.match(PATH)?.[1];
    if (!name && !explicit) return null;
    const path = name ? targetPath(clause, /\.\w+$/.test(name) ? name : `${name}.md`, ctx) : explicit!;
    return [
      { actionId: "files.write", params: { path, content: contentOf(clause) || `# ${name || path}\n` } },
    ];
  },
  (clause, lower, ctx) => {
    if (!/\b(delete|remove|trash|erase)\b/.test(lower)) return null;
    const name = extractName(clause);
    const path = clause.match(PATH)?.[1] ?? (name ? targetPath(clause, name, ctx) : "");
    return path ? [{ actionId: "files.delete", params: { path } }] : null;
  },
  (clause, lower, ctx) => {
    const match = clause.match(/\b(?:rename|move)\s+(.+?)\s+(?:to|into|as)\s+(.+)$/i);
    if (!match) return null;
    const rawFrom = match[1].trim();
    const rawTo = match[2].trim().replace(/[.!?]$/, "");
    // Either side may be a path or a bare name; paths are never sanitised.
    const from = rawFrom.match(PATH)?.[1] ?? targetPath(clause, cleanName(rawFrom.split(/\s+/).pop() ?? ""), ctx);
    const to = rawTo.match(PATH)?.[1] ?? cleanName(rawTo.split(/\s+/).pop() ?? "");
    if (!from || !to) return null;
    return [{ actionId: "files.move", params: { path: from, to } }];
  },
  (clause, lower) => {
    if (!/\b(append|add)\b/.test(lower) || !/\bto\b/.test(lower)) return null;
    const path = clause.match(PATH)?.[1];
    if (!path) return null;
    return [{ actionId: "files.append", params: { path, content: contentOf(clause) || clause } }];
  },
  (clause, lower) => {
    if (!/\b(read|cat|print|display|show|what.s in)\b/.test(lower)) return null;
    const path = clause.match(PATH)?.[1];
    if (!path) return null;
    return [{ actionId: /\.\w+$/.test(path) ? "files.read" : "files.list", params: { path } }];
  },
  (clause, lower) => {
    if (!/\b(list|show|what)\b/.test(lower)) return null;
    if (!/\b(files?|contents?|folders?|directory|documents?|desktop|downloads?)\b/.test(lower)) return null;
    const folder = KNOWN_FOLDERS.find((f) => new RegExp(`\\b${f}\\b`, "i").test(clause));
    return [{ actionId: "files.list", params: { path: clause.match(PATH)?.[1] ?? (folder ? `/${folder}` : "/") } }];
  },
  (clause, lower) => {
    if (!/\b(search|find|look for|grep|locate)\b/.test(lower)) return null;
    const query = extractName(clause);
    return query ? [{ actionId: "files.search", params: { query } }] : null;
  },

  // ---- apps ---------------------------------------------------------------
  (clause, lower, ctx) => {
    if (!/\b(open|launch|start|show)\b/.test(lower)) return null;
    const app = matchAppName(clause, ctx.appNames);
    return app ? [{ actionId: "apps.open", params: { app } }] : null;
  },
  (clause, lower, ctx) => {
    if (!/\b(close|quit|hide)\b/.test(lower)) return null;
    const app = matchAppName(clause, ctx.appNames);
    return app ? [{ actionId: "apps.close", params: { app } }] : null;
  },
  (clause, lower, ctx) => {
    if (!/\b(focus|switch to|bring up|go to)\b/.test(lower)) return null;
    const app = matchAppName(clause, ctx.appNames);
    return app ? [{ actionId: "apps.focus", params: { app } }] : null;
  },

  // ---- settings -----------------------------------------------------------
  (clause, lower) => {
    const mode = ["dark", "light", "auto"].find((m) => new RegExp(`\\b${m}\\b`).test(lower));
    if (!mode) return null;
    if (!/\b(mode|theme|appearance|switch|set|make|change|turn)\b/.test(lower)) return null;
    return [{ actionId: "settings.appearance", params: { mode } }];
  },
  (clause, lower) => {
    const color = COLORS.find((c) => new RegExp(`\\b${c}\\b`).test(lower));
    if (!color || !/\b(accent|colou?r|highlight)\b/.test(lower)) return null;
    return [{ actionId: "settings.accent", params: { color } }];
  },
  (clause, lower) => {
    if (!/\b(wallpaper|background|desktop picture)\b/.test(lower)) return null;
    const wallpaper = WALLPAPERS.find((w) => lower.includes(w.id) || lower.includes(w.label.toLowerCase()));
    return wallpaper ? [{ actionId: "settings.wallpaper", params: { wallpaper: wallpaper.id } }] : null;
  },
  (clause, lower) => {
    if (!/\bdock\b/.test(lower)) return null;
    const size = clause.match(/\b(\d{2,3})\b/)?.[1];
    return size ? [{ actionId: "settings.dock", params: { size } }] : null;
  },

  // ---- a bare command typed straight in, e.g. "ls /Documents" ------------
  (clause) => {
    const command = extractCommand(clause);
    if (!command || !clause.trim().toLowerCase().startsWith(command.split(" ")[0].toLowerCase())) return null;
    return [{ actionId: "shell.run", params: { command } }];
  },
];

/** Turns one instruction into the actions that carry it out. */
export function interpret(instruction: string, ctx: InterpreterContext): SkillStep[] {
  const steps: SkillStep[] = [];

  for (const clause of toClauses(instruction)) {
    const lower = clause.toLowerCase();
    for (const rule of RULES) {
      const produced = rule(clause, lower, ctx);
      if (produced) {
        steps.push(...produced);
        break;
      }
    }
  }
  return steps;
}

/** True when this agent could carry out the instruction directly. */
export function canInterpret(instruction: string, ctx: InterpreterContext): boolean {
  return interpret(instruction, ctx).length > 0;
}

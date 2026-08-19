import type { AgentDefinition } from "./types";

/** Anthropic list pricing, USD per 1M tokens. Used for the simulated cost meter. */
export interface ModelSpec {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
  /** Relative pace multiplier applied to an agent's average step duration. */
  paceFactor: number;
}

export const MODELS: ModelSpec[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", inputPerMTok: 5, outputPerMTok: 25, paceFactor: 1 },
  { id: "claude-fable-5", label: "Claude Fable 5", inputPerMTok: 10, outputPerMTok: 50, paceFactor: 1.35 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPerMTok: 3, outputPerMTok: 15, paceFactor: 0.7 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerMTok: 1, outputPerMTok: 5, paceFactor: 0.45 },
];

export const DEFAULT_MODEL = MODELS[0].id;

export function getModel(id: string): ModelSpec {
  return MODELS.find((m) => m.id === id) ?? MODELS[0];
}

/** Status hues stay reserved for run state, so agent identity uses this fixed order. */
export const AGENT_COLORS = [
  "#5e9bff",
  "#a78bfa",
  "#f0883e",
  "#2dd4bf",
  "#f472b6",
  "#facc15",
];

const BASE = {
  maxSteps: 8,
  avgStepMs: 1600,
  enabled: true,
  createdAt: 0,
};

const NO_SCHEDULE = { enabled: false, everyMinutes: 30, task: "" };

export const BUILTIN_AGENTS: AgentDefinition[] = [
  {
    ...BASE,
    id: "builtin-researcher",
    name: "Researcher",
    description: "Searches the filesystem for a topic and files what it finds.",
    iconKey: "binoculars",
    color: AGENT_COLORS[0],
    model: "claude-opus-5",
    systemPrompt:
      "You are a research agent. Search before you answer, read the best source you find, and file a written brief.",
    skills: ["skill-research", "skill-brief"],
    schedule: { ...NO_SCHEDULE },
  },
  {
    ...BASE,
    id: "builtin-filekeeper",
    name: "Filekeeper",
    description: "Tidies documents, annotates files, and runs shell chores.",
    iconKey: "folder",
    color: AGENT_COLORS[1],
    model: "claude-opus-5",
    systemPrompt:
      "You look after the filesystem. Inventory before you change anything, and leave a dated note describing what you touched.",
    skills: ["skill-tidy", "skill-annotate", "skill-shell"],
    avgStepMs: 1400,
    schedule: { enabled: false, everyMinutes: 30, task: "Index /Documents into a dated inventory." },
  },
  {
    ...BASE,
    id: "builtin-concierge",
    name: "Concierge",
    description: "Opens apps, arranges the desktop, and restyles the system.",
    iconKey: "window",
    color: AGENT_COLORS[2],
    model: "claude-haiku-4-5",
    systemPrompt:
      "You set up the workspace. Open what the operator asked for, apply only the settings they named, and report the end state.",
    skills: ["skill-workspace", "skill-restyle", "skill-shell", "skill-brief"],
    avgStepMs: 900,
    schedule: { ...NO_SCHEDULE },
  },
  {
    ...BASE,
    id: "builtin-operator",
    name: "Operator",
    description: "Reads an instruction and does it — no recipe required.",
    iconKey: "wrench",
    color: AGENT_COLORS[4],
    model: "claude-opus-5",
    systemPrompt:
      "You are the generalist. Read the instruction literally, do exactly what it says with the smallest set of actions, and report what changed.",
    skills: [],
    planner: "interpreter",
    avgStepMs: 1100,
    schedule: { ...NO_SCHEDULE },
  },
  {
    ...BASE,
    id: "builtin-auditor",
    name: "Auditor",
    description: "Takes a read-only pass over the desktop and writes it up.",
    iconKey: "shield",
    color: AGENT_COLORS[3],
    model: "claude-sonnet-5",
    systemPrompt:
      "You audit the system. Report what is actually there, flag anything surprising, and never change state you were not asked to change.",
    skills: ["skill-brief", "skill-research"],
    avgStepMs: 1200,
    schedule: { ...NO_SCHEDULE },
  },
];

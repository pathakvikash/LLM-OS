import { AGENT_COLORS, BUILTIN_AGENTS, DEFAULT_MODEL } from "@/lib/agents/catalog";
import { DEFAULT_CONNECTORS } from "@/lib/agents/connectors";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/agents/prompt";
import { BUILTIN_SKILLS, DEFAULT_SKILL_ID } from "@/lib/agents/skills";
import type {
  AgentDefinition,
  AgentRun,
  ChatMessage,
  ChatSession,
  Connector,
  Skill,
} from "@/lib/agents/types";

/**
 * Shape and history: how a partial object becomes a complete one, how state
 * written by an older version is repaired, and the ordered upgrades between
 * versions. Kept out of the store so the store is about state and behaviour.
 */

/** The slice of the store that is written to disk. */
export interface PersistedState {
  agents: AgentDefinition[];
  skills: Skill[];
  connectors: Connector[];
  systemPrompt: string;
  sessions: ChatSession[];
  activeSessionId: string | null;
  maxConcurrent: number;
  fleetPaused: boolean;
  runs: AgentRun[];
}

/** …as it may actually arrive: any version, any shape, possibly nothing. */
export type PersistedShape = Partial<PersistedState> & { chat?: ChatMessage[] };

/** Completes a partial agent with the defaults a new one should have. */
export function newAgent(draft: Partial<AgentDefinition>, count: number): AgentDefinition {
  return {
    id: crypto.randomUUID(),
    name: draft.name?.trim() || "New Agent",
    description: draft.description ?? "",
    iconKey: draft.iconKey ?? "sparkles",
    color: draft.color ?? AGENT_COLORS[count % AGENT_COLORS.length],
    model: draft.model ?? DEFAULT_MODEL,
    systemPrompt:
      draft.systemPrompt ?? "You are a capable agent. Finish the task and report what you did.",
    skills: draft.skills ?? [],
    planner: draft.planner ?? "skills",
    maxSteps: draft.maxSteps ?? 8,
    avgStepMs: draft.avgStepMs ?? 1600,
    enabled: draft.enabled ?? true,
    schedule: draft.schedule ?? { enabled: false, everyMinutes: 30, task: "" },
    createdAt: Date.now(),
  };
}

/** Completes a partial skill the same way. */
export function newSkill(draft: Partial<Skill>): Skill {
  return {
    id: crypto.randomUUID(),
    name: draft.name?.trim() || "New skill",
    description: draft.description ?? "",
    iconKey: draft.iconKey ?? "wrench",
    triggers: draft.triggers ?? [],
    steps: draft.steps ?? [],
    enabled: draft.enabled ?? true,
    createdAt: Date.now(),
  };
}

/**
 * Storage written before agents gained skills and connectors holds a different
 * shape (agents had a `tools` list, runs had no skill or action ids). Everything
 * read back from disk goes through these, so a stale profile upgrades instead of
 * crashing the UI.
 */
const LEGACY_AGENT_SKILLS: Record<string, string[]> = {
  "builtin-researcher": ["skill-research", "skill-brief"],
  "builtin-codesmith": ["skill-tidy", "skill-annotate", "skill-shell"],
  "builtin-triage": ["skill-brief", "skill-tidy"],
  "builtin-auditor": ["skill-brief", "skill-research"],
};

function normalizeAgent(raw: Partial<AgentDefinition>, index: number): AgentDefinition {
  const base = newAgent(raw, index);
  return {
    ...base,
    id: raw.id ?? base.id,
    createdAt: raw.createdAt ?? base.createdAt,
    planner: raw.planner ?? "skills",
    skills:
      Array.isArray(raw.skills) && raw.skills.length > 0
        ? raw.skills
        : // A generalist plans from the instruction, so it needs no grant.
          raw.planner === "interpreter"
          ? []
          : (LEGACY_AGENT_SKILLS[raw.id ?? ""] ?? [DEFAULT_SKILL_ID]),
    schedule: {
      enabled: raw.schedule?.enabled ?? false,
      everyMinutes: raw.schedule?.everyMinutes ?? 30,
      task: raw.schedule?.task ?? "",
      lastRunAt: raw.schedule?.lastRunAt,
    },
  };
}

function normalizeSkill(raw: Partial<Skill>): Skill {
  const base = newSkill(raw);
  return {
    ...base,
    id: raw.id ?? base.id,
    createdAt: raw.createdAt ?? base.createdAt,
    builtin: raw.builtin,
    triggers: Array.isArray(raw.triggers) ? raw.triggers : [],
    steps: Array.isArray(raw.steps)
      ? raw.steps.map((step) => ({
          actionId: step?.actionId ?? "files.list",
          params: step?.params ?? {},
          optional: step?.optional,
        }))
      : [],
  };
}

function normalizeConnectors(raw: unknown): Connector[] {
  const persisted = Array.isArray(raw) ? (raw as Partial<Connector>[]) : [];
  // Driven by DEFAULT_CONNECTORS so a newly added connector shows up for everyone.
  return DEFAULT_CONNECTORS.map((fallback) => {
    const found = persisted.find((c) => c?.id === fallback.id);
    return found ? { ...fallback, ...found, id: fallback.id } : fallback;
  });
}

function normalizeRun(raw: Partial<AgentRun> & { steps?: unknown[] }): AgentRun {
  const steps = Array.isArray(raw.steps) ? raw.steps : [];
  return {
    ...(raw as AgentRun),
    skillId: raw.skillId ?? "",
    skillName: raw.skillName ?? "—",
    skillIds: Array.isArray(raw.skillIds) ? raw.skillIds : raw.skillId ? [raw.skillId] : [],
    vars: raw.vars ?? {},
    systemPrompt: raw.systemPrompt ?? "",
    events: Array.isArray(raw.events) ? raw.events : [],
    tokensIn: raw.tokensIn ?? 0,
    tokensOut: raw.tokensOut ?? 0,
    costUsd: raw.costUsd ?? 0,
    steps: steps.map((step) => {
      const s = (step ?? {}) as Partial<AgentRun["steps"][number]> & { tool?: string };
      return {
        id: s.id ?? crypto.randomUUID(),
        name: s.name ?? "Step",
        actionId: s.actionId ?? s.tool ?? "unknown",
        params: s.params ?? {},
        optional: s.optional,
        status: s.status ?? "skipped",
        durationMs: s.durationMs ?? 0,
        startedAt: s.startedAt,
        endedAt: s.endedAt,
        result: s.result,
        error: s.error,
      };
    }),
  };
}

/**
 * Upgrades run in version order, each one small and independent. Adding a
 * version means appending an entry, not editing a growing if-chain — and the
 * ordering can no longer drift out of sequence.
 */
const MIGRATIONS: { to: number; note: string; apply: (state: PersistedShape) => PersistedShape }[] = [
  {
    to: 3,
    note: "built-in agents pick up skills added to the catalogue after they were saved",
    apply: (state) => {
      if (!Array.isArray(state.agents)) return state;
      // User-created agents and extra grants are left alone.
      const agents = state.agents.map((agent) => {
        const builtin = BUILTIN_AGENTS.find((b) => b.id === agent.id);
        return builtin ? { ...agent, skills: [...new Set([...(agent.skills ?? []), ...builtin.skills])] } : agent;
      });
      return { ...state, agents };
    },
  },
  {
    to: 4,
    note: "the single chat log became a list of switchable sessions",
    apply: (state) => {
      const chat = state.chat;
      if (!Array.isArray(chat) || chat.length === 0) return state;
      const first = chat.find((m) => m.role === "user")?.text ?? "Session";
      const stamp = chat.at(-1)?.ts ?? Date.now();
      const session: ChatSession = {
        id: crypto.randomUUID(),
        title: first.length > 40 ? `${first.slice(0, 40)}…` : first,
        createdAt: chat[0]?.ts ?? stamp,
        updatedAt: stamp,
        messages: chat,
      };
      return { ...state, sessions: [session], activeSessionId: session.id };
    },
  },
  {
    to: 5,
    note: "built-in skills re-sync with the catalogue (trigger words drift)",
    apply: (state) => {
      // Triggers and steps are product definitions, not user data — a stored
      // skill with stale triggers silently misroutes work. The enabled switch
      // is the user's, so that is what carries over.
      const saved = Array.isArray(state.skills) ? state.skills : [];
      const refreshed = saved.map((skill) => {
        const builtin = BUILTIN_SKILLS.find((b) => b.id === skill.id);
        return builtin ? { ...builtin, enabled: skill.enabled } : skill;
      });
      const missing = BUILTIN_SKILLS.filter((b) => !refreshed.some((s) => s.id === b.id));
      return { ...state, skills: [...refreshed, ...missing] };
    },
  },
  {
    to: 6,
    note: "new built-in agents join existing profiles",
    apply: (state) => {
      if (!Array.isArray(state.agents)) return state;
      const missing = BUILTIN_AGENTS.filter((b) => !state.agents!.some((a) => a.id === b.id));
      return { ...state, agents: [...state.agents, ...missing] };
    },
  },
];

/** The version a fresh profile is written at. Everything else is repaired by merge(). */
export const STORAGE_VERSION = MIGRATIONS.at(-1)!.to;


/** Applies every upgrade newer than the stored version, in order. */
export function migratePersisted(persisted: unknown, version: number): PersistedShape {
  return MIGRATIONS.filter((step) => version < step.to).reduce(
    (state, step) => step.apply(state),
    persisted as PersistedShape
  );
}

/** Repairs any stored shape into one the app can render. Runs on every load. */
export function mergePersisted<T>(persisted: unknown, current: T): T & PersistedState {
  const saved = (persisted ?? {}) as PersistedShape;
  return {
    ...current,
    ...saved,
    agents:
      Array.isArray(saved.agents) && saved.agents.length > 0
        ? saved.agents.map(normalizeAgent)
        : BUILTIN_AGENTS,
    skills:
      Array.isArray(saved.skills) && saved.skills.length > 0
        ? saved.skills.map(normalizeSkill)
        : BUILTIN_SKILLS,
    connectors: normalizeConnectors(saved.connectors),
    systemPrompt:
      typeof saved.systemPrompt === "string" && saved.systemPrompt.trim()
        ? saved.systemPrompt
        : DEFAULT_SYSTEM_PROMPT,
    runs: Array.isArray(saved.runs) ? saved.runs.map(normalizeRun) : [],
    sessions: Array.isArray(saved.sessions) ? saved.sessions : [],
  } as T & PersistedState;
}

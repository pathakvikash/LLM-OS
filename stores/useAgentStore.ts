"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getAllApps } from "@/lib/apps/registry";
import { BUILTIN_AGENTS } from "@/lib/agents/catalog";
import { DEFAULT_CONNECTORS } from "@/lib/agents/connectors";
import {
  STORAGE_VERSION,
  mergePersisted,
  migratePersisted,
  newAgent,
  newSkill,
} from "@/lib/agents/persistence";
import { cancelRunState, isActive, planRun } from "@/lib/agents/engine";
import { BUILTIN_SKILLS, extractVars, planTask } from "@/lib/agents/skills";
import { interpret } from "@/lib/agents/interpreter";
import { setFleetOps } from "@/lib/agents/fleetOps";
import { isLlmReady } from "@/stores/useLlmStore";
import { DEFAULT_SYSTEM_PROMPT, composeSystemPrompt } from "@/lib/agents/prompt";
import { routeMessage } from "@/lib/agents/orchestrator";
import { converse, stripPleasantries, unknownReply } from "@/lib/agents/conversation";
import { useWindowStore } from "@/stores/useWindowStore";
import type {
  AgentDefinition,
  AgentRun,
  ChatMessage,
  ChatSession,
  Connector,
  PendingApproval,
  Skill,
  TriggerKind,
} from "@/lib/agents/types";

/** In-memory history depth; the persisted slice is trimmed harder (see partialize). */
const MAX_RUNS = 120;
const MAX_CHAT = 60;
const MAX_SESSIONS = 12;
const PERSISTED_RUNS = 40;
const PERSISTED_EVENTS = 60;

interface LaunchOptions {
  agentId: string;
  task: string;
  trigger?: TriggerKind;
  /** Force a specific skill instead of matching the task against the agent's. */
  skillId?: string;
  /** Facts from earlier work, used only where the task itself says nothing. */
  contextVars?: Record<string, string>;
}

interface AgentStoreState {
  agents: AgentDefinition[];
  skills: Skill[];
  connectors: Connector[];
  runs: AgentRun[];
  /** Fleet-wide brief every agent inherits, composed into each run's prompt. */
  systemPrompt: string;
  /** Writes a model wants to make, keyed by run. */
  pendingApprovals: PendingApproval[];
  approvals: Record<string, "approved" | "denied">;

  /** Orchestrator conversations. Replies are rendered from the runs they start. */
  sessions: ChatSession[];
  activeSessionId: string | null;
  maxConcurrent: number;
  /** Master switch: queued runs stop being promoted, running ones finish. */
  fleetPaused: boolean;
  hasHydrated: boolean;

  setHasHydrated: (v: boolean) => void;

  createAgent: (draft: Partial<AgentDefinition>) => string;
  updateAgent: (id: string, patch: Partial<AgentDefinition>) => void;
  deleteAgent: (id: string) => void;
  duplicateAgent: (id: string) => string | null;
  resetAgents: () => void;

  createSkill: (draft: Partial<Skill>) => string;
  updateSkill: (id: string, patch: Partial<Skill>) => void;
  deleteSkill: (id: string) => void;
  duplicateSkill: (id: string) => string | null;
  /** Grants a skill to exactly this set of agents (and revokes it elsewhere). */
  setSkillAgents: (skillId: string, agentIds: string[]) => void;
  resetSkills: () => void;

  setSystemPrompt: (prompt: string) => void;
  resetSystemPrompt: () => void;

  requestApproval: (approval: PendingApproval) => void;
  resolveApproval: (runId: string, decision: "approved" | "denied") => void;
  clearApproval: (runId: string) => void;

  setConnector: (id: string, patch: Partial<Connector>) => void;
  noteConnectorUse: (id: string, ts: number) => void;

  launchRun: (opts: LaunchOptions) => string | null;
  retryRun: (runId: string) => string | null;
  cancelRun: (runId: string) => void;
  cancelActiveRuns: () => void;
  deleteRun: (runId: string) => void;
  clearFinishedRuns: () => void;
  updateRun: (runId: string, updater: (run: AgentRun) => AgentRun) => void;
  /** Batch write used by the runtime tick — one set() per tick. */
  commitRuns: (updated: AgentRun[]) => void;

  /** Routes a message to the right agents and dispatches their runs. */
  sendChatMessage: (text: string) => string[];
  newChatSession: () => string;
  selectChatSession: (id: string) => void;
  renameChatSession: (id: string, title: string) => void;
  deleteChatSession: (id: string) => void;
  clearChat: () => void;

  markScheduleFired: (agentId: string, ts: number) => void;
  setMaxConcurrent: (n: number) => void;
  setFleetPaused: (v: boolean) => void;
}


/**
 * A generalist agent has no recipe: its plan is assembled from the instruction
 * and wrapped as a one-off skill so everything downstream is unchanged.
 */
/** A plan with no steps: the model fills it in as it works. */
function emptyPlan(): Skill {
  return {
    id: "model",
    name: "Model plan",
    description: "Decided by the model as it works.",
    iconKey: "sparkles",
    triggers: [],
    steps: [],
    enabled: true,
    createdAt: 0,
  };
}

function interpretedPlan(task: string, appNames: string[], vars: Record<string, string>) {
  const steps = interpret(task, { appNames, vars });
  if (steps.length === 0) return { steps: [], unhandled: [task] };
  const skill: Skill = {
    id: "interpreted",
    name: "Direct plan",
    description: "Composed from the instruction itself.",
    iconKey: "wrench",
    triggers: [],
    steps,
    enabled: true,
    createdAt: 0,
  };
  return { steps: [{ skill, clause: task, vars }], unhandled: [] };
}


export const useAgentStore = create<AgentStoreState>()(
  persist(
    (set, get) => ({
      agents: BUILTIN_AGENTS,
      skills: BUILTIN_SKILLS,
      connectors: DEFAULT_CONNECTORS,
      runs: [],
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      sessions: [],
      activeSessionId: null,
      pendingApprovals: [],
      approvals: {},
      maxConcurrent: 2,
      fleetPaused: false,
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => set({ hasHydrated }),

      createAgent: (draft) => {
        const agent = newAgent(draft, get().agents.length);
        set((s) => ({ agents: [...s.agents, agent] }));
        return agent.id;
      },

      updateAgent: (id, patch) =>
        set((s) => ({
          agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch, id: a.id } : a)),
        })),

      deleteAgent: (id) => {
        const now = Date.now();
        set((s) => ({
          agents: s.agents.filter((a) => a.id !== id),
          // History survives, but nothing keeps running for an agent that is gone.
          runs: s.runs.map((r) => (r.agentId === id && isActive(r) ? cancelRunState(r, now) : r)),
        }));
      },

      duplicateAgent: (id) => {
        const source = get().agents.find((a) => a.id === id);
        if (!source) return null;
        const copy = newAgent(
          {
            ...source,
            name: `${source.name} copy`,
            schedule: { ...source.schedule, enabled: false },
          },
          get().agents.length
        );
        set((s) => ({ agents: [...s.agents, copy] }));
        return copy.id;
      },

      resetAgents: () => set({ agents: BUILTIN_AGENTS }),

      createSkill: (draft) => {
        const skill = newSkill(draft);
        set((s) => ({ skills: [...s.skills, skill] }));
        return skill.id;
      },

      updateSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((sk) => (sk.id === id ? { ...sk, ...patch, id: sk.id } : sk)),
        })),

      deleteSkill: (id) =>
        set((s) => ({
          skills: s.skills.filter((sk) => sk.id !== id),
          // Agents keep working; they just lose that recipe.
          agents: s.agents.map((a) => ({ ...a, skills: a.skills.filter((sid) => sid !== id) })),
        })),

      duplicateSkill: (id) => {
        const source = get().skills.find((sk) => sk.id === id);
        if (!source) return null;
        const copy = newSkill({
          ...source,
          name: `${source.name} copy`,
          builtin: false,
          steps: source.steps.map((step) => ({ ...step, params: { ...step.params } })),
        });
        set((s) => ({ skills: [...s.skills, copy] }));
        return copy.id;
      },

      setSkillAgents: (skillId, agentIds) =>
        set((s) => ({
          agents: s.agents.map((agent) => {
            const shouldHold = agentIds.includes(agent.id);
            const holds = agent.skills.includes(skillId);
            if (shouldHold === holds) return agent;
            return {
              ...agent,
              skills: shouldHold
                ? [...agent.skills, skillId]
                : agent.skills.filter((id) => id !== skillId),
            };
          }),
        })),

      resetSkills: () => set({ skills: BUILTIN_SKILLS }),

      setSystemPrompt: (systemPrompt) => set({ systemPrompt }),
      resetSystemPrompt: () => set({ systemPrompt: DEFAULT_SYSTEM_PROMPT }),

      requestApproval: (approval) =>
        set((s) => ({
          pendingApprovals: [...s.pendingApprovals.filter((a) => a.runId !== approval.runId), approval],
        })),

      resolveApproval: (runId, decision) =>
        set((s) => ({
          approvals: { ...s.approvals, [runId]: decision },
          pendingApprovals: s.pendingApprovals.filter((a) => a.runId !== runId),
        })),

      clearApproval: (runId) =>
        set((s) => {
          const approvals = { ...s.approvals };
          delete approvals[runId];
          return { approvals, pendingApprovals: s.pendingApprovals.filter((a) => a.runId !== runId) };
        }),

      setConnector: (id, patch) =>
        set((s) => ({
          connectors: s.connectors.map((c) => (c.id === id ? { ...c, ...patch, id: c.id } : c)),
        })),

      noteConnectorUse: (id, ts) =>
        set((s) => ({
          connectors: s.connectors.map((c) =>
            c.id === id ? { ...c, calls: c.calls + 1, lastUsedAt: ts } : c
          ),
        })),

      launchRun: ({ agentId, task, trigger = "manual", skillId, contextVars }) => {
        const { agents, skills, connectors, systemPrompt } = get();
        const agent = agents.find((a) => a.id === agentId);
        if (!agent) return null;

        const now = Date.now();
        const appNames = getAllApps().map((a) => a.name);
        const identity = { agent: agent.name, model: agent.model };
        const granted = skills.filter((s) => agent.skills.includes(s.id));

        // A forced skill (from the Skills tab) skips matching entirely.
        const forced = skillId ? skills.find((s) => s.id === skillId) : undefined;
        // The task always wins; carried-over context only fills the blanks, so
        // "read it" can mean the file the previous run wrote.
        const extracted = extractVars(task, appNames, now);
        const filled = Object.fromEntries(
          Object.entries(extracted).map(([key, value]) => [key, value || contextVars?.[key] || ""])
        );
        const baseVars = { ...contextVars, ...filled, ...identity };
        const plan = forced
          ? { steps: [{ skill: forced, clause: task, vars: baseVars }], unhandled: [] }
          : agent.planner === "interpreter"
            ? interpretedPlan(task, appNames, baseVars)
            : planTask(task, granted, appNames, now, skills);

        // A model decides its own steps, so an empty rule plan is not a dead end
        // when one is configured — it is exactly the case a model is there for.
        const modelWillPlan = isLlmReady();
        if (plan.steps.length === 0 && !modelWillPlan) return null;
        if (plan.steps.length === 0) plan.steps = [{ skill: emptyPlan(), clause: task, vars: baseVars }];

        // Clause-scoped vars still need the agent identity available.
        const planned = plan.steps.map((step) => ({ ...step, vars: { ...step.vars, ...identity } }));
        const prompt = composeSystemPrompt({ fleetPrompt: systemPrompt, agent, skills, connectors, task });
        const run = planRun(agent, planned, task, baseVars, prompt, trigger, now);

        // Say out loud what no granted skill could take, rather than dropping it.
        const withNotes =
          plan.unhandled.length > 0
            ? {
                ...run,
                events: [
                  ...run.events,
                  {
                    id: crypto.randomUUID(),
                    ts: now,
                    level: "plan" as const,
                    message: `No granted skill matched: ${plan.unhandled.join(" · ")}`,
                  },
                ],
              }
            : run;

        set((s) => ({ runs: [withNotes, ...s.runs].slice(0, MAX_RUNS) }));
        return run.id;
      },

      retryRun: (runId) => {
        const previous = get().runs.find((r) => r.id === runId);
        if (!previous) return null;
        return get().launchRun({
          agentId: previous.agentId,
          task: previous.task,
          trigger: "retry",
          skillId: previous.skillId,
        });
      },

      cancelRun: (runId) => {
        const now = Date.now();
        set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? cancelRunState(r, now) : r)) }));
      },

      cancelActiveRuns: () => {
        const now = Date.now();
        set((s) => ({ runs: s.runs.map((r) => (isActive(r) ? cancelRunState(r, now) : r)) }));
      },

      deleteRun: (runId) => set((s) => ({ runs: s.runs.filter((r) => r.id !== runId) })),

      clearFinishedRuns: () => set((s) => ({ runs: s.runs.filter(isActive) })),

      updateRun: (runId, updater) =>
        set((s) => ({ runs: s.runs.map((r) => (r.id === runId ? updater(r) : r)) })),

      commitRuns: (updated) => {
        if (updated.length === 0) return;
        const byId = new Map(updated.map((r) => [r.id, r]));
        set((s) => ({ runs: s.runs.map((r) => byId.get(r.id) ?? r) }));
      },

      sendChatMessage: (text) => {
        const task = text.trim();
        if (!task) return [];
        const { agents, skills, runs } = get();
        const now = Date.now();

        const sessionId = get().activeSessionId ?? get().newChatSession();
        const session = get().sessions.find((s) => s.id === sessionId);
        const message: ChatMessage = { id: crypto.randomUUID(), role: "user", text: task, ts: now };

        const appendToSession = (added: ChatMessage[], title?: string) =>
          set((state) => ({
            sessions: state.sessions.map((s) =>
              s.id === sessionId
                ? {
                    ...s,
                    title: title ?? s.title,
                    updatedAt: now,
                    messages: [...s.messages, ...added].slice(-MAX_CHAT),
                  }
                : s
            ),
          }));

        // A session takes its name from whatever was first asked of it.
        const title =
          session && session.messages.length === 0
            ? task.length > 40 ? `${task.slice(0, 40)}…` : task
            : undefined;

        const context = {
          agents,
          skills,
          connectors: get().connectors,
          runs,
          appNames: getAllApps().map((a) => a.name),
          openWindows: Object.values(useWindowStore.getState().windows).map((w) => w.title),
          now,
        };
        const say = (text: string) =>
          appendToSession([message, { id: crypto.randomUUID(), role: "system", text, ts: now }], title);

        // "hi, open Terminal" is still work; a bare "hi" is conversation.
        const request = stripPleasantries(task);
        // Context carries within a session only: a new session starts clean.
        const sessionRunIds = new Set(session?.messages.flatMap((m) => m.runIds ?? []) ?? []);
        const previous = runs.find(
          (r) => sessionRunIds.has(r.id) && r.outputVars && Object.keys(r.outputVars).length > 0
        );
        const contextVars = previous?.outputVars;

        const routing = routeMessage(request || task, agents, skills, context.appNames, contextVars, isLlmReady());

        if (routing.assignments.length === 0) {
          const reply = converse(task, context);
          say(reply ?? unknownReply(context));
          return [];
        }
        // A pure greeting never reaches an agent, even if a word in it matched.
        if (!request) {
          say(converse(task, context) ?? unknownReply(context));
          return [];
        }

        const runIds: string[] = [];
        for (const assignment of routing.assignments) {
          const id = get().launchRun({ agentId: assignment.agent.id, task: assignment.task, contextVars });
          if (id) runIds.push(id);
        }

        const notes: ChatMessage[] =
          routing.unroutable.length > 0
            ? [
                {
                  id: crypto.randomUUID(),
                  role: "system",
                  ts: now,
                  text: `No agent could take: ${routing.unroutable.join(" · ")}`,
                },
              ]
            : [];

        appendToSession([{ ...message, runIds }, ...notes], title);
        return runIds;
      },

      newChatSession: () => {
        const now = Date.now();
        const session: ChatSession = {
          id: crypto.randomUUID(),
          title: "New session",
          createdAt: now,
          updatedAt: now,
          messages: [],
        };
        set((s) => ({
          sessions: [session, ...s.sessions].slice(0, MAX_SESSIONS),
          activeSessionId: session.id,
        }));
        return session.id;
      },

      selectChatSession: (id) => set({ activeSessionId: id }),

      renameChatSession: (id, title) =>
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === id ? { ...session, title: title.trim() || session.title } : session
          ),
        })),

      deleteChatSession: (id) =>
        set((s) => {
          const sessions = s.sessions.filter((session) => session.id !== id);
          const activeSessionId =
            s.activeSessionId === id ? sessions[0]?.id ?? null : s.activeSessionId;
          return { sessions, activeSessionId };
        }),

      clearChat: () =>
        set((s) => ({
          sessions: s.sessions.map((session) =>
            session.id === s.activeSessionId ? { ...session, messages: [] } : session
          ),
        })),

      markScheduleFired: (agentId, ts) =>
        set((s) => ({
          agents: s.agents.map((a) =>
            a.id === agentId ? { ...a, schedule: { ...a.schedule, lastRunAt: ts } } : a
          ),
        })),

      setMaxConcurrent: (maxConcurrent) =>
        set({ maxConcurrent: Math.max(1, Math.min(8, maxConcurrent)) }),
      setFleetPaused: (fleetPaused) => set({ fleetPaused }),
    }),
    {
      name: "llmos-agents",
      // See MIGRATIONS above for what each version changed.
      version: STORAGE_VERSION,
      migrate: (persisted, version) => migratePersisted(persisted, version) as AgentStoreState,
      merge: (persisted, current) => mergePersisted(persisted, current),
      partialize: (state) => ({
        agents: state.agents,
        skills: state.skills,
        connectors: state.connectors,
        systemPrompt: state.systemPrompt,
        sessions: state.sessions.slice(0, MAX_SESSIONS).map((session) => ({
          ...session,
          messages: session.messages.slice(-MAX_CHAT),
        })),
        activeSessionId: state.activeSessionId,
        maxConcurrent: state.maxConcurrent,
        fleetPaused: state.fleetPaused,
        // Long event logs are the bulk of this store — keep the tail only.
        runs: state.runs.slice(0, PERSISTED_RUNS).map((r) => ({
          ...r,
          events: r.events.slice(-PERSISTED_EVENTS),
        })),
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // A run that was mid-flight when the tab closed has no executor to finish it.
        const now = Date.now();
        state.runs = state.runs.map((r) =>
          isActive(r)
            ? cancelRunState(r, now, "Interrupted — the session ended before this run finished")
            : r
        );
        state.setHasHydrated(true);
      },
    }
  )
);

// Actions reach the fleet through this seam rather than importing the store.
setFleetOps({
  listAgents: () => useAgentStore.getState().agents,
  createAgent: (draft) => useAgentStore.getState().createAgent(draft),
  updateAgent: (id, patch) => useAgentStore.getState().updateAgent(id, patch),
  setFleetPrompt: (prompt) => useAgentStore.getState().setSystemPrompt(prompt),
  getFleetPrompt: () => useAgentStore.getState().systemPrompt,
  delegate: (agentId, task, parentRunId) => {
    const id = useAgentStore.getState().launchRun({ agentId, task });
    if (id && parentRunId) useAgentStore.getState().updateRun(id, (run) => ({ ...run, parentRunId }));
    return id;
  },
});

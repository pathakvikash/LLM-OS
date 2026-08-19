import { canInterpret } from "./interpreter";
import { scoreSkill, toClauses } from "./skills";
import type { AgentDefinition, Skill } from "./types";

/**
 * Routes a chat message to the agents that can actually carry it out. A message
 * asking for two things is split, each part is given to the agent whose granted
 * skills match it best, and consecutive parts for the same agent are rejoined so
 * that agent plans them as one run.
 */

export interface Assignment {
  agent: AgentDefinition;
  /** The part of the message this agent was handed. */
  task: string;
  skill: Skill;
}

export interface Routing {
  assignments: Assignment[];
  /** Parts no enabled agent could take. */
  unroutable: string[];
}

interface Candidate {
  agent: AgentDefinition;
  skill: Skill;
  score: number;
}

function bestAgentFor(
  clause: string,
  agents: AgentDefinition[],
  skills: Skill[],
  /** The agent that took the previous clause; keeps a conversation coherent. */
  preferredAgentId?: string
): Candidate | null {
  let best: Candidate | null = null;
  for (const agent of agents) {
    for (const skill of skills) {
      if (!skill.enabled || !agent.skills.includes(skill.id)) continue;
      const score = scoreSkill(clause, skill);
      if (score <= 0) continue;
      if (!best || score > best.score) {
        best = { agent, skill, score };
        continue;
      }
      if (score < best.score) continue;
      // Equal match: stay with the agent already working, else prefer the more
      // specialised one (fewer skills).
      const staying = agent.id === preferredAgentId && best.agent.id !== preferredAgentId;
      const specialised = agent.skills.length < best.agent.skills.length && best.agent.id !== preferredAgentId;
      if (staying || specialised) best = { agent, skill, score };
    }
  }
  return best;
}

/** A skill-shaped stand-in so a generalist assignment reads like any other. */
const DIRECT_SKILL: Skill = {
  id: "interpreted",
  name: "Direct plan",
  description: "Composed from the instruction itself.",
  iconKey: "wrench",
  triggers: [],
  steps: [],
  enabled: true,
  createdAt: 0,
};

export function routeMessage(
  message: string,
  agents: AgentDefinition[],
  skills: Skill[],
  /** Installed app names, so a generalist can tell whether it could act. */
  appNames: string[] = [],
  /** Facts from earlier runs, so "in it" counts as something a generalist can do. */
  contextVars?: Record<string, string>,
  /** With a model configured a generalist can attempt anything, not only what the rules parse. */
  modelAvailable = false
): Routing {
  const enabled = agents.filter((a) => a.enabled);
  if (enabled.length === 0) return { assignments: [], unroutable: [message] };

  const assignments: Assignment[] = [];
  const unroutable: string[] = [];

  const generalists = enabled.filter((a) => a.planner === "interpreter");

  for (const clause of toClauses(message)) {
    const candidate = bestAgentFor(clause, enabled, skills, assignments.at(-1)?.agent.id);
    if (!candidate) {
      // No recipe fits — hand it to a generalist if one can actually do it.
      const generalist = generalists.find(() => modelAvailable || canInterpret(clause, { appNames, vars: contextVars }));
      if (generalist) {
        const previous = assignments.at(-1);
        if (previous && previous.agent.id === generalist.id) previous.task = `${previous.task} and ${clause}`;
        else assignments.push({ agent: generalist, task: clause, skill: DIRECT_SKILL });
        continue;
      }
      unroutable.push(clause);
      continue;
    }
    const previous = assignments.at(-1);
    // Consecutive parts for one agent become a single run, so it plans them together.
    if (previous && previous.agent.id === candidate.agent.id) {
      previous.task = `${previous.task} and ${clause}`;
      continue;
    }
    assignments.push({ agent: candidate.agent, task: clause, skill: candidate.skill });
  }

  // Nothing matched clause by clause — try the message as a whole before giving up.
  if (assignments.length === 0) {
    const whole = bestAgentFor(message, enabled, skills);
    if (whole) return { assignments: [{ agent: whole.agent, task: message.trim(), skill: whole.skill }], unroutable: [] };
    const generalist = generalists.find(() => modelAvailable || canInterpret(message, { appNames, vars: contextVars }));
    if (generalist) {
      return { assignments: [{ agent: generalist, task: message.trim(), skill: DIRECT_SKILL }], unroutable: [] };
    }
  }
  return { assignments, unroutable };
}



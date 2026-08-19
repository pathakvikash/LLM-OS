import { CONNECTOR_SPECS } from "./connectors";
import type { AgentDefinition, Connector, Skill } from "./types";

/**
 * The fleet brief every agent inherits. It is composed with the agent's own
 * prompt, its granted skills, and the access its connectors currently allow, so
 * the prompt attached to a run is a faithful record of what the agent was told
 * and what it was permitted to do at that moment.
 */
export const DEFAULT_SYSTEM_PROMPT = `You are an agent running inside LLM-OS, a desktop environment in the browser.

- Work on the operator's machine directly: read and write the virtual filesystem, open and arrange app windows, and change system settings.
- Take the smallest action that completes the task. Do not change state the operator did not ask about.
- Prefer reading before writing. Leave a dated note or report describing what you touched.
- If a connector denies you, stop and say which one and what access you needed.`;

const FLEET_HEADING = "## Fleet brief";
const AGENT_HEADING = "\n## Agent — ";

/**
 * Splits a composed prompt back into the part every agent inherits and the part
 * that belongs to this one. The UI shows the fleet brief where it is edited and
 * nowhere else, so nobody mistakes a copy of it for the agent's own prompt.
 */
export function splitComposedPrompt(prompt: string): { fleet: string; agent: string } {
  const index = prompt.indexOf(AGENT_HEADING);
  if (!prompt.startsWith(FLEET_HEADING) || index === -1) return { fleet: "", agent: prompt.trim() };
  return {
    fleet: prompt.slice(FLEET_HEADING.length, index).trim(),
    agent: prompt.slice(index + 1).trim(),
  };
}

export interface PromptContext {
  fleetPrompt: string;
  agent: AgentDefinition;
  skills: Skill[];
  connectors: Connector[];
  task?: string;
}

function accessLine(connectors: Connector[]): string[] {
  return CONNECTOR_SPECS.map((spec) => {
    const state = connectors.find((c) => c.id === spec.id);
    const access = !state?.connected ? "denied" : state.allowWrite ? "read + write" : "read only";
    return `- ${spec.label}: ${access}`;
  });
}

export function composeSystemPrompt({ fleetPrompt, agent, skills, connectors, task }: PromptContext): string {
  const granted = skills.filter((s) => agent.skills.includes(s.id));
  return [
    "## Fleet brief",
    fleetPrompt.trim() || DEFAULT_SYSTEM_PROMPT,
    "",
    `## Agent — ${agent.name}`,
    agent.systemPrompt.trim() || "(no agent-specific instructions)",
    "",
    "## Skills granted",
    ...(granted.length > 0
      ? granted.map((s) => `- ${s.name}: ${s.description} (triggers: ${s.triggers.join(", ") || "none"})`)
      : ["- none"]),
    "",
    "## Connector access",
    ...accessLine(connectors),
    ...(task ? ["", "## Task", task] : []),
  ].join("\n");
}

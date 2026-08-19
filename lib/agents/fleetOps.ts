import type { AgentDefinition } from "./types";

/**
 * A seam so actions can change the fleet without importing the store that owns
 * them (agents → engine → actions → store would be a cycle). The store fills
 * this in when it is created.
 */
export interface FleetOps {
  listAgents: () => AgentDefinition[];
  createAgent: (draft: Partial<AgentDefinition>) => string;
  updateAgent: (id: string, patch: Partial<AgentDefinition>) => void;
  setFleetPrompt: (prompt: string) => void;
  getFleetPrompt: () => string;
  /** Starts a run on another agent; returns its id. */
  delegate: (agentId: string, task: string, parentRunId?: string) => string | null;
}

let ops: FleetOps | null = null;

export function setFleetOps(next: FleetOps) {
  ops = next;
}

export function fleetOps(): FleetOps {
  if (!ops) throw new Error("The agent fleet is not ready yet");
  return ops;
}

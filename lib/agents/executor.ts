"use client";

import { useAgentStore } from "@/stores/useAgentStore";
import { getAction } from "./actions";
import { getConnectorSpec } from "./connectors";
import {
  completeStep,
  event,
  failRun,
  finishRun,
  skipStep,
  startStep,
  stepDwell,
} from "./engine";
import { renderTemplate } from "./skills";
import { executeModelRun } from "./modelRunner";
import { isLlmReady } from "@/stores/useLlmStore";
import type { AgentRun } from "./types";

/**
 * Walks a run's plan and performs each step for real. Between every step it
 * re-reads the store, so cancelling a run, revoking a connector, or deleting
 * the run stops the work at the next boundary.
 */

const MAX_DETAILS = 6;

/**
 * What a finished run hands to the next one. Keeping it to a few concrete facts
 * is what lets a follow-up message say "read it" and mean the file just written.
 */
function collectOutputVars(vars: Record<string, string>): Record<string, string> {
  const carried: Record<string, string> = {};
  const keys = ["writtenPath", "contentPath", "folderPath", "firstMatch", "openedApp", "stdout"];
  for (const key of keys) {
    if (vars[key]) carried[key] = key === "stdout" ? vars[key].slice(0, 400) : vars[key];
  }
  const path = vars.writtenPath || vars.contentPath || vars.firstMatch || vars.folderPath;
  if (path) carried.path = path;
  if (vars.openedApp) carried.app = vars.openedApp;
  return carried;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function currentRun(runId: string): AgentRun | undefined {
  return useAgentStore.getState().runs.find((r) => r.id === runId);
}

function stillRunning(runId: string): boolean {
  return currentRun(runId)?.status === "running";
}

function update(runId: string, updater: (run: AgentRun) => AgentRun) {
  useAgentStore.getState().updateRun(runId, updater);
}

/** Connector gate: an action only fires if its connector is on and wide enough. */
function permissionError(connectorId: string, scope: "read" | "write"): string | null {
  const label = getConnectorSpec(connectorId)?.label ?? connectorId;
  const connector = useAgentStore.getState().connectors.find((c) => c.id === connectorId);
  if (!connector || !connector.connected) {
    return `the ${label} connector is disconnected — connect it in the Connectors tab`;
  }
  if (scope === "write" && !connector.allowWrite) {
    return `the ${label} connector is read-only — allow writes in the Connectors tab`;
  }
  return null;
}

/**
 * How a step that cannot proceed is settled. An optional step steps aside; a
 * required one ends the run. Both messages are given at the call site because
 * a skip explains what was absent while a failure explains what went wrong.
 */
type Blocked = { skip: string; fail: string };

export async function executeRun(runId: string): Promise<void> {
  const start = currentRun(runId);
  if (!start) return;
  const agent = useAgentStore.getState().agents.find((a) => a.id === start.agentId);
  if (!agent) {
    update(runId, (run) => failRun(run, 0, "the agent that owns this run no longer exists", Date.now()));
    return;
  }

  // With a key configured the model decides the steps; without one — or if the
  // call fails for any reason — the pre-planned rule steps run instead.
  if (isLlmReady()) {
    const outcome = await executeModelRun(runId, agent);
    if (outcome.ok) return;
    update(runId, (run) => ({
      ...run,
      events: [
        ...run.events,
        event("system", `Model unavailable (${outcome.fallbackReason}) — planning with rules`, Date.now()),
      ],
    }));
  }

  const vars: Record<string, string> = { ...start.vars, agent: agent.name, model: agent.model };
  const details: string[] = [];

  for (let index = 0; index < start.steps.length; index++) {
    if (!stillRunning(runId)) return;

    const step = currentRun(runId)!.steps[index];
    const dwell = stepDwell(agent);
    update(runId, (run) => startStep(run, index, dwell, Date.now()));
    await sleep(dwell);
    if (!stillRunning(runId)) return;

    const action = getAction(step.actionId);
    if (!action) {
      update(runId, (run) => failRun(run, index, `no such action: ${step.actionId}`, Date.now()));
      return;
    }

    // Step overrides carry the clause this step was planned for; run vars carry
    // everything earlier steps produced.
    const scope = { ...vars, ...(step.varOverrides ?? {}) };
    const params = Object.fromEntries(
      Object.entries(step.params).map(([key, value]) => [key, renderTemplate(value, scope)])
    );
    /** Applies the skip-or-fail rule once, and reports whether the run goes on. */
    const settle = ({ skip, fail }: Blocked): "continue" | "stop" => {
      const now = Date.now();
      update(runId, (run) =>
        step.optional ? skipStep(run, index, skip, now) : failRun(run, index, fail, now)
      );
      return step.optional ? "continue" : "stop";
    };

    const missing = action.params.filter((spec) => !spec.optional && !params[spec.name]?.trim());
    if (missing.length > 0) {
      const names = missing.map((spec) => spec.name).join(", ");
      const detail = missing
        .map((spec) => `${spec.name} (${step.params[spec.name] || "empty"} resolved to nothing)`)
        .join(", ");
      if (settle({ skip: `nothing in the task set ${names}`, fail: `missing input: ${detail}` }) === "stop") return;
      continue;
    }

    // scopeFor lets an action ask for less than it declares (a read-only `ls`).
    const scopeNeeded = action.scopeFor?.(params) ?? action.scope;
    const denied = permissionError(action.connectorId, scopeNeeded);
    if (denied) {
      if (settle({ skip: denied, fail: denied }) === "stop") return;
      continue;
    }

    try {
      const result = await action.run(params, { agentName: agent.name, runId });
      useAgentStore.getState().noteConnectorUse(action.connectorId, Date.now());
      Object.assign(vars, result.vars ?? {});
      if (result.detail && details.length < MAX_DETAILS) {
        details.push(`### ${step.name}\n${result.detail}`);
      }
      if (!stillRunning(runId)) return;
      update(runId, (run) => completeStep(run, index, result, Date.now()));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (settle({ skip: message, fail: message }) === "stop") return;
    }
  }

  if (!stillRunning(runId)) return;
  update(runId, (run) => finishRun(run, details, collectOutputVars(vars), Date.now()));
}

/** Used by the runtime when an agent has no skill that can take the task. */
export function rejectRun(runId: string, reason: string) {
  update(runId, (run) => ({
    ...run,
    status: "failed",
    endedAt: Date.now(),
    error: reason,
    events: [...run.events, event("error", reason, Date.now())],
  }));
}

"use client";

import { useAgentStore } from "@/stores/useAgentStore";
import { beginRun, isActive } from "./engine";
import { executeRun } from "./executor";

/**
 * OS-level scheduler for the agent fleet. It runs for as long as the desktop is
 * open — not just while the Agents window is — so queued work keeps draining and
 * scheduled agents keep firing in the background.
 */

const TICK_MS = 400;

let timer: ReturnType<typeof setInterval> | null = null;
/** Runs whose executor is mid-flight, so a tick never starts one twice. */
const inFlight = new Set<string>();

export function startAgentRuntime() {
  if (timer !== null || typeof window === "undefined") return;
  timer = setInterval(tick, TICK_MS);
}

export function stopAgentRuntime() {
  if (timer === null) return;
  clearInterval(timer);
  timer = null;
}

function fireDueSchedules(now: number) {
  const { agents, runs, fleetPaused } = useAgentStore.getState();
  if (fleetPaused) return;

  for (const agent of agents) {
    const { enabled, everyMinutes, task, lastRunAt } = agent.schedule;
    if (!agent.enabled || !enabled || !task.trim()) continue;
    // An unfired schedule is due immediately, so enabling one shows up at once.
    if (lastRunAt !== undefined && now < lastRunAt + everyMinutes * 60_000) continue;

    useAgentStore.getState().markScheduleFired(agent.id, now);
    // Never stack a scheduled run on top of one that is still going.
    const busy = runs.some((r) => r.agentId === agent.id && isActive(r));
    if (!busy) {
      useAgentStore.getState().launchRun({ agentId: agent.id, task, trigger: "schedule" });
    }
  }
}

function tick() {
  const initial = useAgentStore.getState();
  if (!initial.hasHydrated) return;

  const now = Date.now();
  fireDueSchedules(now);

  const { runs, agents, maxConcurrent, fleetPaused } = useAgentStore.getState();
  if (fleetPaused) return;

  const agentById = new Map(agents.map((a) => [a.id, a]));
  let slotsUsed = runs.filter((r) => r.status === "running").length;

  // runs is newest-first; queued work drains oldest-first.
  for (let i = runs.length - 1; i >= 0 && slotsUsed < maxConcurrent; i--) {
    const run = runs[i];
    if (run.status !== "queued" || inFlight.has(run.id)) continue;
    const agent = agentById.get(run.agentId);
    if (!agent || !agent.enabled) continue;

    useAgentStore.getState().updateRun(run.id, (r) => beginRun(r, agent, now));
    slotsUsed++;
    inFlight.add(run.id);
    // Each run gets its own async walk through its plan; the tick only starts them.
    void executeRun(run.id).finally(() => inFlight.delete(run.id));
  }
}

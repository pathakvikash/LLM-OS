import { getAction } from "./actions";
import { getModel } from "./catalog";
import { renderTemplate, type PlannedSkill } from "./skills";
import type { AgentDefinition, AgentRun, RunEvent, RunStep, TriggerKind } from "./types";

/**
 * Run state transitions. Planning and bookkeeping live here as pure functions;
 * the side effects (real filesystem, window, and settings calls) happen in
 * executor.ts, which drives these transitions.
 */

export const MAX_EVENTS_PER_RUN = 240;

export function event(level: RunEvent["level"], message: string, ts: number): RunEvent {
  return { id: crypto.randomUUID(), ts, level, message };
}

export function appendEvents(run: AgentRun, events: RunEvent[]): RunEvent[] {
  const next = [...run.events, ...events];
  return next.length > MAX_EVENTS_PER_RUN ? next.slice(next.length - MAX_EVENTS_PER_RUN) : next;
}

/** A short human-readable handle for the task, used in narration. */
export function taskTopic(task: string): string {
  const clean = task.replace(/\s+/g, " ").trim();
  const words = clean.split(" ").slice(0, 6).join(" ");
  return words.length > 46 ? `${words.slice(0, 46)}…` : words || "the assigned task";
}

function planSteps(agent: AgentDefinition, plan: PlannedSkill[]): RunStep[] {
  const chained = plan.length > 1;
  const steps = plan.flatMap(({ skill, vars }) =>
    skill.steps.map((step) => {
      const action = getAction(step.actionId);
      // Params keep their templates: later steps interpolate results from earlier ones.
      const preview = Object.fromEntries(
        Object.entries(step.params).map(([key, value]) => [key, renderTemplate(value, vars)])
      );
      return {
        id: crypto.randomUUID(),
        name: action ? action.describe(preview) : `Unknown action ${step.actionId}`,
        actionId: step.actionId,
        params: step.params,
        optional: step.optional,
        // Each clause keeps its own app/command/path, so a later clause cannot
        // overwrite what an earlier one was asked to do.
        varOverrides: chained ? vars : undefined,
        status: "pending" as const,
        durationMs: 0,
      };
    })
  );
  return steps.slice(0, agent.maxSteps);
}

export function planRun(
  agent: AgentDefinition,
  plan: PlannedSkill[],
  task: string,
  vars: Record<string, string>,
  systemPrompt: string,
  trigger: TriggerKind,
  now: number
): AgentRun {
  const steps = planSteps(agent, plan);
  const skillName = plan.map((p) => p.skill.name).join(" → ");
  return {
    id: crypto.randomUUID(),
    agentId: agent.id,
    agentName: agent.name,
    agentColor: agent.color,
    agentIconKey: agent.iconKey,
    model: agent.model,
    task: task.trim(),
    skillId: plan[0].skill.id,
    skillName,
    skillIds: plan.map((p) => p.skill.id),
    vars,
    systemPrompt,
    status: "queued",
    trigger,
    createdAt: now,
    steps,
    events: [
      event("system", `Queued by ${trigger} trigger · skill "${skillName}" · ${steps.length} steps`, now),
    ],
    tokensIn: 0,
    tokensOut: 0,
    costUsd: 0,
  };
}

export function beginRun(run: AgentRun, agent: AgentDefinition, now: number): AgentRun {
  return {
    ...run,
    status: "running",
    startedAt: now,
    events: appendEvents(run, [
      event("system", `Started on ${agent.model} · skill "${run.skillName}"`, now),
      event("plan", `Brief loaded — ${run.systemPrompt.length} chars`, now),
    ]),
  };
}

/** How long the agent "thinks" before firing a step, from its configured pace. */
export function stepDwell(agent: AgentDefinition): number {
  const pace = getModel(agent.model).paceFactor;
  return Math.round(agent.avgStepMs * pace * (0.75 + Math.random() * 0.5));
}

/**
 * Token and cost figures are estimates for the planning the agent would have
 * done — the actions themselves are real, but no model is called.
 */
export function estimateStepUsage(run: AgentRun): Pick<AgentRun, "tokensIn" | "tokensOut" | "costUsd"> {
  const model = getModel(run.model);
  const tokensIn = 600 + Math.round(Math.random() * 2600);
  const tokensOut = 150 + Math.round(Math.random() * 900);
  return {
    tokensIn: run.tokensIn + tokensIn,
    tokensOut: run.tokensOut + tokensOut,
    costUsd:
      run.costUsd + (tokensIn / 1_000_000) * model.inputPerMTok + (tokensOut / 1_000_000) * model.outputPerMTok,
  };
}

export function startStep(run: AgentRun, index: number, durationMs: number, now: number): AgentRun {
  const step = run.steps[index];
  return {
    ...run,
    steps: run.steps.map((s, i) =>
      i === index ? { ...s, status: "running" as const, startedAt: now, durationMs } : s
    ),
    events: appendEvents(run, [
      event("plan", `Step ${index + 1}/${run.steps.length} · ${step.name}`, now),
    ]),
  };
}

export function completeStep(
  run: AgentRun,
  index: number,
  result: { summary: string; detail?: string },
  now: number
): AgentRun {
  return {
    ...run,
    ...estimateStepUsage(run),
    steps: run.steps.map((s, i) =>
      i === index ? { ...s, status: "done" as const, endedAt: now, result: result.summary } : s
    ),
    events: appendEvents(run, [event("tool", result.summary, now)]),
  };
}

export function skipStep(run: AgentRun, index: number, reason: string, now: number): AgentRun {
  return {
    ...run,
    steps: run.steps.map((s, i) =>
      i === index ? { ...s, status: "skipped" as const, endedAt: now, result: reason } : s
    ),
    events: appendEvents(run, [event("plan", `Skipped ${run.steps[index].name} — ${reason}`, now)]),
  };
}

export function failRun(run: AgentRun, index: number, message: string, now: number): AgentRun {
  return {
    ...run,
    ...estimateStepUsage(run),
    status: "failed",
    endedAt: now,
    error: `${run.steps[index].name}: ${message}`,
    steps: run.steps.map((s, i) =>
      i === index
        ? { ...s, status: "failed" as const, endedAt: now, error: message }
        : i > index
          ? { ...s, status: "skipped" as const }
          : s
    ),
    events: appendEvents(run, [
      event("error", `${run.steps[index].name} failed — ${message}`, now),
      event("system", `Run failed after ${index + 1}/${run.steps.length} steps`, now),
    ]),
  };
}

export function finishRun(
  run: AgentRun,
  details: string[],
  outputVars: Record<string, string>,
  now: number
): AgentRun {
  const done = run.steps.filter((s) => s.status === "done");
  const output = [
    `# ${run.agentName} · ${taskTopic(run.task)}`,
    "",
    `**Task** — ${run.task}`,
    `**Skill** — ${run.skillName}`,
    "",
    "## Actions taken",
    ...run.steps.map((s) => {
      const mark = s.status === "done" ? "✓" : s.status === "skipped" ? "–" : "✗";
      return `- ${mark} ${s.name}${s.result ? ` — ${s.result}` : ""}`;
    }),
    ...(details.length ? ["", "## Collected", ...details] : []),
  ].join("\n");

  return {
    ...run,
    status: "succeeded",
    endedAt: now,
    output,
    outputVars,
    events: appendEvents(run, [
      event(
        "system",
        `Completed ${done.length}/${run.steps.length} steps in ${((now - (run.startedAt ?? now)) / 1000).toFixed(1)}s`,
        now
      ),
    ]),
  };
}

export function cancelRunState(
  run: AgentRun,
  now: number,
  reason = "Cancelled by operator"
): AgentRun {
  if (!isActive(run)) return run;
  return {
    ...run,
    status: "cancelled",
    endedAt: now,
    steps: run.steps.map((s) =>
      s.status === "running" || s.status === "pending"
        ? { ...s, status: "skipped" as const, endedAt: s.startedAt ? now : undefined }
        : s
    ),
    events: appendEvents(run, [event("system", reason, now)]),
  };
}

export function isActive(run: AgentRun): boolean {
  return run.status === "running" || run.status === "queued" || run.status === "awaiting";
}

/** 0–1, interpolating inside the running step so meters move between ticks. */
export function runProgress(run: AgentRun, now: number): number {
  if (run.status === "succeeded") return 1;
  if (run.steps.length === 0) return 0;
  const settled = run.steps.filter(
    (s) => s.status === "done" || s.status === "failed" || s.status === "skipped"
  ).length;
  const running = run.steps.find((s) => s.status === "running");
  const partial =
    running && running.startedAt !== undefined && running.durationMs > 0
      ? Math.min(1, (now - running.startedAt) / running.durationMs)
      : 0;
  return Math.min(1, (settled + partial) / run.steps.length);
}

export function runElapsedMs(run: AgentRun, now: number): number {
  if (run.startedAt === undefined) return 0;
  return (run.endedAt ?? now) - run.startedAt;
}

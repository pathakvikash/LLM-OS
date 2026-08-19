"use client";

import { getAction, type ActionSpec } from "./actions";
import { getConnectorSpec } from "./connectors";
import { appendEvents, event } from "./engine";
import { actionsToTools, getProvider, serverComplete, toolNameToActionId, type LlmTurn } from "@/lib/llm";
import { activeCredentials, isLlmReady, useLlmStore, usesServerKey } from "@/stores/useLlmStore";
import { useAgentStore } from "@/stores/useAgentStore";
import type { AgentDefinition, AgentRun, RunStep } from "./types";

/**
 * The model-driven run: the model chooses one action at a time, each call goes
 * through the same connector gate and the same action implementations as a
 * rule-planned run, and the result is handed back so it can decide what next.
 *
 * Everything here is optional. With no key configured this file is never
 * reached and runs plan with rules exactly as they always have.
 */

const MAX_TURNS = 8;
const APPROVAL_TIMEOUT_MS = 120_000;

export interface ModelRunOutcome {
  ok: boolean;
  /** Why the model path was abandoned, when it was. */
  fallbackReason?: string;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function runNow(runId: string): AgentRun | undefined {
  return useAgentStore.getState().runs.find((r) => r.id === runId);
}

function stillRunning(runId: string): boolean {
  const run = runNow(runId);
  return run?.status === "running" || run?.status === "awaiting";
}

/** The connector gate, identical to the rule path's. */
function permissionError(action: ActionSpec, params: Record<string, string>): string | null {
  const label = getConnectorSpec(action.connectorId)?.label ?? action.connectorId;
  const connector = useAgentStore.getState().connectors.find((c) => c.id === action.connectorId);
  const scope = action.scopeFor?.(params) ?? action.scope;
  if (!connector?.connected) return `the ${label} connector is disconnected`;
  if (scope === "write" && !connector.allowWrite) return `the ${label} connector is read-only`;
  return null;
}

/** Blocks until the operator approves, denies, cancels the run, or time runs out. */
async function awaitApproval(runId: string, step: RunStep): Promise<"approved" | "denied"> {
  const store = useAgentStore.getState();
  store.requestApproval({
    runId,
    actionId: step.actionId,
    summary: step.name,
    params: step.params,
    askedAt: Date.now(),
  });

  const deadline = Date.now() + APPROVAL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const decision = useAgentStore.getState().approvals[runId];
    if (decision === "approved" || decision === "denied") {
      useAgentStore.getState().clearApproval(runId);
      return decision;
    }
    if (runNow(runId)?.status === "cancelled") {
      useAgentStore.getState().clearApproval(runId);
      return "denied";
    }
    await sleep(200);
  }
  useAgentStore.getState().clearApproval(runId);
  return "denied";
}

function toolGuidance(agent: AgentDefinition): string {
  return [
    "",
    "## How to work",
    "- You act by calling the tools below; they change this desktop for real.",
    "- Call one or more tools, read the results, then continue until the task is done.",
    "- When it is done, reply with a short plain-language summary of what changed.",
    "- If a tool reports that a connector is disconnected or read-only, stop and say which access you need.",
    `- Keep within ${agent.maxSteps} tool calls.`,
  ].join("\n");
}

export async function executeModelRun(runId: string, agent: AgentDefinition): Promise<ModelRunOutcome> {
  if (!isLlmReady()) return { ok: false, fallbackReason: "no model configured" };

  const start = runNow(runId);
  if (!start) return { ok: false, fallbackReason: "run vanished" };

  const { providerId, confirmWrites } = useLlmStore.getState();
  const { apiKey, model } = activeCredentials();
  const provider = getProvider(providerId);
  const viaServer = usesServerKey();
  const tools = actionsToTools();
  const messages: LlmTurn[] = [{ role: "user", content: start.task }];
  const details: string[] = [];

  const update = (updater: (run: AgentRun) => AgentRun) =>
    useAgentStore.getState().updateRun(runId, updater);

  update((run) => ({
    ...run,
    mode: "model",
    modelId: model,
    events: appendEvents(run, [event("system", `Planning with ${model}`, Date.now())]),
  }));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (!stillRunning(runId)) return { ok: true };

    let response;
    try {
      const request = {
        model,
        system: `${start.systemPrompt}${toolGuidance(agent)}`,
        messages,
        tools,
      };
      // The server route attaches its own key; the browser path uses the saved one.
      response = viaServer
        ? await serverComplete(providerId, request)
        : await provider.complete(request, apiKey);
    } catch (error) {
      const reason = (error as Error).message;
      // A model that cannot be reached must never sink the run.
      return { ok: false, fallbackReason: reason };
    }

    // Real usage, replacing the estimate a rule-planned run carries.
    const spec = useLlmStore.getState().models.find((m) => m.id === model);
    const cost =
      (response.usage.inputTokens * (spec?.inputPerToken ?? 0)) +
      (response.usage.outputTokens * (spec?.outputPerToken ?? 0));
    useLlmStore.getState().recordSpend(cost);
    update((run) => ({
      ...run,
      tokensIn: run.tokensIn + response.usage.inputTokens,
      tokensOut: run.tokensOut + response.usage.outputTokens,
      costUsd: run.costUsd + cost,
    }));

    if (response.toolCalls.length === 0) {
      const output = response.text || "Done.";
      update((run) => ({
        ...run,
        status: "succeeded",
        endedAt: Date.now(),
        output: [`# ${run.agentName} · ${model}`, "", output, ...(details.length ? ["", "## Collected", ...details] : [])].join("\n"),
        events: appendEvents(run, [event("system", `Finished after ${turn + 1} model turn(s)`, Date.now())]),
      }));
      return { ok: true };
    }

    const results = [];
    for (const call of response.toolCalls) {
      const actionId = toolNameToActionId(call.name);
      const action = getAction(actionId);
      const params = Object.fromEntries(
        Object.entries(call.input ?? {}).map(([key, value]) => [key, String(value ?? "")])
      );

      if (!action) {
        results.push({ id: call.id, content: `No such action: ${actionId}`, isError: true });
        continue;
      }

      const step: RunStep = {
        id: crypto.randomUUID(),
        name: action.describe(params),
        actionId,
        params,
        status: "running",
        durationMs: 0,
        startedAt: Date.now(),
      };
      update((run) => ({
        ...run,
        steps: [...run.steps, step],
        events: appendEvents(run, [event("tool", `${model} → ${step.name}`, Date.now())]),
      }));

      const settleStep = (patch: Partial<RunStep>) =>
        update((run) => ({
          ...run,
          steps: run.steps.map((s) => (s.id === step.id ? { ...s, ...patch, endedAt: Date.now() } : s)),
        }));

      const denied = permissionError(action, params);
      if (denied) {
        settleStep({ status: "failed", error: denied });
        results.push({ id: call.id, content: `Refused: ${denied}.`, isError: true });
        continue;
      }

      const scope = action.scopeFor?.(params) ?? action.scope;
      if (confirmWrites && scope === "write") {
        update((run) => ({ ...run, status: "awaiting" }));
        const decision = await awaitApproval(runId, step);
        update((run) => (run.status === "awaiting" ? { ...run, status: "running" } : run));
        if (decision === "denied") {
          settleStep({ status: "skipped", result: "declined by the operator" });
          results.push({ id: call.id, content: "The operator declined this change.", isError: true });
          continue;
        }
      }

      if (!stillRunning(runId)) return { ok: true };

      try {
        const result = await action.run(params, { agentName: agent.name, runId });
        useAgentStore.getState().noteConnectorUse(action.connectorId, Date.now());
        if (result.detail && details.length < 6) details.push(`### ${step.name}\n${result.detail}`);
        settleStep({ status: "done", result: result.summary });
        results.push({ id: call.id, content: result.summary });
      } catch (error) {
        const message = (error as Error).message;
        settleStep({ status: "failed", error: message });
        // Handed back rather than thrown: the model can try another way.
        results.push({ id: call.id, content: `Failed: ${message}`, isError: true });
      }
    }

    messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls });
    messages.push({ role: "tool", results });
  }

  update((run) => ({
    ...run,
    status: "succeeded",
    endedAt: Date.now(),
    output: run.output ?? `Stopped after ${MAX_TURNS} model turns.`,
    events: appendEvents(run, [event("system", `Stopped at the ${MAX_TURNS}-turn limit`, Date.now())]),
  }));
  return { ok: true };
}

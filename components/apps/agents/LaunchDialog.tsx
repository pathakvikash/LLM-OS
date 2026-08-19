"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { getModel } from "@/lib/agents/catalog";
import { previewTask } from "@/lib/agents/skills";
import type { AgentDefinition, Skill } from "@/lib/agents/types";
import { AgentGlyph, Button, Chip, Field, Modal, inputClass, inputStyle } from "./parts";

const COUNTS = [1, 2, 3, 5];

export default function LaunchDialog({
  agents,
  skills,
  appNames,
  defaultAgentId,
  forcedSkillId,
  onClose,
  onLaunch,
}: {
  agents: AgentDefinition[];
  skills: Skill[];
  appNames: string[];
  defaultAgentId?: string;
  /** Set when launching from the Skills tab: run this skill whatever the task says. */
  forcedSkillId?: string;
  onClose: () => void;
  onLaunch: (agentId: string, task: string, count: number, skillId?: string) => void;
}) {
  const selectable = agents.filter((a) => a.enabled);
  const [agentId, setAgentId] = useState(() => {
    // Never default to a disabled agent: its runs would queue and never start.
    const preferred = agents.find((a) => a.id === defaultAgentId && a.enabled);
    return preferred?.id ?? selectable[0]?.id ?? agents[0]?.id ?? "";
  });
  const [task, setTask] = useState("");
  const [count, setCount] = useState(1);

  const agent = agents.find((a) => a.id === agentId);
  const granted = skills.filter((s) => agent?.skills.includes(s.id));
  const forced = forcedSkillId ? skills.find((s) => s.id === forcedSkillId) : undefined;
  // Same resolution the store uses, so the dialog shows what will actually run.
  const plan = task.trim() ? previewTask(task.trim(), granted, appNames, skills) : { steps: [], unhandled: [] };
  const chain = forced ? [forced] : plan.steps.map((s) => s.skill);
  const stepCount = chain.reduce((sum, s) => sum + s.steps.length, 0);
  const canLaunch = Boolean(agent?.enabled) && task.trim().length > 0 && chain.length > 0;

  function launch() {
    if (!canLaunch || !agent) return;
    onLaunch(agent.id, task.trim(), count, forcedSkillId);
    onClose();
  }

  return (
    <Modal
      title="Trigger a run"
      subtitle={agent ? `${agent.name} · ${getModel(agent.model).label}` : "No agent selected"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <span className="mr-auto text-[11px]" style={{ color: "var(--text-muted)" }}>
            ⌘↵ to launch
          </span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={launch} disabled={!canLaunch}>
            <Play size={12} strokeWidth={2.5} />
            Launch {count > 1 ? `${count} runs` : "run"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Agent" hint={selectable.length === 0 ? "every agent is disabled" : undefined}>
          <div className="grid grid-cols-2 gap-1.5">
            {agents.map((a) => {
              const selected = a.id === agentId;
              return (
                <button
                  key={a.id}
                  onClick={() => setAgentId(a.id)}
                  disabled={!a.enabled}
                  className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-left disabled:opacity-40"
                  style={{
                    borderColor: selected ? a.color : "var(--glass-border)",
                    background: selected ? `color-mix(in srgb, ${a.color} 14%, transparent)` : "transparent",
                  }}
                >
                  <AgentGlyph iconKey={a.iconKey} color={a.color} size={15} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium">{a.name}</span>
                    <span className="block truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {getModel(a.model).label}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Task">
          <textarea
            autoFocus
            rows={4}
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) launch();
            }}
            placeholder={agent ? `What should ${agent.name} do?` : "Describe the task"}
            className={`${inputClass} resize-none font-[inherit]`}
            style={inputStyle}
          />
        </Field>

        <div
          className="rounded-(--radius-sm) border px-3 py-2 text-[11px]"
          style={{ borderColor: "var(--glass-border)", color: "var(--text-secondary)" }}
        >
          {agent && !agent.enabled ? (
            <span style={{ color: "var(--warning)" }}>
              {agent.name} is disabled — enable it in the Agents tab before triggering a run.
            </span>
          ) : chain.length > 0 ? (
            <>
              Will run{" "}
              <strong style={{ color: "var(--text-primary)" }}>
                {chain.map((s) => s.name).join(" → ")}
              </strong>{" "}
              — {stepCount} step{stepCount === 1 ? "" : "s"}
              {forced && " (forced from the Skills tab)"}
              {forced && agent && !agent.skills.includes(forced.id) && " — not granted to this agent"}
              <span className="mt-1 block" style={{ color: "var(--text-muted)" }}>
                {chain.map((s) => s.description).join(" ")}
              </span>
              {plan.unhandled.length > 0 && !forced && (
                <span className="mt-1 block" style={{ color: "var(--warning)" }}>
                  No granted skill for: {plan.unhandled.join(" · ")}
                </span>
              )}
            </>
          ) : task.trim() ? (
            <span style={{ color: "var(--warning)" }}>
              {granted.length === 0
                ? "This agent has no skills granted — give it one in the Agents tab."
                : "No skill matches this task yet."}
            </span>
          ) : (
            "The task decides which of the agent's skills runs."
          )}
        </div>

        <Field label="Parallel copies" hint="each copy is queued as its own run">
          <div className="flex gap-1.5">
            {COUNTS.map((n) => (
              <Chip key={n} onClick={() => setCount(n)} active={count === n} tone="var(--accent-primary)">
                ×{n}
              </Chip>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

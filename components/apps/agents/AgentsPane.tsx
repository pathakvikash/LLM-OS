"use client";

import { CalendarClock, Copy, Pencil, Play } from "lucide-react";
import { getModel } from "@/lib/agents/catalog";
import type { AgentDefinition, AgentRun, Skill } from "@/lib/agents/types";
import { formatDuration, formatUsd } from "@/lib/utils/format";
import { AgentGlyph, Button, Card, Chip, ConfirmDelete, Toggle } from "./parts";

function agentStats(agentId: string, runs: AgentRun[]) {
  const mine = runs.filter((r) => r.agentId === agentId);
  const finished = mine.filter((r) => r.status === "succeeded" || r.status === "failed");
  const succeeded = finished.filter((r) => r.status === "succeeded");
  const durations = succeeded
    .filter((r) => r.startedAt !== undefined && r.endedAt !== undefined)
    .map((r) => r.endedAt! - r.startedAt!);
  return {
    total: mine.length,
    successRate: finished.length ? succeeded.length / finished.length : null,
    avgMs: durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null,
    spend: mine.reduce((sum, r) => sum + r.costUsd, 0),
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[12px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

export default function AgentsPane({
  agents,
  runs,
  skills,
  onLaunch,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
}: {
  agents: AgentDefinition[];
  runs: AgentRun[];
  skills: Skill[];
  onLaunch: (agentId: string) => void;
  onEdit: (agent: AgentDefinition) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2.5 p-4 lg:grid-cols-2">
      {agents.map((agent) => {
        const stats = agentStats(agent.id, runs);

        return (
          <Card key={agent.id} className="flex flex-col" dimmed={!agent.enabled}>
            <div className="flex items-start gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ background: `color-mix(in srgb, ${agent.color} 20%, transparent)` }}
              >
                <AgentGlyph iconKey={agent.iconKey} color={agent.color} size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{agent.name}</div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {agent.description || "No description"}
                </div>
              </div>
              <Toggle
                checked={agent.enabled}
                onChange={(v) => onToggle(agent.id, v)}
                label={`${agent.enabled ? "Disable" : "Enable"} ${agent.name}`}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1">
              <Chip tone={agent.color}>{getModel(agent.model).label}</Chip>
              <Chip>{agent.maxSteps} steps max</Chip>
              {agent.schedule.enabled && (
                <Chip tone="var(--warning)">
                  <CalendarClock size={10} /> every {agent.schedule.everyMinutes}m
                </Chip>
              )}
              {agent.planner === "interpreter" && (
                <Chip tone="var(--accent-secondary)" title="Plans directly from the instruction — no skill needed">
                  interpreter
                </Chip>
              )}
              {agent.skills.length === 0 && agent.planner !== "interpreter" && (
                <Chip tone="var(--warning)">no skills granted</Chip>
              )}
              {agent.skills.slice(0, 3).map((id) => {
                const skill = skills.find((s) => s.id === id);
                return (
                  <Chip key={id} title={skill?.description}>
                    {skill?.name ?? id}
                  </Chip>
                );
              })}
              {agent.skills.length > 3 && <Chip>+{agent.skills.length - 3}</Chip>}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <Stat label="Runs" value={String(stats.total)} />
              <Stat
                label="Success"
                value={stats.successRate === null ? "—" : `${Math.round(stats.successRate * 100)}%`}
              />
              <Stat label="Avg time" value={stats.avgMs === null ? "—" : formatDuration(stats.avgMs)} />
              <Stat label="Est. spend" value={formatUsd(stats.spend)} />
            </div>

            <div className="mt-3 flex items-center gap-1.5">
              <Button variant="primary" onClick={() => onLaunch(agent.id)} disabled={!agent.enabled}>
                <Play size={12} strokeWidth={2.5} /> Run
              </Button>
              <Button onClick={() => onEdit(agent)}>
                <Pencil size={12} /> Edit
              </Button>
              <Button onClick={() => onDuplicate(agent.id)} title="Duplicate agent">
                <Copy size={12} />
              </Button>
              <span className="ml-auto">
                <ConfirmDelete onConfirm={() => onDelete(agent.id)} title="Delete agent" />
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

"use client";

import { Copy, Pencil, Play, Plus } from "lucide-react";
import { getAction } from "@/lib/agents/actions";
import { getConnectorSpec } from "@/lib/agents/connectors";
import type { AgentDefinition, AgentRun, Skill } from "@/lib/agents/types";
import { formatRelativeTime } from "@/lib/utils/format";
import { AgentGlyph, Button, Card, Chip, ConfirmDelete, Toggle } from "./parts";

function ScopeChip({ scope }: { scope: "read" | "write" }) {
  const tone = scope === "write" ? "var(--warning)" : "var(--text-muted)";
  return (
    <Chip tone={tone} title={scope === "write" ? "Changes system state" : "Reads system state"}>
      {scope}
    </Chip>
  );
}

export default function SkillsPane({
  skills,
  agents,
  runs,
  now,
  onNew,
  onEdit,
  onDuplicate,
  onDelete,
  onToggle,
  onRun,
}: {
  skills: Skill[];
  agents: AgentDefinition[];
  runs: AgentRun[];
  now: number;
  onNew: () => void;
  onEdit: (skill: Skill) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (skill: Skill) => void;
}) {
  return (
    <div className="space-y-2.5 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          A task is matched against these trigger words to decide which skill runs it. Steps execute
          top to bottom against the real system.
        </p>
        <Button onClick={onNew}>
          <Plus size={12} /> New skill
        </Button>
      </div>

      {skills.map((skill) => {
        const used = runs.filter((r) =>
          r.skillIds?.length ? r.skillIds.includes(skill.id) : r.skillId === skill.id
        );
        const succeeded = used.filter((r) => r.status === "succeeded").length;
        const owners = agents.filter((a) => a.skills.includes(skill.id));

        return (
          <Card key={skill.id} dimmed={!skill.enabled}>
            <div className="flex items-start gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ background: "color-mix(in srgb, var(--accent-secondary) 18%, transparent)" }}
              >
                <AgentGlyph iconKey={skill.iconKey} size={16} color="var(--accent-secondary)" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold">{skill.name}</span>
                  {skill.builtin && <Chip>built-in</Chip>}
                </div>
                <div className="truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {skill.description || "No description"}
                </div>
              </div>
              <Toggle
                checked={skill.enabled}
                onChange={(v) => onToggle(skill.id, v)}
                label={`${skill.enabled ? "Disable" : "Enable"} ${skill.name}`}
              />
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1">
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Triggers:
              </span>
              {skill.triggers.length === 0 ? (
                <Chip tone="var(--warning)">none — only runs as a fallback</Chip>
              ) : (
                skill.triggers.map((t) => <Chip key={t}>{t}</Chip>)
              )}
            </div>

            <ol className="mt-2.5 space-y-1">
              {skill.steps.map((step, i) => {
                const action = getAction(step.actionId);
                const connector = action ? getConnectorSpec(action.connectorId) : undefined;
                return (
                  <li key={i} className="flex items-center gap-1.5 text-[11px]">
                    <span className="w-3 tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {i + 1}
                    </span>
                    <span style={{ color: "var(--text-primary)" }}>
                      {action ? action.describe(step.params) : `Unknown action ${step.actionId}`}
                    </span>
                    {connector && <Chip>{connector.label}</Chip>}
                    {action && <ScopeChip scope={action.scope} />}
                    {step.optional && <Chip tone="var(--text-muted)">optional</Chip>}
                  </li>
                );
              })}
            </ol>

            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Button variant="primary" onClick={() => onRun(skill)} disabled={!skill.enabled}>
                <Play size={12} strokeWidth={2.5} /> Run
              </Button>
              <Button onClick={() => onEdit(skill)}>
                <Pencil size={12} /> Edit
              </Button>
              <Button onClick={() => onDuplicate(skill.id)} title="Duplicate skill">
                <Copy size={12} />
              </Button>
              {owners.length === 0 && (
                <Chip tone="var(--warning)" title="Chat routes to a skill only through an agent that holds it">
                  no agent holds this
                </Chip>
              )}
              <span className="ml-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
                {used.length === 0
                  ? "never used"
                  : `${used.length} run${used.length === 1 ? "" : "s"}, ${succeeded} succeeded · last ${formatRelativeTime(
                      Math.max(...used.map((r) => r.createdAt)),
                      now
                    )}`}
                {owners.length > 0 && ` · granted to ${owners.map((a) => a.name).join(", ")}`}
              </span>
              <span className="ml-auto">
                <ConfirmDelete onConfirm={() => onDelete(skill.id)} title="Delete skill" />
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

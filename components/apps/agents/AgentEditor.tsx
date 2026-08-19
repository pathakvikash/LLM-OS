"use client";

import { useState } from "react";
import { AGENT_COLORS, MODELS } from "@/lib/agents/catalog";
import type { AgentDefinition, Skill } from "@/lib/agents/types";
import { Button, Chip, Field, IconPicker, Modal, Toggle, inputClass, inputStyle } from "./parts";

type Draft = Omit<AgentDefinition, "id" | "createdAt">;

const BLANK: Draft = {
  name: "",
  description: "",
  iconKey: "sparkles",
  color: AGENT_COLORS[0],
  model: MODELS[0].id,
  systemPrompt: "You are a capable agent. Finish the task and report what you did.",
  skills: [],
  planner: "skills",
  maxSteps: 8,
  avgStepMs: 1600,
  enabled: true,
  schedule: { enabled: false, everyMinutes: 30, task: "" },
};

export default function AgentEditor({
  agent,
  skills,
  onClose,
  onSave,
}: {
  agent?: AgentDefinition;
  skills: Skill[];
  onClose: () => void;
  onSave: (draft: Draft) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    agent ? { ...agent, schedule: { ...agent.schedule } } : { ...BLANK }
  );

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const toggleSkill = (id: string) =>
    patch({ skills: draft.skills.includes(id) ? draft.skills.filter((s) => s !== id) : [...draft.skills, id] });

  // A generalist needs no skills; a skills-planner is useless without them.
  const valid = draft.name.trim().length > 0 && (draft.planner === "interpreter" || draft.skills.length > 0);

  return (
    <Modal
      title={agent ? `Edit ${agent.name}` : "New agent"}
      subtitle="Configuration applies to the next run — runs already in flight keep their settings."
      onClose={onClose}
      width={620}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (!valid) return;
              onSave({ ...draft, name: draft.name.trim() });
              onClose();
            }}
          >
            {agent ? "Save changes" : "Create agent"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Name">
            <input
              autoFocus
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="Researcher"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Model">
            <select
              value={draft.model}
              onChange={(e) => patch({ model: e.target.value })}
              className={inputClass}
              style={inputStyle}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} style={{ color: "black" }}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Description">
          <input
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What this agent is for"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Icon">
            <IconPicker value={draft.iconKey} onChange={(iconKey) => patch({ iconKey })} tone={draft.color} />
          </Field>
          <Field label="Colour">
            <div className="flex flex-wrap gap-1.5">
              {AGENT_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => patch({ color })}
                  aria-label={`Colour ${color}`}
                  className="h-6 w-6 rounded-full"
                  style={{
                    background: color,
                    outline: draft.color === color ? "2px solid var(--text-primary)" : "none",
                    outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </Field>
        </div>

        <Field label="System prompt">
          <textarea
            rows={3}
            value={draft.systemPrompt}
            onChange={(e) => patch({ systemPrompt: e.target.value })}
            className={`${inputClass} resize-none font-[inherit]`}
            style={inputStyle}
          />
        </Field>

        <Field label="Planning" hint="how this agent turns a task into actions">
          <div className="flex gap-1.5">
            <Chip
              onClick={() => patch({ planner: "skills" })}
              active={(draft.planner ?? "skills") === "skills"}
              tone={draft.color}
              title="Runs pre-written skills, matched to the task by trigger words"
            >
              Skills
            </Chip>
            <Chip
              onClick={() => patch({ planner: "interpreter" })}
              active={draft.planner === "interpreter"}
              tone={draft.color}
              title="Reads the instruction and composes the actions itself — no skill needed"
            >
              Interpreter
            </Chip>
          </div>
        </Field>

        <Field
          label="Skills"
          hint={
            draft.planner === "interpreter"
              ? "optional — this agent plans from the instruction instead"
              : draft.skills.length === 0
                ? "pick at least one — a run needs a skill to execute"
                : `${draft.skills.length} granted`
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <Chip
                key={skill.id}
                onClick={() => toggleSkill(skill.id)}
                active={draft.skills.includes(skill.id)}
                tone={draft.color}
                title={`${skill.description} — triggers: ${skill.triggers.join(", ")}`}
              >
                {skill.name}
              </Chip>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Max steps" hint={String(draft.maxSteps)}>
            <input
              type="range"
              min={3}
              max={12}
              value={draft.maxSteps}
              onChange={(e) => patch({ maxSteps: Number(e.target.value) })}
              className="w-full accent-(--accent-primary)"
            />
          </Field>
          <Field label="Pace per step" hint={`${(draft.avgStepMs / 1000).toFixed(1)}s`}>
            <input
              type="range"
              min={600}
              max={6000}
              step={200}
              value={draft.avgStepMs}
              onChange={(e) => patch({ avgStepMs: Number(e.target.value) })}
              className="w-full accent-(--accent-primary)"
            />
          </Field>
        </div>

        <div className="rounded-(--radius-sm) border p-3" style={{ borderColor: "var(--glass-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-medium">Schedule</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Fires on its own while the desktop is open.
              </div>
            </div>
            <Toggle
              checked={draft.schedule.enabled}
              onChange={(enabled) => patch({ schedule: { ...draft.schedule, enabled } })}
              label="Enable schedule"
            />
          </div>
          {draft.schedule.enabled && (
            <div className="mt-3 space-y-3">
              <Field label="Every" hint={`${draft.schedule.everyMinutes} minutes`}>
                <input
                  type="range"
                  min={1}
                  max={120}
                  value={draft.schedule.everyMinutes}
                  onChange={(e) =>
                    patch({ schedule: { ...draft.schedule, everyMinutes: Number(e.target.value) } })
                  }
                  className="w-full accent-(--accent-primary)"
                />
              </Field>
              <Field label="Scheduled task">
                <input
                  value={draft.schedule.task}
                  onChange={(e) => patch({ schedule: { ...draft.schedule, task: e.target.value } })}
                  placeholder="What it should do on every firing"
                  className={inputClass}
                  style={inputStyle}
                />
              </Field>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

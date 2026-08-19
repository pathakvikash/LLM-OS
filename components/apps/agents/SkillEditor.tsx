"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { ACTIONS, getAction } from "@/lib/agents/actions";
import { CONNECTOR_SPECS } from "@/lib/agents/connectors";
import type { AgentDefinition, Skill, SkillStep } from "@/lib/agents/types";
import { Button, Chip, Field, IconPicker, Modal, Toggle, inputClass, inputStyle } from "./parts";

type Draft = Omit<Skill, "id" | "createdAt">;

const BLANK: Draft = {
  name: "",
  description: "",
  iconKey: "wrench",
  triggers: [],
  steps: [{ actionId: "files.list", params: { path: "/Documents" } }],
  enabled: true,
};

const VARIABLES = ["task", "topic", "slug", "path", "app", "date", "datetime", "agent", "command", "theme", "color"];

export default function SkillEditor({
  skill,
  agents,
  onClose,
  onSave,
}: {
  skill?: Skill;
  agents: AgentDefinition[];
  onClose: () => void;
  /** Grants are saved alongside the skill: an ungranted skill can never match. */
  onSave: (draft: Draft, agentIds: string[]) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    skill
      ? { ...skill, triggers: [...skill.triggers], steps: skill.steps.map((s) => ({ ...s, params: { ...s.params } })) }
      : { ...BLANK }
  );
  const [triggerText, setTriggerText] = useState(() => (skill?.triggers ?? []).join(", "));
  const [grantedTo, setGrantedTo] = useState<string[]>(() =>
    skill ? agents.filter((a) => a.skills.includes(skill.id)).map((a) => a.id) : []
  );

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function patchStep(index: number, next: Partial<SkillStep>) {
    patch({ steps: draft.steps.map((s, i) => (i === index ? { ...s, ...next } : s)) });
  }

  function setActionId(index: number, actionId: string) {
    const action = getAction(actionId);
    // Reset params to the new action's shape so no stale keys linger.
    const params = Object.fromEntries((action?.params ?? []).map((p) => [p.name, ""]));
    patchStep(index, { actionId, params });
  }

  function moveStep(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patch({ steps });
  }

  const valid = draft.name.trim().length > 0 && draft.steps.length > 0;

  return (
    <Modal
      title={skill ? `Edit ${skill.name}` : "New skill"}
      subtitle="A skill is an ordered list of real actions. Values can interpolate {{variables}}."
      onClose={onClose}
      width={680}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!valid}
            onClick={() => {
              if (!valid) return;
              onSave(
                {
                  ...draft,
                  name: draft.name.trim(),
                  triggers: triggerText
                    .split(",")
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean),
                },
                grantedTo
              );
              onClose();
            }}
          >
            {skill ? "Save skill" : "Create skill"}
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
              placeholder="Tidy documents"
              className={inputClass}
              style={inputStyle}
            />
          </Field>
          <Field label="Enabled" hint="matchable by tasks">
            <div className="pt-1.5">
              <Toggle checked={draft.enabled} onChange={(enabled) => patch({ enabled })} label="Skill enabled" />
            </div>
          </Field>
        </div>

        <Field label="Description">
          <input
            value={draft.description}
            onChange={(e) => patch({ description: e.target.value })}
            placeholder="What this skill does, in one line"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field label="Trigger words" hint="comma separated — the task is matched against these">
          <input
            value={triggerText}
            onChange={(e) => setTriggerText(e.target.value)}
            placeholder="tidy, index, inventory"
            className={inputClass}
            style={inputStyle}
          />
        </Field>

        <Field
          label="Agents that hold this"
          hint={
            grantedTo.length === 0
              ? "none yet — until an agent holds it, chat can never route to this skill"
              : `${grantedTo.length} agent${grantedTo.length === 1 ? "" : "s"}`
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <Chip
                key={agent.id}
                onClick={() =>
                  setGrantedTo((current) =>
                    current.includes(agent.id)
                      ? current.filter((id) => id !== agent.id)
                      : [...current, agent.id]
                  )
                }
                active={grantedTo.includes(agent.id)}
                tone={agent.color}
                title={
                  agent.planner === "interpreter"
                    ? `${agent.name} plans by interpreting, so a skill is optional for it`
                    : `Let ${agent.name} run this skill`
                }
              >
                {agent.name}
              </Chip>
            ))}
          </div>
        </Field>

        <Field label="Icon">
          <IconPicker value={draft.iconKey} onChange={(iconKey) => patch({ iconKey })} />
        </Field>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Steps
            </span>
            <Button
              onClick={() => patch({ steps: [...draft.steps, { actionId: ACTIONS[0].id, params: {} }] })}
            >
              <Plus size={12} /> Add step
            </Button>
          </div>

          <div className="mt-2 space-y-2">
            {draft.steps.map((step, index) => {
              const action = getAction(step.actionId);
              return (
                <div
                  key={index}
                  className="rounded-(--radius-sm) border p-2.5"
                  style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {index + 1}
                    </span>
                    <select
                      value={step.actionId}
                      onChange={(e) => setActionId(index, e.target.value)}
                      className={`${inputClass} flex-1`}
                      style={inputStyle}
                    >
                      {CONNECTOR_SPECS.map((connector) => (
                        <optgroup key={connector.id} label={connector.label}>
                          {ACTIONS.filter((a) => a.connectorId === connector.id).map((a) => (
                            <option key={a.id} value={a.id} style={{ color: "black" }}>
                              {a.label} ({a.scope})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <Button onClick={() => moveStep(index, -1)} title="Move up">
                      <ArrowUp size={12} />
                    </Button>
                    <Button onClick={() => moveStep(index, 1)} title="Move down">
                      <ArrowDown size={12} />
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => patch({ steps: draft.steps.filter((_, i) => i !== index) })}
                      title="Remove step"
                    >
                      <Trash2 size={12} />
                    </Button>
                  </div>

                  {action && action.params.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {action.params.map((spec) =>
                        spec.multiline ? (
                          <textarea
                            key={spec.name}
                            rows={3}
                            value={step.params[spec.name] ?? ""}
                            onChange={(e) =>
                              patchStep(index, { params: { ...step.params, [spec.name]: e.target.value } })
                            }
                            placeholder={spec.label}
                            className={`${inputClass} resize-none font-mono text-[11px]`}
                            style={inputStyle}
                          />
                        ) : (
                          <input
                            key={spec.name}
                            value={step.params[spec.name] ?? ""}
                            onChange={(e) =>
                              patchStep(index, { params: { ...step.params, [spec.name]: e.target.value } })
                            }
                            placeholder={`${spec.label}${spec.placeholder ? ` — e.g. ${spec.placeholder}` : ""}`}
                            className={inputClass}
                            style={inputStyle}
                          />
                        )
                      )}
                    </div>
                  )}

                  <label className="mt-2 flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(step.optional)}
                      onChange={(e) => patchStep(index, { optional: e.target.checked })}
                      className="accent-(--accent-primary)"
                    />
                    Skip this step instead of failing when its inputs are missing or access is denied
                  </label>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1">
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Variables:
            </span>
            {VARIABLES.map((v) => (
              <Chip key={v} title={`Insert {{${v}}} into any field above`}>{`{{${v}}}`}</Chip>
            ))}
            <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              plus anything earlier steps return ({`{{content}}`}, {`{{files}}`}, {`{{stdout}}`}…)
            </span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

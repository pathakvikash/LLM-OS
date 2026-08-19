"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { composeSystemPrompt, splitComposedPrompt } from "@/lib/agents/prompt";
import type { AgentDefinition, Connector, Skill } from "@/lib/agents/types";
import { Button, Chip, Field, inputClass, inputStyle } from "./parts";

export default function PromptPane({
  systemPrompt,
  agents,
  skills,
  connectors,
  onChange,
  onReset,
}: {
  systemPrompt: string;
  agents: AgentDefinition[];
  skills: Skill[];
  connectors: Connector[];
  onChange: (prompt: string) => void;
  onReset: () => void;
}) {
  const [previewId, setPreviewId] = useState(() => agents[0]?.id ?? "");
  const previewAgent = agents.find((a) => a.id === previewId) ?? agents[0];

  // Only the agent-specific half: the fleet brief is the editable box above.
  const preview = previewAgent
    ? splitComposedPrompt(
        composeSystemPrompt({ fleetPrompt: systemPrompt, agent: previewAgent, skills, connectors })
      ).agent
    : "";

  return (
    <div className="space-y-4 p-4">
      <section>
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
            The fleet brief every agent inherits. Each run composes it with the agent&apos;s own prompt,
            the skills it holds, and the access its connectors allow at that moment — and keeps that
            copy, so a run always shows the brief it was actually planned against.
          </p>
          <Button onClick={onReset} title="Restore the default brief">
            <RotateCcw size={12} /> Reset
          </Button>
        </div>

        <div className="mt-2">
          <textarea
            rows={10}
            value={systemPrompt}
            onChange={(e) => onChange(e.target.value)}
            placeholder="How every agent on this desktop should behave"
            className={`${inputClass} resize-none font-mono text-[11px] leading-relaxed`}
            style={inputStyle}
          />
          <div className="mt-1 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {systemPrompt.length} characters
          </div>
        </div>
      </section>

      <section>
        <Field label="What each agent adds" hint="on top of the fleet brief above — not a copy of it">
          <div className="flex flex-wrap gap-1.5">
            {agents.map((agent) => (
              <Chip
                key={agent.id}
                onClick={() => setPreviewId(agent.id)}
                active={agent.id === previewAgent?.id}
                tone={agent.color}
              >
                {agent.name}
              </Chip>
            ))}
          </div>
        </Field>

        <pre
          className="mt-2 overflow-auto rounded-(--radius-sm) border p-3 text-[11px] leading-relaxed whitespace-pre-wrap"
          style={{
            borderColor: "var(--glass-border)",
            background: "color-mix(in srgb, var(--glass-bg) 50%, transparent)",
          }}
        >
          {preview || "Create an agent to see its brief."}
        </pre>
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Every run is given the fleet brief above followed by this. Editing an agent&apos;s own
          instructions happens in the Agents tab.
        </p>
      </section>

      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        No model reads this — nothing leaves the browser. It is the operating contract for the fleet:
        the record of what each agent was told, alongside the skills and access that decide what it can
        actually do.
      </p>
    </div>
  );
}

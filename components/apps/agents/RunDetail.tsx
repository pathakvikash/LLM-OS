"use client";

import { useEffect, useRef } from "react";
import { Ban, RotateCcw, Trash2 } from "lucide-react";
import { getModel } from "@/lib/agents/catalog";
import { splitComposedPrompt } from "@/lib/agents/prompt";
import { isActive, runElapsedMs, runProgress } from "@/lib/agents/engine";
import type { AgentRun, EventLevel } from "@/lib/agents/types";
import { formatClockTime, formatCompact, formatDuration, formatUsd } from "@/lib/utils/format";
import { AgentGlyph, Button, Chip, Meter, StatusBadge, StepDot, STATUS_META } from "./parts";

const LEVEL_COLOR: Record<EventLevel, string> = {
  system: "var(--text-muted)",
  plan: "var(--text-secondary)",
  tool: "var(--accent-secondary)",
  output: "var(--success)",
  error: "var(--danger)",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>
        {label}
      </div>
      <div className="text-[13px] font-medium tabular-nums">{value}</div>
    </div>
  );
}

export default function RunDetail({
  run,
  now,
  onCancel,
  onRetry,
  onDelete,
}: {
  run: AgentRun;
  now: number;
  onCancel: () => void;
  onRetry: () => void;
  onDelete: () => void;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const eventCount = run.events.length;

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [eventCount, run.id]);

  const progress = runProgress(run, now);
  const tone = STATUS_META[run.status].color;
  const doneSteps = run.steps.filter((s) => s.status === "done" || s.status === "failed").length;
  const prompt = splitComposedPrompt(run.systemPrompt ?? "");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b px-4 py-3" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-start gap-2">
          <AgentGlyph iconKey={run.agentIconKey} color={run.agentColor} size={16} style={{ marginTop: 2 }} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13px] font-semibold">{run.agentName}</span>
              <StatusBadge status={run.status} />
            </div>
            <p className="mt-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
              {run.task}
            </p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {isActive(run) && (
              <Button onClick={onCancel} title="Cancel this run">
                <Ban size={12} /> Cancel
              </Button>
            )}
            <Button onClick={onRetry} title="Queue the same task again">
              <RotateCcw size={12} /> Re-run
            </Button>
            <Button variant="danger" onClick={onDelete} title="Delete from history">
              <Trash2 size={12} />
            </Button>
          </div>
        </div>

        <div className="mt-3">
          <Meter value={progress} tone={tone} />
        </div>

        <div className="mt-3 flex flex-wrap items-end gap-x-6 gap-y-2">
          <Metric label="Elapsed" value={formatDuration(runElapsedMs(run, now))} />
          <Metric label="Steps" value={`${doneSteps}/${run.steps.length}`} />
          <Metric label="Tokens in" value={formatCompact(run.tokensIn)} />
          <Metric label="Tokens out" value={formatCompact(run.tokensOut)} />
          <Metric label="Est. cost" value={formatUsd(run.costUsd)} />
          <div className="ml-auto flex gap-1.5">
            <Chip tone="var(--accent-secondary)" title="Skill that planned this run">
              {run.skillName}
            </Chip>
            <Chip>{getModel(run.model).label}</Chip>
            <Chip>{run.trigger}</Chip>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <section>
          <h3 className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Steps
          </h3>
          <ol className="mt-2 space-y-1">
            {run.steps.map((step, i) => (
              <li key={step.id} className="flex items-start gap-2 text-[12px]">
                <span className="flex w-4 justify-center pt-[3px]">
                  <StepDot status={step.status} />
                </span>
                <span className="min-w-0">
                  <span
                    style={{
                      color:
                        step.status === "pending" || step.status === "skipped"
                          ? "var(--text-muted)"
                          : "var(--text-primary)",
                    }}
                  >
                    {i + 1}. {step.name}
                  </span>
                  {(step.result || step.error) && (
                    <span
                      className="block text-[11px]"
                      style={{ color: step.error ? "var(--danger)" : "var(--text-secondary)" }}
                    >
                      {step.error ?? step.result}
                    </span>
                  )}
                </span>
                <code className="shrink-0 text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {step.actionId}
                </code>
                {step.startedAt !== undefined && step.endedAt !== undefined && (
                  <span className="ml-auto text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {formatDuration(step.endedAt - step.startedAt)}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-4">
          <h3 className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Activity
          </h3>
          <div
            ref={logRef}
            className="mt-2 max-h-56 overflow-auto rounded-(--radius-sm) border p-2 font-mono text-[11px] leading-relaxed"
            style={{ borderColor: "var(--glass-border)", background: "color-mix(in srgb, var(--glass-bg) 50%, transparent)" }}
          >
            {run.events.map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {formatClockTime(e.ts)}
                </span>
                <span className="min-w-0 break-words" style={{ color: LEVEL_COLOR[e.level] }}>
                  {e.message}
                </span>
              </div>
            ))}
          </div>
        </section>

        {run.error && (
          <section className="mt-4">
            <h3 className="text-[11px] font-semibold" style={{ color: "var(--danger)" }}>
              Failure
            </h3>
            <p
              className="mt-1.5 rounded-(--radius-sm) border p-2 text-[12px]"
              style={{
                borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
                background: "color-mix(in srgb, var(--danger) 10%, transparent)",
              }}
            >
              {run.error}
            </p>
          </section>
        )}

        {run.systemPrompt && (
          <details className="mt-4">
            <summary className="cursor-pointer text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Brief this run was planned against ({run.systemPrompt.length} chars)
            </summary>
            <pre
              className="mt-1.5 overflow-auto rounded-(--radius-sm) border p-3 text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{
                borderColor: "var(--glass-border)",
                background: "color-mix(in srgb, var(--glass-bg) 50%, transparent)",
              }}
            >
              {prompt.agent}
            </pre>
            {prompt.fleet && (
              <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
                Preceded by the fleet brief in force at the time ({prompt.fleet.length} chars) — edit it in
                the Prompt tab.
              </p>
            )}
          </details>
        )}

        {run.output && (
          <section className="mt-4">
            <h3 className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
              Output
            </h3>
            <pre
              className="mt-1.5 overflow-auto rounded-(--radius-sm) border p-3 text-[11px] leading-relaxed whitespace-pre-wrap"
              style={{ borderColor: "var(--glass-border)", background: "color-mix(in srgb, var(--glass-bg) 50%, transparent)" }}
            >
              {run.output}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}

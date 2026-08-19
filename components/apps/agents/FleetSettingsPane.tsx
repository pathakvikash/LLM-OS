"use client";

import { Ban, Eraser, RotateCcw } from "lucide-react";
import type { AgentRun } from "@/lib/agents/types";
import { isActive } from "@/lib/agents/engine";
import { formatCompact, formatUsd } from "@/lib/utils/format";
import { Button, Field, Toggle } from "./parts";

export default function FleetSettingsPane({
  runs,
  maxConcurrent,
  fleetPaused,
  onSetMaxConcurrent,
  onSetFleetPaused,
  onCancelActive,
  onClearFinished,
  onResetAgents,
  onResetSkills,
}: {
  runs: AgentRun[];
  maxConcurrent: number;
  fleetPaused: boolean;
  onSetMaxConcurrent: (n: number) => void;
  onSetFleetPaused: (v: boolean) => void;
  onCancelActive: () => void;
  onClearFinished: () => void;
  onResetAgents: () => void;
  onResetSkills: () => void;
}) {
  const active = runs.filter(isActive).length;
  const tokens = runs.reduce((sum, r) => sum + r.tokensIn + r.tokensOut, 0);
  const spend = runs.reduce((sum, r) => sum + r.costUsd, 0);

  return (
    <div className="max-w-[560px] space-y-5 p-4">
      <section className="rounded-(--radius-sm) border p-3" style={{ borderColor: "var(--glass-border)" }}>
        <Field label="Concurrency" hint={`${maxConcurrent} run${maxConcurrent === 1 ? "" : "s"} at a time`}>
          <input
            type="range"
            min={1}
            max={8}
            value={maxConcurrent}
            onChange={(e) => onSetMaxConcurrent(Number(e.target.value))}
            className="w-full accent-(--accent-primary)"
          />
        </Field>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          Anything over the limit waits in the queue and starts as slots free up.
        </p>

        <div className="mt-4 flex items-center justify-between">
          <div>
            <div className="text-[12px] font-medium">Pause the fleet</div>
            <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
              Stops promotions and schedules. Runs already in flight finish.
            </div>
          </div>
          <Toggle checked={fleetPaused} onChange={onSetFleetPaused} label="Pause the fleet" />
        </div>
      </section>

      <section className="rounded-(--radius-sm) border p-3" style={{ borderColor: "var(--glass-border)" }}>
        <h3 className="text-[12px] font-semibold">History</h3>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {runs.length} run{runs.length === 1 ? "" : "s"} tracked · {formatCompact(tokens)} est. tokens ·{" "}
          {formatUsd(spend)} est. lifetime cost. The 40 newest survive a reload.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button onClick={onCancelActive} disabled={active === 0}>
            <Ban size={12} /> Cancel {active} active
          </Button>
          <Button onClick={onClearFinished}>
            <Eraser size={12} /> Clear finished runs
          </Button>
          <Button variant="danger" onClick={onResetAgents}>
            <RotateCcw size={12} /> Reset agents
          </Button>
          <Button variant="danger" onClick={onResetSkills}>
            <RotateCcw size={12} /> Reset skills
          </Button>
        </div>
      </section>

      <section className="rounded-(--radius-sm) border p-3" style={{ borderColor: "var(--glass-border)" }}>
        <h3 className="text-[12px] font-semibold">About this runtime</h3>
        <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Actions are real. A run reads and writes the virtual filesystem, opens and closes app windows,
          and changes system settings — through whichever connectors you have granted, and nothing else.
          What is <em>not</em> real is the model: no network request leaves the browser, the plan comes from
          the skill whose triggers matched the task, and the token and cost figures are estimates for the
          planning a model would have done, priced from Anthropic&apos;s published per-million-token rates.
          The scheduler keeps ticking while this window is closed, so queued and scheduled work still runs.
        </p>
      </section>
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { Ban, CalendarClock, Radio } from "lucide-react";
import { isActive, runElapsedMs, runProgress } from "@/lib/agents/engine";
import type { AgentDefinition, AgentRun } from "@/lib/agents/types";
import { formatCompact, formatDuration, formatRelativeTime, formatUsd } from "@/lib/utils/format";
import { AgentGlyph, Button, EmptyState, Meter, StatTile, StatusBadge, STATUS_META } from "./parts";

const DAY_MS = 24 * 60 * 60 * 1000;

export default function OverviewPane({
  runs,
  agents,
  maxConcurrent,
  now,
  onOpenRun,
  onCancelRun,
}: {
  runs: AgentRun[];
  agents: AgentDefinition[];
  maxConcurrent: number;
  now: number;
  onOpenRun: (id: string) => void;
  onCancelRun: (id: string) => void;
}) {
  const running = runs.filter((r) => r.status === "running");
  const queued = runs.filter((r) => r.status === "queued");
  const live = [...running, ...queued];

  const day = useMemo(() => {
    const since = now - DAY_MS;
    const recent = runs.filter((r) => (r.endedAt ?? r.createdAt) >= since);
    return {
      succeeded: recent.filter((r) => r.status === "succeeded").length,
      failed: recent.filter((r) => r.status === "failed").length,
      tokens: recent.reduce((sum, r) => sum + r.tokensIn + r.tokensOut, 0),
      cost: recent.reduce((sum, r) => sum + r.costUsd, 0),
      finished: recent.filter((r) => !isActive(r)).length,
    };
    // `now` changes every tick; recomputing 24h stats each second is the point.
  }, [runs, now]);

  const successRate = day.succeeded + day.failed > 0 ? day.succeeded / (day.succeeded + day.failed) : null;

  const activity = useMemo(
    () =>
      runs
        .flatMap((run) => run.events.slice(-4).map((e) => ({ ...e, run })))
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 14),
    [runs]
  );

  const scheduled = agents.filter((a) => a.schedule.enabled && a.enabled);

  return (
    <div className="space-y-5 p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Running"
          value={String(running.length)}
          hint={`${maxConcurrent} slot${maxConcurrent === 1 ? "" : "s"}`}
          tone={running.length > 0 ? "var(--accent-primary)" : undefined}
        />
        <StatTile label="Queued" value={String(queued.length)} hint="waiting for a slot" />
        <StatTile
          label="Succeeded"
          value={String(day.succeeded)}
          hint="last 24 hours"
          tone={day.succeeded > 0 ? "var(--success)" : undefined}
        />
        <StatTile
          label="Failed"
          value={String(day.failed)}
          hint="last 24 hours"
          tone={day.failed > 0 ? "var(--danger)" : undefined}
        />
        <StatTile label="Est. tokens" value={formatCompact(day.tokens)} hint="last 24 hours" />
        <StatTile label="Est. spend" value={formatUsd(day.cost)} hint="last 24 hours" />
      </div>

      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[12px] font-semibold">Fleet capacity</h3>
          <span className="text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {running.length} of {maxConcurrent} slots busy
            {successRate !== null && ` · ${Math.round(successRate * 100)}% success over ${day.finished} finished`}
          </span>
        </div>
        <Meter
          value={maxConcurrent === 0 ? 0 : running.length / maxConcurrent}
          tone={running.length >= maxConcurrent ? "var(--warning)" : "var(--accent-primary)"}
          height={6}
        />
      </section>

      <section>
        <h3 className="mb-2 text-[12px] font-semibold">In flight</h3>
        {live.length === 0 ? (
          <div
            className="rounded-(--radius-sm) border border-dashed px-3 py-6 text-center text-[12px]"
            style={{ borderColor: "var(--glass-border)", color: "var(--text-muted)" }}
          >
            Nothing running. Trigger a run with ⌘↵.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {live.map((run) => {
              return (
                <li
                  key={run.id}
                  className="rounded-(--radius-sm) border px-3 py-2"
                  style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
                >
                  <div className="flex items-center gap-2">
                    <AgentGlyph iconKey={run.agentIconKey} color={run.agentColor} size={14} />
                    <button
                      onClick={() => onOpenRun(run.id)}
                      className="min-w-0 flex-1 truncate text-left text-[12px] hover:underline"
                    >
                      <span className="font-medium">{run.agentName}</span>
                      <span style={{ color: "var(--text-secondary)" }}> — {run.task}</span>
                    </button>
                    <StatusBadge status={run.status} />
                    <span className="w-12 text-right text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                      {run.status === "running" ? formatDuration(runElapsedMs(run, now)) : "—"}
                    </span>
                    <Button onClick={() => onCancelRun(run.id)} title="Cancel run">
                      <Ban size={12} />
                    </Button>
                  </div>
                  <div className="mt-2">
                    <Meter value={runProgress(run, now)} tone={STATUS_META[run.status].color} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {scheduled.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
            <CalendarClock size={13} strokeWidth={1.75} /> Schedules
          </h3>
          <ul className="space-y-1">
            {scheduled.map((agent) => {
              const next = (agent.schedule.lastRunAt ?? 0) + agent.schedule.everyMinutes * 60_000;
              const dueIn = next - now;
              return (
                <li key={agent.id} className="flex items-center gap-2 text-[12px]">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: agent.color }} />
                  <span className="font-medium">{agent.name}</span>
                  <span className="truncate" style={{ color: "var(--text-secondary)" }}>
                    every {agent.schedule.everyMinutes}m — {agent.schedule.task || "no task set"}
                  </span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
                    {dueIn <= 0 ? "due now" : `in ${formatDuration(dueIn)}`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
          <Radio size={13} strokeWidth={1.75} /> Recent activity
        </h3>
        {activity.length === 0 ? (
          <EmptyState icon={<Radio size={22} strokeWidth={1.5} />} title="No activity recorded yet" />
        ) : (
          <ul className="space-y-1 font-mono text-[11px]">
            {activity.map((e) => (
              <li key={e.id} className="flex gap-2">
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {formatRelativeTime(e.ts, now)}
                </span>
                <button
                  onClick={() => onOpenRun(e.run.id)}
                  className="shrink-0 hover:underline"
                  style={{ color: e.run.agentColor }}
                >
                  {e.run.agentName}
                </button>
                <span className="min-w-0 truncate" style={{ color: "var(--text-secondary)" }}>
                  {e.message}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

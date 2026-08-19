"use client";

import { useMemo, useState } from "react";
import { ListChecks, Search } from "lucide-react";
import { isActive, runProgress } from "@/lib/agents/engine";
import type { AgentRun, RunStatus } from "@/lib/agents/types";
import { formatRelativeTime } from "@/lib/utils/format";
import RunDetail from "./RunDetail";
import { AgentGlyph, Chip, EmptyState, Meter, StatusBadge, STATUS_META, inputClass, inputStyle } from "./parts";

type Filter = "all" | "active" | RunStatus;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active" },
  { id: "succeeded", label: "Succeeded" },
  { id: "failed", label: "Failed" },
  { id: "cancelled", label: "Cancelled" },
];

function matches(run: AgentRun, filter: Filter) {
  if (filter === "all") return true;
  if (filter === "active") return isActive(run);
  return run.status === filter;
}

export default function RunsPane({
  runs,
  now,
  selectedRunId,
  onSelect,
  onCancel,
  onRetry,
  onDelete,
}: {
  runs: AgentRun[];
  now: number;
  selectedRunId: string | null;
  onSelect: (id: string) => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter(
      (r) => matches(r, filter) && (!q || r.task.toLowerCase().includes(q) || r.agentName.toLowerCase().includes(q))
    );
  }, [runs, filter, query]);

  // Fall back to the newest visible run so the detail pane is never blank for no reason.
  const selected = visible.find((r) => r.id === selectedRunId) ?? visible[0];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-[286px] shrink-0 flex-col border-r" style={{ borderColor: "var(--glass-border)" }}>
        <div className="space-y-2 border-b p-2" style={{ borderColor: "var(--glass-border)" }}>
          <div className="relative">
            <Search
              size={13}
              className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2"
              style={{ color: "var(--text-muted)" }}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter runs"
              className={`${inputClass} pl-7`}
              style={inputStyle}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Chip
                key={f.id}
                onClick={() => setFilter(f.id)}
                active={filter === f.id}
                tone={f.id === "all" || f.id === "active" ? "var(--accent-primary)" : STATUS_META[f.id].color}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-1.5">
          {visible.length === 0 ? (
            <p className="p-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
              No runs match.
            </p>
          ) : (
            visible.map((run) => {
              const active = selected?.id === run.id;
              return (
                <button
                  key={run.id}
                  onClick={() => onSelect(run.id)}
                  className="mb-1 w-full rounded-md px-2 py-1.5 text-left"
                  style={{ background: active ? "color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "transparent" }}
                >
                  <div className="flex items-center gap-1.5">
                    <AgentGlyph iconKey={run.agentIconKey} color={run.agentColor} size={13} />
                    <span className="truncate text-[12px] font-medium">{run.agentName}</span>
                    <span className="ml-auto shrink-0">
                      <StatusBadge status={run.status} compact />
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-secondary)" }}>
                    {run.task}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                      {formatRelativeTime(run.createdAt, now)}
                    </span>
                    {isActive(run) && (
                      <span className="flex-1">
                        <Meter value={runProgress(run, now)} height={3} />
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        {selected ? (
          <RunDetail
            run={selected}
            now={now}
            onCancel={() => onCancel(selected.id)}
            onRetry={() => onRetry(selected.id)}
            onDelete={() => onDelete(selected.id)}
          />
        ) : (
          <EmptyState
            icon={<ListChecks size={26} strokeWidth={1.5} />}
            title="No runs yet"
            hint="Trigger one from the Agents tab, or press ⌘↵ to launch any agent against a task."
          />
        )}
      </div>
    </div>
  );
}

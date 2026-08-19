"use client";

import { actionsByConnector } from "@/lib/agents/actions";
import { CONNECTOR_SPECS } from "@/lib/agents/connectors";
import type { AgentRun, Connector } from "@/lib/agents/types";
import { formatRelativeTime } from "@/lib/utils/format";
import { AgentGlyph, Card, Chip, Toggle } from "./parts";

export default function ConnectorsPane({
  connectors,
  runs,
  now,
  onChange,
}: {
  connectors: Connector[];
  runs: AgentRun[];
  now: number;
  onChange: (id: string, patch: Partial<Connector>) => void;
}) {
  return (
    <div className="space-y-2.5 p-4">
      <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
        Connectors are how agents reach this machine. Every action declares the connector and the
        access it needs, and the runtime refuses it here — a disconnected or read-only connector
        stops the step, and the run says so.
      </p>

      {CONNECTOR_SPECS.map((spec) => {
        const state = connectors.find((c) => c.id === spec.id);
        const connected = state?.connected ?? false;
        const allowWrite = state?.allowWrite ?? false;
        const actions = actionsByConnector(spec.id);
        const denied = runs.filter((r) => r.error?.includes(`the ${spec.label} connector`)).length;

        return (
          <Card
            key={spec.id}
            tone={connected ? undefined : "color-mix(in srgb, var(--warning) 40%, transparent)"}
          >
            <div className="flex items-start gap-2">
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: connected
                    ? "color-mix(in srgb, var(--success) 18%, transparent)"
                    : "color-mix(in srgb, var(--warning) 18%, transparent)",
                }}
              >
                <AgentGlyph
                  iconKey={spec.iconKey}
                  size={16}
                  color={connected ? "var(--success)" : "var(--warning)"}
                />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold">{spec.label}</span>
                  <Chip tone={connected ? "var(--success)" : "var(--warning)"}>
                    {connected ? (allowWrite ? "read + write" : "read only") : "disconnected"}
                  </Chip>
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {spec.description}
                </div>
                <div className="mt-0.5 font-mono text-[10px]" style={{ color: "var(--text-muted)" }}>
                  {spec.surface}
                </div>
              </div>

              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Connected
                  <Toggle
                    checked={connected}
                    onChange={(v) => onChange(spec.id, { connected: v, allowWrite: v ? allowWrite : false })}
                    label={`Connect ${spec.label}`}
                  />
                </span>
                <span
                  className="flex items-center gap-1.5 text-[11px]"
                  style={{ color: connected ? "var(--text-secondary)" : "var(--text-muted)", opacity: connected ? 1 : 0.5 }}
                >
                  Allow writes
                  <Toggle
                    checked={allowWrite}
                    onChange={(v) => connected && onChange(spec.id, { allowWrite: v })}
                    label={`Allow ${spec.label} writes`}
                  />
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1">
              {actions.map((action) => (
                <Chip
                  key={action.id}
                  tone={action.scope === "write" ? "var(--warning)" : undefined}
                  title={`${action.description} (${action.scope})`}
                >
                  {action.label}
                </Chip>
              ))}
            </div>

            <div className="mt-2 text-[11px] tabular-nums" style={{ color: "var(--text-muted)" }}>
              {state?.calls ?? 0} call{(state?.calls ?? 0) === 1 ? "" : "s"}
              {state?.lastUsedAt ? ` · last used ${formatRelativeTime(state.lastUsedAt, now)}` : " · never used"}
              {denied > 0 && ` · ${denied} run${denied === 1 ? "" : "s"} blocked by this connector`}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

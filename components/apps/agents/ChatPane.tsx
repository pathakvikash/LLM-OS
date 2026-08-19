"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Ban, Check, MessagesSquare, Pencil, Plus, Trash2 } from "lucide-react";
import { isActive, runProgress } from "@/lib/agents/engine";
import { routeMessage } from "@/lib/agents/orchestrator";
import { stripPleasantries } from "@/lib/agents/conversation";
import type { AgentDefinition, AgentRun, ChatSession, Skill } from "@/lib/agents/types";
import { formatClockTime, formatDuration, formatRelativeTime } from "@/lib/utils/format";
import { runElapsedMs } from "@/lib/agents/engine";
import { AgentGlyph, Button, Chip, EmptyState, Meter, StatusBadge, STATUS_META, inputClass, inputStyle } from "./parts";

/** One dispatched run, rendered live inside the conversation. */
function RunCard({
  run,
  now,
  onOpen,
  onCancel,
}: {
  run: AgentRun;
  now: number;
  onOpen: () => void;
  onCancel: () => void;
}) {
  const tone = STATUS_META[run.status].color;
  const done = run.steps.filter((s) => s.status !== "pending" && s.status !== "running").length;

  return (
    <div
      className="rounded-(--radius-sm) border p-2.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
    >
      <div className="flex items-center gap-1.5">
        <AgentGlyph iconKey={run.agentIconKey} color={run.agentColor} size={13} />
        <button onClick={onOpen} className="text-[12px] font-medium hover:underline">
          {run.agentName}
        </button>
        <Chip tone="var(--accent-secondary)">{run.skillName}</Chip>
        <span className="ml-auto flex items-center gap-1.5">
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text-muted)" }}>
            {done}/{run.steps.length} · {formatDuration(runElapsedMs(run, now))}
          </span>
          <StatusBadge status={run.status} />
          {isActive(run) && (
            <Button onClick={onCancel} title="Cancel this run">
              <Ban size={11} />
            </Button>
          )}
        </span>
      </div>

      <div className="mt-2">
        <Meter value={runProgress(run, now)} tone={tone} />
      </div>

      <ol className="mt-2 space-y-0.5">
        {run.steps.map((step, i) => (
          <li key={step.id} className="flex gap-1.5 text-[11px]">
            <span className="w-3 shrink-0 tabular-nums" style={{ color: "var(--text-muted)" }}>
              {i + 1}
            </span>
            <span
              className="min-w-0"
              style={{
                color:
                  step.status === "pending"
                    ? "var(--text-muted)"
                    : step.status === "failed"
                      ? "var(--danger)"
                      : "var(--text-secondary)",
              }}
            >
              {step.name}
              {step.result && ` — ${step.result}`}
              {step.error && ` — ${step.error}`}
            </span>
          </li>
        ))}
      </ol>

      {run.error && (
        <p className="mt-1.5 text-[11px]" style={{ color: "var(--danger)" }}>
          {run.error}
        </p>
      )}
    </div>
  );
}

function replyFor(runs: AgentRun[]): string | null {
  if (runs.length === 0 || runs.some(isActive)) return null;
  const failed = runs.filter((r) => r.status === "failed");
  const cancelled = runs.filter((r) => r.status === "cancelled");
  const done = runs.filter((r) => r.status === "succeeded");

  const parts: string[] = [];
  if (done.length > 0) {
    const actions = done.flatMap((r) => r.steps.filter((s) => s.status === "done").length);
    parts.push(`Done — ${actions.reduce((a, b) => a + b, 0)} actions across ${done.length} run${done.length === 1 ? "" : "s"}.`);
  }
  if (failed.length > 0) parts.push(`${failed.length} failed: ${failed.map((r) => r.error).join(" · ")}`);
  if (cancelled.length > 0) parts.push(`${cancelled.length} cancelled.`);
  return parts.join(" ");
}

export default function ChatPane({
  appNames,
  sessions,
  activeSessionId,
  runs,
  agents,
  skills,
  now,
  onSend,
  onNewSession,
  onSelectSession,
  onRenameSession,
  onDeleteSession,
  onOpenRun,
  onCancelRun,
}: {
  appNames: string[];
  sessions: ChatSession[];
  activeSessionId: string | null;
  runs: AgentRun[];
  agents: AgentDefinition[];
  skills: Skill[];
  now: number;
  onSend: (text: string) => void;
  onNewSession: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, title: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenRun: (id: string) => void;
  onCancelRun: (id: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const active = sessions.find((s) => s.id === activeSessionId);
  const chat = active?.messages ?? [];
  const lastKey = `${active?.id ?? ""}:${chat.length}:${runs.filter(isActive).length}`;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lastKey]);

  // Preview of where the message would go, shown under the composer as you type.
  const request = stripPleasantries(draft.trim());
  const preview = draft.trim() ? routeMessage(request || draft.trim(), agents, skills, appNames) : null;
  const routed = Boolean(request) && (preview?.assignments.length ?? 0) > 0;

  function send() {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-44 shrink-0 flex-col border-r" style={{ borderColor: "var(--glass-border)" }}>
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-[11px] font-semibold" style={{ color: "var(--text-secondary)" }}>
            Sessions
          </span>
          <Button onClick={onNewSession} title="Start a new session">
            <Plus size={12} />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-2">
          {sessions.length === 0 ? (
            <p className="px-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              No sessions yet — send a message to start one.
            </p>
          ) : (
            sessions.map((session) => {
              const selected = session.id === activeSessionId;
              const renaming = renamingId === session.id;
              return (
                <div
                  key={session.id}
                  className="group mb-1 rounded-md px-2 py-1.5"
                  style={{
                    background: selected ? "color-mix(in srgb, var(--accent-primary) 20%, transparent)" : "transparent",
                  }}
                >
                  {renaming ? (
                    <div className="flex items-center gap-1">
                      <input
                        autoFocus
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onRenameSession(session.id, renameDraft);
                            setRenamingId(null);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        className={`${inputClass} px-1.5 py-0.5 text-[11px]`}
                        style={inputStyle}
                      />
                      <Button
                        onClick={() => {
                          onRenameSession(session.id, renameDraft);
                          setRenamingId(null);
                        }}
                        title="Save name"
                      >
                        <Check size={11} />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectSession(session.id)}
                        className="block w-full truncate text-left text-[12px]"
                      >
                        {session.title}
                      </button>
                      <div className="mt-0.5 flex items-center gap-1">
                        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                          {session.messages.length} msg · {formatRelativeTime(session.updatedAt, now)}
                        </span>
                        <span className="ml-auto flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setRenamingId(session.id);
                              setRenameDraft(session.title);
                            }}
                            aria-label="Rename session"
                            className="rounded p-0.5"
                          >
                            <Pencil size={10} style={{ color: "var(--text-muted)" }} />
                          </button>
                          <button
                            onClick={() => onDeleteSession(session.id)}
                            aria-label="Delete session"
                            className="rounded p-0.5"
                          >
                            <Trash2 size={10} style={{ color: "var(--danger)" }} />
                          </button>
                        </span>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {chat.length === 0 ? (
          <EmptyState
            icon={<MessagesSquare size={26} strokeWidth={1.5} />}
            title="Ask for something and the orchestrator picks the agent"
            hint="Try: “open Terminal and run ls”, “tidy my documents”, or “switch to light mode with a purple accent”. Follow-ups can say “it” — the last run's file or app carries over."
          />
        ) : (
          chat.map((message) => {
            const dispatched = (message.runIds ?? [])
              .map((id) => runs.find((r) => r.id === id))
              .filter((r): r is AgentRun => Boolean(r));
            const reply = replyFor(dispatched);

            return (
              <div key={message.id} className="space-y-2">
                {message.role === "user" ? (
                  <div className="flex justify-end">
                    <div
                      className="max-w-[80%] rounded-(--radius-sm) px-3 py-2 text-[12px]"
                      style={{ background: "var(--accent-primary)", color: "white" }}
                    >
                      {message.text}
                      <div className="mt-0.5 text-[10px] opacity-70">{formatClockTime(message.ts)}</div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-(--radius-sm) border border-dashed px-3 py-2 text-[11px] whitespace-pre-line"
                    style={{ borderColor: "var(--glass-border)", color: "var(--text-secondary)" }}
                  >
                    {message.text}
                  </div>
                )}

                {dispatched.length > 0 && (
                  <div className="space-y-1.5">
                    {dispatched.length > 1 && (
                      <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                        Delegated to {dispatched.map((r) => r.agentName).join(", ")}
                      </div>
                    )}
                    {dispatched.map((run) => (
                      <RunCard
                        key={run.id}
                        run={run}
                        now={now}
                        onOpen={() => onOpenRun(run.id)}
                        onCancel={() => onCancelRun(run.id)}
                      />
                    ))}
                    {reply && (
                      <div className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
                        {reply}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 border-t p-3" style={{ borderColor: "var(--glass-border)" }}>
        {preview && (
          <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px]" style={{ color: "var(--text-muted)" }}>
            {routed ? (
              <>
                Routes to:
                {preview.assignments.map((a, i) => (
                  <Chip key={i} tone={a.agent.color}>
                    {a.agent.name} · {a.skill.name}
                  </Chip>
                ))}
              </>
            ) : (
              <span>I&apos;ll answer this one myself — no agent needed.</span>
            )}
            {preview.unroutable.length > 0 && routed && (
              <span style={{ color: "var(--warning)" }}>· unhandled: {preview.unroutable.join(" · ")}</span>
            )}
          </div>
        )}

        <div className="flex items-end gap-1.5">
          <textarea
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Tell the fleet what to do…"
            className={`${inputClass} resize-none font-[inherit]`}
            style={inputStyle}
          />
          <Button variant="primary" onClick={send} disabled={!draft.trim()} title="Send (Enter)">
            <ArrowUp size={13} strokeWidth={2.5} />
          </Button>
        </div>
      </div>
      </div>
    </div>
  );
}

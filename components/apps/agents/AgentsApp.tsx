"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bot,
  LayoutDashboard,
  MessagesSquare,
  ListChecks,
  Pause,
  Play,
  Plug,
  Plus,
  ScrollText,
  SlidersHorizontal,
  Wrench,
} from "lucide-react";
import { getAllApps, type WindowAppProps } from "@/lib/apps/registry";
import { useMenuCommand } from "@/lib/commands/menuBus";
import { useWindowStore } from "@/stores/useWindowStore";
import { useAgentStore } from "@/stores/useAgentStore";
import { cn } from "@/lib/utils/cn";
import { isActive } from "@/lib/agents/engine";
import type { AgentDefinition, Skill } from "@/lib/agents/types";
import AgentEditor from "./AgentEditor";
import AgentsPane from "./AgentsPane";
import FleetSettingsPane from "./FleetSettingsPane";
import LaunchDialog from "./LaunchDialog";
import ChatPane from "./ChatPane";
import OverviewPane from "./OverviewPane";
import PromptPane from "./PromptPane";
import RunsPane from "./RunsPane";
import SkillEditor from "./SkillEditor";
import SkillsPane from "./SkillsPane";
import ConnectorsPane from "./ConnectorsPane";
import { Button, useNow } from "./parts";

type SectionId =
  | "chat"
  | "overview"
  | "runs"
  | "agents"
  | "skills"
  | "connectors"
  | "prompt"
  | "settings";

interface SectionDefinition {
  id: SectionId;
  label: string;
  icon: typeof Bot;
  blurb: string;
  /** The count shown beside the label, if this section has one to show. */
  badge?: (state: {
    activeRuns: number;
    agents: number;
    skills: number;
    connectedConnectors: number;
  }) => number;
}

const SECTIONS: SectionDefinition[] = [
  { id: "chat", label: "Chat", icon: MessagesSquare, blurb: "Ask, and the orchestrator picks the agent" },
  { id: "overview", label: "Overview", icon: LayoutDashboard, blurb: "Fleet health, live runs, and activity" },
  {
    id: "runs",
    label: "Runs",
    icon: ListChecks,
    blurb: "Every run, its steps, and its output",
    badge: (s) => s.activeRuns,
  },
  {
    id: "agents",
    label: "Agents",
    icon: Bot,
    blurb: "Configure who can be triggered, and how",
    badge: (s) => s.agents,
  },
  {
    id: "skills",
    label: "Skills",
    icon: Wrench,
    blurb: "The recipes that turn a task into real actions",
    badge: (s) => s.skills,
  },
  {
    id: "connectors",
    label: "Connectors",
    icon: Plug,
    blurb: "What agents may reach on this machine, and how far",
    badge: (s) => s.connectedConnectors,
  },
  { id: "prompt", label: "Prompt", icon: ScrollText, blurb: "The fleet brief every agent inherits" },
  { id: "settings", label: "Fleet", icon: SlidersHorizontal, blurb: "Concurrency, pausing, and history" },
];

export default function AgentsApp({ windowId }: WindowAppProps) {
  const agents = useAgentStore((s) => s.agents);
  const runs = useAgentStore((s) => s.runs);
  const skills = useAgentStore((s) => s.skills);
  const connectors = useAgentStore((s) => s.connectors);
  const systemPrompt = useAgentStore((s) => s.systemPrompt);
  const sessions = useAgentStore((s) => s.sessions);
  const activeSessionId = useAgentStore((s) => s.activeSessionId);
  const maxConcurrent = useAgentStore((s) => s.maxConcurrent);
  const fleetPaused = useAgentStore((s) => s.fleetPaused);

  const [section, setSection] = useState<SectionId>("chat");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [launchAgentId, setLaunchAgentId] = useState<string | null>(null);
  const [launchSkillId, setLaunchSkillId] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);
  const [editorAgent, setEditorAgent] = useState<AgentDefinition | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [skillEditorSkill, setSkillEditorSkill] = useState<Skill | null>(null);
  const [skillEditorOpen, setSkillEditorOpen] = useState(false);

  const isFocused = useWindowStore((s) => s.focusedWindowId === windowId);
  const modalOpen = launchOpen || editorOpen || skillEditorOpen;

  // Menu-bar shortcuts elsewhere in the OS are decorative; this one is real, and
  // only while this window has focus and nothing is already in front of it.
  useEffect(() => {
    if (!isFocused || modalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        setLaunchAgentId(null);
        setLaunchSkillId(null);
        setLaunchOpen(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFocused, modalOpen]);

  const activeCount = runs.filter(isActive).length;
  const runningCount = runs.filter((r) => r.status === "running").length;
  // Fast tick while work is in flight; a slow one keeps relative times honest.
  const now = useNow(true, activeCount > 0 ? 250 : 5000);

  const openLaunch = useCallback((agentId?: string, skillId?: string) => {
    setLaunchAgentId(agentId ?? null);
    setLaunchSkillId(skillId ?? null);
    setLaunchOpen(true);
  }, []);

  const openSkillEditor = useCallback((skill?: Skill) => {
    setSkillEditorSkill(skill ?? null);
    setSkillEditorOpen(true);
  }, []);

  const openEditor = useCallback((agent?: AgentDefinition) => {
    setEditorAgent(agent ?? null);
    setEditorOpen(true);
  }, []);

  const showRun = useCallback((id: string) => {
    setSelectedRunId(id);
    setSection("runs");
  }, []);

  useMenuCommand(
    windowId,
    useCallback(
      (commandId: string) => {
        const store = useAgentStore.getState();
        switch (commandId) {
          case "agents:new-run":
            openLaunch();
            break;
          case "agents:new-agent":
            openEditor();
            break;
          case "agents:new-skill":
            openSkillEditor();
            break;
          case "agents:toggle-pause":
            store.setFleetPaused(!store.fleetPaused);
            break;
          case "agents:cancel-all":
            store.cancelActiveRuns();
            break;
          case "agents:clear-finished":
            store.clearFinishedRuns();
            break;
          case "agents:clear-chat":
            store.clearChat();
            break;
          case "agents:new-chat":
            store.newChatSession();
            setSection("chat");
            break;
        }
      },
      [openLaunch, openEditor, openSkillEditor]
    )
  );

  const active = SECTIONS.find((s) => s.id === section) ?? SECTIONS[0];
  const badgeCounts = {
    activeRuns: activeCount,
    agents: agents.length,
    skills: skills.length,
    connectedConnectors: connectors.filter((c) => c.connected).length,
  };

  return (
    <div className="relative flex h-full min-h-0">
      <nav
        className="flex w-44 shrink-0 flex-col border-r p-2"
        style={{ borderColor: "var(--glass-border)" }}
      >
        {SECTIONS.map((s) => {
          const selected = s.id === section;
          const badge = s.badge?.(badgeCounts) ?? 0;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
              style={{
                background: selected ? "var(--accent-primary)" : "transparent",
                color: selected ? "white" : "var(--text-secondary)",
              }}
            >
              <s.icon size={15} strokeWidth={1.75} />
              {s.label}
              {badge > 0 && (
                <span
                  className="ml-auto rounded-full px-1.5 text-[10px] tabular-nums"
                  style={{
                    background: selected ? "rgba(255,255,255,0.25)" : "var(--glass-bg)",
                    color: selected ? "white" : "var(--text-muted)",
                  }}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}

        <div className="mt-auto px-2 pt-2 text-[11px]" style={{ color: "var(--text-muted)" }}>
          <div className="flex items-center gap-1.5">
            <span
              className={`h-1.5 w-1.5 rounded-full ${runningCount > 0 && !fleetPaused ? "animate-pulse" : ""}`}
              style={{
                background: fleetPaused
                  ? "var(--warning)"
                  : runningCount > 0
                    ? "var(--success)"
                    : "var(--text-muted)",
              }}
            />
            {fleetPaused ? "Fleet paused" : runningCount > 0 ? `${runningCount} running` : "Idle"}
          </div>
          <div className="mt-0.5">{runs.length} runs tracked</div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{active.label}</div>
            <div className="truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
              {active.blurb}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <Button
              onClick={() => useAgentStore.getState().setFleetPaused(!fleetPaused)}
              title={fleetPaused ? "Resume the fleet" : "Pause the fleet"}
            >
              {fleetPaused ? <Play size={12} /> : <Pause size={12} />}
              {fleetPaused ? "Resume" : "Pause"}
            </Button>
            <Button onClick={() => openEditor()}>
              <Plus size={12} /> Agent
            </Button>
            <Button variant="primary" onClick={() => openLaunch()}>
              <Play size={12} strokeWidth={2.5} /> Trigger run
            </Button>
          </div>
        </header>

        <div className={cn("min-h-0 flex-1", section === "chat" ? "overflow-hidden" : "overflow-auto")}>
          {section === "chat" && (
            <ChatPane
              appNames={getAllApps().map((a) => a.name)}
              sessions={sessions}
              activeSessionId={activeSessionId}
              runs={runs}
              agents={agents}
              skills={skills}
              now={now}
              onSend={(text) => useAgentStore.getState().sendChatMessage(text)}
              onNewSession={() => useAgentStore.getState().newChatSession()}
              onSelectSession={(id) => useAgentStore.getState().selectChatSession(id)}
              onRenameSession={(id, title) => useAgentStore.getState().renameChatSession(id, title)}
              onDeleteSession={(id) => useAgentStore.getState().deleteChatSession(id)}
              onOpenRun={showRun}
              onCancelRun={(id) => useAgentStore.getState().cancelRun(id)}
            />
          )}

          {section === "overview" && (
            <OverviewPane
              runs={runs}
              agents={agents}
              maxConcurrent={maxConcurrent}
              now={now}
              onOpenRun={showRun}
              onCancelRun={(id) => useAgentStore.getState().cancelRun(id)}
            />
          )}

          {section === "runs" && (
            <RunsPane
              runs={runs}
              now={now}
              selectedRunId={selectedRunId}
              onSelect={setSelectedRunId}
              onCancel={(id) => useAgentStore.getState().cancelRun(id)}
              onRetry={(id) => {
                const newId = useAgentStore.getState().retryRun(id);
                if (newId) setSelectedRunId(newId);
              }}
              onDelete={(id) => {
                useAgentStore.getState().deleteRun(id);
                setSelectedRunId((current) => (current === id ? null : current));
              }}
            />
          )}

          {section === "agents" && (
            <AgentsPane
              agents={agents}
              runs={runs}
              skills={skills}
              onLaunch={(agentId) => openLaunch(agentId)}
              onEdit={(agent) => openEditor(agent)}
              onDuplicate={(id) => useAgentStore.getState().duplicateAgent(id)}
              onDelete={(id) => useAgentStore.getState().deleteAgent(id)}
              onToggle={(id, enabled) => useAgentStore.getState().updateAgent(id, { enabled })}
            />
          )}

          {section === "skills" && (
            <SkillsPane
              skills={skills}
              agents={agents}
              runs={runs}
              now={now}
              onNew={() => openSkillEditor()}
              onEdit={(skill) => openSkillEditor(skill)}
              onDuplicate={(id) => useAgentStore.getState().duplicateSkill(id)}
              onDelete={(id) => useAgentStore.getState().deleteSkill(id)}
              onToggle={(id, enabled) => useAgentStore.getState().updateSkill(id, { enabled })}
              onRun={(skill) => {
                // Prefer an agent that already has the skill; otherwise force it.
                const owner =
                  agents.find((a) => a.enabled && a.skills.includes(skill.id)) ??
                  agents.find((a) => a.enabled) ??
                  agents[0];
                openLaunch(owner?.id, skill.id);
              }}
            />
          )}

          {section === "connectors" && (
            <ConnectorsPane
              connectors={connectors}
              runs={runs}
              now={now}
              onChange={(id, patch) => useAgentStore.getState().setConnector(id, patch)}
            />
          )}

          {section === "prompt" && (
            <PromptPane
              systemPrompt={systemPrompt}
              agents={agents}
              skills={skills}
              connectors={connectors}
              onChange={(prompt) => useAgentStore.getState().setSystemPrompt(prompt)}
              onReset={() => useAgentStore.getState().resetSystemPrompt()}
            />
          )}

          {section === "settings" && (
            <FleetSettingsPane
              runs={runs}
              maxConcurrent={maxConcurrent}
              fleetPaused={fleetPaused}
              onSetMaxConcurrent={(n) => useAgentStore.getState().setMaxConcurrent(n)}
              onSetFleetPaused={(v) => useAgentStore.getState().setFleetPaused(v)}
              onCancelActive={() => useAgentStore.getState().cancelActiveRuns()}
              onClearFinished={() => useAgentStore.getState().clearFinishedRuns()}
              onResetAgents={() => useAgentStore.getState().resetAgents()}
              onResetSkills={() => useAgentStore.getState().resetSkills()}
            />
          )}
        </div>
      </div>

      {launchOpen && (
        <LaunchDialog
          agents={agents}
          skills={skills}
          appNames={getAllApps().map((a) => a.name)}
          defaultAgentId={launchAgentId ?? undefined}
          forcedSkillId={launchSkillId ?? undefined}
          onClose={() => setLaunchOpen(false)}
          onLaunch={(agentId, task, count, skillId) => {
            const store = useAgentStore.getState();
            let lastId: string | null = null;
            for (let i = 0; i < count; i++) {
              lastId = store.launchRun({ agentId, task, skillId });
            }
            if (lastId) showRun(lastId);
          }}
        />
      )}

      {editorOpen && (
        <AgentEditor
          agent={editorAgent ?? undefined}
          skills={skills}
          onClose={() => setEditorOpen(false)}
          onSave={(draft) => {
            const store = useAgentStore.getState();
            if (editorAgent) store.updateAgent(editorAgent.id, draft);
            else store.createAgent(draft);
          }}
        />
      )}

      {skillEditorOpen && (
        <SkillEditor
          skill={skillEditorSkill ?? undefined}
          agents={agents}
          onClose={() => setSkillEditorOpen(false)}
          onSave={(draft, agentIds) => {
            const store = useAgentStore.getState();
            const id = skillEditorSkill
              ? (store.updateSkill(skillEditorSkill.id, draft), skillEditorSkill.id)
              : store.createSkill(draft);
            store.setSkillAgents(id, agentIds);
          }}
        />
      )}
    </div>
  );
}

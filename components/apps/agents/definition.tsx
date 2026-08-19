import { Sparkles } from "lucide-react";
import type { AppDefinition, MenuDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import AgentsApp from "./AgentsApp";

const FILE_MENU: MenuDefinition = {
  label: "File",
  items: [
    { label: "Trigger Run…", shortcut: "⌘↵", commandId: "agents:new-run" },
    { label: "New Agent…", commandId: "agents:new-agent" },
    { label: "New Skill…", commandId: "agents:new-skill" },
    { label: "divider", separator: true },
    { label: "New Chat Session", commandId: "agents:new-chat" },
    { label: "Clear Chat Session", commandId: "agents:clear-chat" },
  ],
};

const FLEET_MENU: MenuDefinition = {
  label: "Fleet",
  items: [
    { label: "Pause / Resume Fleet", commandId: "agents:toggle-pause" },
    { label: "Cancel Active Runs", commandId: "agents:cancel-all" },
    { label: "divider", separator: true },
    { label: "Clear Finished Runs", commandId: "agents:clear-finished" },
  ],
};

export const agentsAppDefinition: AppDefinition = {
  id: "agents",
  name: "Agents",
  icon: Sparkles,
  component: AgentsApp,
  defaultSize: { width: 900, height: 600 },
  minSize: { width: 660, height: 420 },
  singleton: true,
  menus: withDefaultMenus([FILE_MENU, FLEET_MENU]),
  showInDock: true,
  showInSpotlight: true,
};

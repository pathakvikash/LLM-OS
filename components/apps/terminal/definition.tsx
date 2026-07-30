import { SquareTerminal } from "lucide-react";
import type { AppDefinition, MenuDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import TerminalApp from "./TerminalApp";

const SHELL_MENU: MenuDefinition = {
  label: "Shell",
  items: [{ label: "Clear", shortcut: "⌘K", commandId: "terminal:clear" }],
};

export const terminalAppDefinition: AppDefinition = {
  id: "terminal",
  name: "Terminal",
  icon: SquareTerminal,
  component: TerminalApp,
  defaultSize: { width: 620, height: 400 },
  minSize: { width: 360, height: 240 },
  menus: withDefaultMenus([SHELL_MENU]),
  showInDock: true,
  showInSpotlight: true,
};

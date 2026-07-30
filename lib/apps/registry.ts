import type { ComponentType } from "react";

export interface WindowAppProps {
  windowId: string;
}

export interface MenuItemDefinition {
  label: string;
  shortcut?: string;
  separator?: boolean;
  disabled?: boolean;
  /** Handled centrally by MenuBar against the window store. */
  actionType?: "minimize" | "maximize" | "close";
  /** Dispatched to whichever app instance owns the focused window; see lib/commands/menuBus.ts */
  commandId?: string;
}

export interface MenuDefinition {
  label: string;
  items: MenuItemDefinition[];
}

export interface AppIconProps {
  size?: number;
  strokeWidth?: number;
  style?: React.CSSProperties;
  className?: string;
}

export interface AppDefinition {
  id: string;
  name: string;
  icon: ComponentType<AppIconProps>;
  component: ComponentType<WindowAppProps>;
  defaultSize: { width: number; height: number };
  minSize?: { width: number; height: number };
  singleton?: boolean;
  menus?: MenuDefinition[];
  showInDock?: boolean;
  showInSpotlight?: boolean;
}

const WINDOW_MENU: MenuDefinition = {
  label: "Window",
  items: [
    { label: "Minimize", shortcut: "⌘M", actionType: "minimize" },
    { label: "Zoom", actionType: "maximize" },
    { label: "divider", separator: true },
    { label: "Close Window", shortcut: "⌘W", actionType: "close" },
  ],
};

const HELP_MENU: MenuDefinition = {
  label: "Help",
  items: [{ label: "About this app", disabled: true }],
};

export function withDefaultMenus(customMenus: MenuDefinition[] = []): MenuDefinition[] {
  return [...customMenus, WINDOW_MENU, HELP_MENU];
}

const registry = new Map<string, AppDefinition>();

export function registerApp(app: AppDefinition) {
  registry.set(app.id, app);
}

export function getApp(id: string): AppDefinition | undefined {
  return registry.get(id);
}

export function getAllApps(): AppDefinition[] {
  return Array.from(registry.values());
}

export function getDockApps(): AppDefinition[] {
  return getAllApps().filter((app) => app.showInDock !== false);
}

export function getSpotlightApps(): AppDefinition[] {
  return getAllApps().filter((app) => app.showInSpotlight !== false);
}

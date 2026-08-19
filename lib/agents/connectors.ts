import type { Connector } from "./types";

/**
 * Connectors are the agents' access to the running OS. Each one wraps a real
 * subsystem, and every action declares which connector and scope it needs, so
 * revoking write on "files" genuinely stops agents from touching the disk.
 */
export interface ConnectorSpec {
  id: string;
  label: string;
  iconKey: string;
  description: string;
  /** What the connector reaches, shown in the Connectors tab. */
  surface: string;
}

export const CONNECTOR_SPECS: ConnectorSpec[] = [
  {
    id: "files",
    label: "Files",
    iconKey: "folder",
    description: "The virtual filesystem shared by Finder, Terminal, and Spotlight.",
    surface: "IndexedDB · lib/fs/vfs",
  },
  {
    id: "apps",
    label: "Apps & Windows",
    iconKey: "window",
    description: "Launch, focus, and close app windows on the desktop.",
    surface: "Window manager · app registry",
  },
  {
    id: "settings",
    label: "System Settings",
    iconKey: "sliders",
    description: "Appearance, accent colour, wallpaper, and Dock size.",
    surface: "Theme + Dock stores",
  },
  {
    id: "fleet",
    label: "Agent Fleet",
    iconKey: "sparkles",
    description:
      "The agent roster itself — create agents and set the prompts they work from. This is how the fleet extends itself.",
    surface: "Agent store",
  },
  {
    id: "shell",
    label: "Shell",
    iconKey: "terminal",
    description:
      "Run Terminal commands against the same filesystem. Reading (ls, cat, pwd) needs read access; anything that creates, moves, or deletes needs write.",
    surface: "Terminal command registry",
  },
];

export function getConnectorSpec(id: string): ConnectorSpec | undefined {
  return CONNECTOR_SPECS.find((c) => c.id === id);
}

export const DEFAULT_CONNECTORS: Connector[] = CONNECTOR_SPECS.map((spec) => ({
  id: spec.id,
  connected: true,
  // Reading is on by default; writing to the shell is opt-in since it can delete.
  allowWrite: spec.id !== "shell",
  calls: 0,
}));

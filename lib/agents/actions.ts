"use client";

import {
  ROOT_ID,
  getChildByName,
  getPath,
  list,
  mkdir,
  mv,
  resolvePath,
  rm,
  updateContent,
  writeFile,
  type FSNode,
} from "@/lib/fs/vfs";
import { COMMANDS } from "@/components/apps/terminal/commands";
import { getAllApps } from "@/lib/apps/registry";
import { useWindowStore } from "@/stores/useWindowStore";
import { useThemeStore, type Appearance } from "@/stores/useThemeStore";
import { useDockStore } from "@/stores/useDockStore";
import { WALLPAPERS } from "@/lib/theme/wallpapers";
import { emitTerminalActivity } from "@/lib/commands/terminalBus";
import { fleetOps } from "./fleetOps";
import type { Scope } from "./types";

/**
 * The actions an agent can actually perform on this OS. Every one of these
 * touches real state — the Dexie filesystem, the window manager, the theme and
 * Dock stores, or the Terminal's command registry — so a run changes the
 * desktop the same way a person clicking around would.
 */

export interface ActionParamSpec {
  name: string;
  label: string;
  placeholder?: string;
  optional?: boolean;
  multiline?: boolean;
}

export interface ActionResult {
  /** One-line summary written to the run log and the step row. */
  summary: string;
  /** Exported into the run context for later steps to interpolate. */
  vars?: Record<string, string>;
  /** Longer text folded into the run's final output. */
  detail?: string;
}

/** Who the run belongs to; only actions that surface in the UI need it. */
export interface ActionMeta {
  agentName: string;
}

export interface ActionSpec {
  id: string;
  label: string;
  connectorId: string;
  scope: Scope;
  description: string;
  params: ActionParamSpec[];
  /**
   * Narrows the declared scope for one invocation — `shell.run ls` only reads,
   * even though the same action can also delete. The gate uses this when present.
   */
  scopeFor?: (params: Record<string, string>) => Scope;
  /** Step label shown in the plan before the action has run. */
  describe: (params: Record<string, string>) => string;
  run: (params: Record<string, string>, meta?: ActionMeta) => Promise<ActionResult>;
}

const MAX_DETAIL = 1600;

function truncate(text: string, max = MAX_DETAIL) {
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} more characters)` : text;
}

function splitPath(path: string) {
  const clean = path.trim().replace(/\/+$/, "");
  const index = clean.lastIndexOf("/");
  return {
    parent: index <= 0 ? "/" : clean.slice(0, index),
    name: clean.slice(index + 1) || "untitled",
  };
}

async function mustResolve(path: string): Promise<FSNode> {
  const node = await resolvePath(ROOT_ID, path || "/");
  if (!node) throw new Error(`No such file or folder: ${path}`);
  return node;
}

/** Resolves a folder path, creating any missing segments along the way. */
async function ensureFolder(path: string): Promise<FSNode> {
  const parts = path.split("/").filter(Boolean);
  let node = (await resolvePath(ROOT_ID, "/"))!;
  for (const part of parts) {
    const existing = await getChildByName(node.id, part);
    if (existing && existing.type === "folder") {
      node = existing;
      continue;
    }
    if (existing) throw new Error(`${part} exists and is not a folder`);
    node = await mkdir(node.id, part);
  }
  return node;
}

async function readText(node: FSNode): Promise<string> {
  if (node.type !== "file") throw new Error(`${node.name} is a folder`);
  if (typeof node.content !== "string") throw new Error(`${node.name} is not a text file`);
  return node.content;
}

async function walk(folderId: string, prefix: string, out: { path: string; node: FSNode }[]) {
  for (const child of await list(folderId)) {
    const path = `${prefix === "/" ? "" : prefix}/${child.name}`;
    out.push({ path, node: child });
    if (child.type === "folder") await walk(child.id, path, out);
  }
}

function findApp(query: string) {
  const q = query.trim().toLowerCase();
  const apps = getAllApps();
  return (
    apps.find((a) => a.id === q || a.name.toLowerCase() === q) ??
    apps.find((a) => a.name.toLowerCase().startsWith(q)) ??
    apps.find((a) => q.includes(a.name.toLowerCase()))
  );
}

const NAMED_COLORS: Record<string, string> = {
  blue: "#007AFF",
  purple: "#5856D6",
  green: "#34C759",
  orange: "#FF9500",
  red: "#FF3B30",
  pink: "#FF2D55",
  teal: "#2DD4BF",
};

/** Terminal commands that only look at the filesystem. */
const READ_ONLY_COMMANDS = new Set(["ls", "cat", "pwd", "whoami", "date", "help", "clear", "echo"]);

function tokenize(line: string): string[] {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line))) tokens.push(match[1] ?? match[2] ?? match[3]);
  return tokens;
}

export const ACTIONS: ActionSpec[] = [
  // ---------------------------------------------------------------- files
  {
    id: "files.list",
    label: "List folder",
    connectorId: "files",
    scope: "read",
    description: "List the contents of a folder in the virtual filesystem.",
    params: [{ name: "path", label: "Folder path", placeholder: "/Documents" }],
    describe: (p) => `List ${p.path || "/"}`,
    run: async ({ path }) => {
      const folder = await mustResolve(path || "/");
      if (folder.type !== "folder") throw new Error(`${path} is not a folder`);
      const children = await list(folder.id);
      const names = children.map((c) => (c.type === "folder" ? `${c.name}/` : c.name));
      return {
        summary: `${children.length} item${children.length === 1 ? "" : "s"} in ${path || "/"}`,
        vars: {
          files: names.join(", "),
          count: String(children.length),
          firstFile: children.find((c) => c.type === "file")?.name ?? "",
        },
        detail: names.length ? `${path || "/"}\n${names.map((n) => `  ${n}`).join("\n")}` : undefined,
      };
    },
  },
  {
    id: "files.read",
    label: "Read file",
    connectorId: "files",
    scope: "read",
    description: "Read a text file and keep its contents for later steps.",
    params: [{ name: "path", label: "File path", placeholder: "/Documents/Welcome.txt" }],
    describe: (p) => `Read ${p.path || "a file"}`,
    run: async ({ path }) => {
      const node = await mustResolve(path);
      const text = await readText(node);
      return {
        summary: `Read ${path} (${text.length} chars)`,
        vars: { content: text, contentPath: path, lines: String(text.split("\n").length) },
        detail: truncate(text),
      };
    },
  },
  {
    id: "files.search",
    label: "Search files",
    connectorId: "files",
    scope: "read",
    description: "Find files whose name or contents match a query.",
    params: [{ name: "query", label: "Query", placeholder: "welcome" }],
    describe: (p) => `Search files for "${p.query || ""}"`,
    run: async ({ query }) => {
      const q = (query || "").trim().toLowerCase();
      if (!q) throw new Error("Search needs a query");
      const all: { path: string; node: FSNode }[] = [];
      await walk(ROOT_ID, "/", all);
      const hits = all.filter(
        ({ path, node }) =>
          path.toLowerCase().includes(q) ||
          (typeof node.content === "string" && node.content.toLowerCase().includes(q))
      );
      return {
        summary: `${hits.length} match${hits.length === 1 ? "" : "es"} for "${query}"`,
        vars: {
          matches: hits.map((h) => h.path).join(", "),
          matchCount: String(hits.length),
          firstMatch: hits.find((h) => h.node.type === "file")?.path ?? "",
        },
        detail: hits.length ? hits.map((h) => `  ${h.path}`).join("\n") : undefined,
      };
    },
  },
  {
    id: "files.write",
    label: "Write file",
    connectorId: "files",
    scope: "write",
    description: "Create or overwrite a text file, making parent folders as needed.",
    params: [
      { name: "path", label: "File path", placeholder: "/Documents/Reports/brief.md" },
      { name: "content", label: "Contents", multiline: true },
    ],
    describe: (p) => `Write ${p.path || "a file"}`,
    run: async ({ path, content }) => {
      const { parent, name } = splitPath(path);
      const folder = await ensureFolder(parent);
      const node = await writeFile(folder.id, name, content ?? "", "text/plain");
      return {
        summary: `Wrote ${await getPath(node.id)} (${node.size} bytes)`,
        vars: { writtenPath: await getPath(node.id) },
      };
    },
  },
  {
    id: "files.append",
    label: "Append to file",
    connectorId: "files",
    scope: "write",
    description: "Add text to the end of an existing file, creating it if missing.",
    params: [
      { name: "path", label: "File path" },
      { name: "content", label: "Text to append", multiline: true },
    ],
    describe: (p) => `Append to ${p.path || "a file"}`,
    run: async ({ path, content }) => {
      const existing = await resolvePath(ROOT_ID, path);
      if (existing && existing.type === "file") {
        const previous = typeof existing.content === "string" ? existing.content : "";
        const next = `${previous.replace(/\s*$/, "")}\n${content ?? ""}\n`;
        await updateContent(existing.id, next);
        return { summary: `Appended ${(content ?? "").length} chars to ${path}`, vars: { writtenPath: path } };
      }
      const { parent, name } = splitPath(path);
      const folder = await ensureFolder(parent);
      await writeFile(folder.id, name, `${content ?? ""}\n`, "text/plain");
      return { summary: `Created ${path} and wrote ${(content ?? "").length} chars`, vars: { writtenPath: path } };
    },
  },
  {
    id: "files.mkdir",
    label: "Create folder",
    connectorId: "files",
    scope: "write",
    description: "Create a folder, including any missing parents.",
    params: [{ name: "path", label: "Folder path", placeholder: "/Documents/Agent Reports" }],
    describe: (p) => `Create folder ${p.path || ""}`,
    run: async ({ path }) => {
      const folder = await ensureFolder(path);
      return { summary: `Folder ready at ${await getPath(folder.id)}`, vars: { folderPath: path } };
    },
  },
  {
    id: "files.move",
    label: "Move or rename",
    connectorId: "files",
    scope: "write",
    description: "Rename a file or folder, or move it into another folder.",
    params: [
      { name: "path", label: "Path to move" },
      { name: "to", label: "New name or destination folder" },
    ],
    describe: (p) => `Move ${p.path || ""} → ${p.to || ""}`,
    run: async ({ path, to }) => {
      const node = await mustResolve(path);
      const destination = await resolvePath(ROOT_ID, to);
      if (destination && destination.type === "folder") {
        await mv(node.id, destination.id);
        return { summary: `Moved ${path} into ${to}`, vars: { writtenPath: `${to.replace(/\/$/, "")}/${node.name}` } };
      }
      // Not an existing folder, so it is a new name (optionally with a path).
      const { parent, name } = splitPath(to);
      const parentNode = await ensureFolder(parent);
      await mv(node.id, parentNode.id, name);
      return { summary: `Renamed ${path} → ${name}`, vars: { writtenPath: await getPath(node.id) } };
    },
  },
  {
    id: "files.delete",
    label: "Delete path",
    connectorId: "files",
    scope: "write",
    description: "Delete a file, or a folder and everything inside it.",
    params: [{ name: "path", label: "Path to delete" }],
    describe: (p) => `Delete ${p.path || ""}`,
    run: async ({ path }) => {
      const node = await mustResolve(path);
      if (node.id === ROOT_ID) throw new Error("Refusing to delete the filesystem root");
      await rm(node.id, { recursive: true });
      return { summary: `Deleted ${path}` };
    },
  },

  // ----------------------------------------------------------------- apps
  {
    id: "apps.list",
    label: "List apps",
    connectorId: "apps",
    scope: "read",
    description: "Report which apps are installed and which windows are open.",
    params: [],
    describe: () => "Survey installed apps and open windows",
    run: async () => {
      const apps = getAllApps();
      const windows = Object.values(useWindowStore.getState().windows);
      const open = windows.map((w) => w.title);
      return {
        summary: `${apps.length} apps installed, ${windows.length} window${windows.length === 1 ? "" : "s"} open`,
        vars: {
          apps: apps.map((a) => a.name).join(", "),
          openWindows: open.join(", "),
          windowCount: String(windows.length),
        },
        detail: `Installed: ${apps.map((a) => a.name).join(", ")}\nOpen: ${open.join(", ") || "none"}`,
      };
    },
  },
  {
    id: "apps.open",
    label: "Open app",
    connectorId: "apps",
    scope: "write",
    description: "Open an app window on the desktop.",
    params: [{ name: "app", label: "App", placeholder: "Finder" }],
    describe: (p) => `Open ${p.app || "an app"}`,
    run: async ({ app }) => {
      const target = findApp(app ?? "");
      if (!target) throw new Error(`No installed app matches "${app}"`);
      // openNewWindow, not openWindow: the latter minimises an already-focused window.
      const id = useWindowStore.getState().openNewWindow(target.id);
      if (!id) throw new Error(`Could not open ${target.name}`);
      return { summary: `Opened ${target.name}`, vars: { openedApp: target.name, windowId: id } };
    },
  },
  {
    id: "apps.focus",
    label: "Focus app",
    connectorId: "apps",
    scope: "write",
    description: "Bring an app's window to the front, opening it if needed.",
    params: [{ name: "app", label: "App" }],
    describe: (p) => `Focus ${p.app || "an app"}`,
    run: async ({ app }) => {
      const target = findApp(app ?? "");
      if (!target) throw new Error(`No installed app matches "${app}"`);
      const store = useWindowStore.getState();
      const existing = Object.values(store.windows)
        .filter((w) => w.appId === target.id)
        .sort((a, b) => b.zIndex - a.zIndex)[0];
      if (existing) {
        store.restoreWindow(existing.id);
        return { summary: `Focused ${target.name}`, vars: { openedApp: target.name } };
      }
      store.openNewWindow(target.id);
      return { summary: `${target.name} was not open — opened it`, vars: { openedApp: target.name } };
    },
  },
  {
    id: "apps.close",
    label: "Close app",
    connectorId: "apps",
    scope: "write",
    description: "Close every open window belonging to an app.",
    params: [{ name: "app", label: "App" }],
    describe: (p) => `Close ${p.app || "an app"}`,
    run: async ({ app }) => {
      const target = findApp(app ?? "");
      if (!target) throw new Error(`No installed app matches "${app}"`);
      const store = useWindowStore.getState();
      const windows = Object.values(store.windows).filter((w) => w.appId === target.id);
      windows.forEach((w) => store.closeWindow(w.id));
      return { summary: `Closed ${windows.length} ${target.name} window${windows.length === 1 ? "" : "s"}` };
    },
  },

  // ------------------------------------------------------------- settings
  {
    id: "settings.read",
    label: "Read settings",
    connectorId: "settings",
    scope: "read",
    description: "Report the current appearance, accent, wallpaper, and Dock size.",
    params: [],
    describe: () => "Read system settings",
    run: async () => {
      const theme = useThemeStore.getState();
      const dock = useDockStore.getState();
      const summary = `${theme.appearance} appearance · accent ${theme.accent} · ${theme.wallpaperId} wallpaper · dock ${dock.iconSize}px`;
      return {
        summary,
        // Namespaced so observing the system never overwrites what the task asked for.
        vars: {
          currentAppearance: theme.appearance,
          currentAccent: theme.accent,
          currentWallpaper: theme.wallpaperId,
          currentDockSize: String(dock.iconSize),
        },
        detail: summary,
      };
    },
  },
  {
    id: "settings.appearance",
    label: "Set appearance",
    connectorId: "settings",
    scope: "write",
    description: "Switch the desktop between light, dark, and auto.",
    params: [{ name: "mode", label: "Mode", placeholder: "dark" }],
    describe: (p) => `Set appearance to ${p.mode || "dark"}`,
    run: async ({ mode }) => {
      const value = (mode ?? "").trim().toLowerCase();
      if (value !== "light" && value !== "dark" && value !== "auto") {
        throw new Error(`Appearance must be light, dark, or auto — got "${mode}"`);
      }
      useThemeStore.getState().setAppearance(value as Appearance);
      return { summary: `Appearance is now ${value}`, vars: { appliedAppearance: value } };
    },
  },
  {
    id: "settings.accent",
    label: "Set accent colour",
    connectorId: "settings",
    scope: "write",
    description: "Change the system accent colour by name or hex.",
    params: [{ name: "color", label: "Colour", placeholder: "purple or #5856D6" }],
    describe: (p) => `Set accent to ${p.color || "blue"}`,
    run: async ({ color }) => {
      const raw = (color ?? "").trim();
      const hex = /^#[0-9a-f]{6}$/i.test(raw) ? raw.toUpperCase() : NAMED_COLORS[raw.toLowerCase()];
      if (!hex) throw new Error(`Unknown colour "${color}" — use a hex value or ${Object.keys(NAMED_COLORS).join("/")}`);
      useThemeStore.getState().setAccent(hex);
      return { summary: `Accent set to ${hex}`, vars: { appliedAccent: hex } };
    },
  },
  {
    id: "settings.wallpaper",
    label: "Set wallpaper",
    connectorId: "settings",
    scope: "write",
    description: "Switch the desktop wallpaper to one of the presets.",
    params: [{ name: "wallpaper", label: "Wallpaper", placeholder: "ocean" }],
    describe: (p) => `Set wallpaper to ${p.wallpaper || "aurora"}`,
    run: async ({ wallpaper }) => {
      const q = (wallpaper ?? "").trim().toLowerCase();
      const match = WALLPAPERS.find((w) => w.id === q || w.label.toLowerCase() === q);
      if (!match) throw new Error(`Unknown wallpaper "${wallpaper}" — try ${WALLPAPERS.map((w) => w.id).join("/")}`);
      useThemeStore.getState().setWallpaper(match.id);
      return { summary: `Wallpaper set to ${match.label}`, vars: { appliedWallpaper: match.id } };
    },
  },
  {
    id: "settings.dock",
    label: "Set Dock size",
    connectorId: "settings",
    scope: "write",
    description: "Resize the Dock icons.",
    params: [{ name: "size", label: "Icon size", placeholder: "56" }],
    describe: (p) => `Set Dock icons to ${p.size || "56"}px`,
    run: async ({ size }) => {
      const value = Number(size);
      if (!Number.isFinite(value) || value < 32 || value > 96) throw new Error("Dock size must be between 32 and 96");
      useDockStore.getState().setIconSize(Math.round(value));
      return { summary: `Dock icons set to ${Math.round(value)}px` };
    },
  },

  // ---------------------------------------------------------------- fleet
  {
    id: "fleet.list",
    label: "List agents",
    connectorId: "fleet",
    scope: "read",
    description: "Report the agents on the roster and how each one plans.",
    params: [],
    describe: () => "Read the agent roster",
    run: async () => {
      const agents = fleetOps().listAgents();
      const lines = agents.map(
        (a) => `${a.name} (${a.model}, ${a.planner === "interpreter" ? "interpreter" : `${a.skills.length} skills`})${a.enabled ? "" : " — disabled"}`
      );
      return {
        summary: `${agents.length} agent${agents.length === 1 ? "" : "s"} on the roster`,
        vars: { agentNames: agents.map((a) => a.name).join(", ") },
        detail: lines.join("\n"),
      };
    },
  },
  {
    id: "fleet.createAgent",
    label: "Create agent",
    connectorId: "fleet",
    scope: "write",
    description: "Add an agent to the roster with its own system prompt.",
    params: [
      { name: "name", label: "Agent name", placeholder: "Code Review" },
      { name: "prompt", label: "System prompt", multiline: true, optional: true },
    ],
    describe: (p) => `Create agent “${p.name || "New agent"}”`,
    run: async ({ name, prompt }) => {
      const clean = (name ?? "").trim();
      if (!clean) throw new Error("An agent needs a name");
      const ops = fleetOps();
      if (ops.listAgents().some((a) => a.name.toLowerCase() === clean.toLowerCase())) {
        throw new Error(`An agent called “${clean}” already exists`);
      }
      // Generalists by default: a new agent can work before anyone writes it a skill.
      const id = ops.createAgent({
        name: clean,
        description: `Created from chat on ${new Date().toLocaleDateString()}.`,
        planner: "interpreter",
        systemPrompt: prompt?.trim() || `You are the ${clean} agent. Do ${clean.toLowerCase()} work carefully and report what you found.`,
      });
      return {
        summary: `Created agent “${clean}” — edit its prompt and skills in the Agents tab`,
        vars: { createdAgent: clean, createdAgentId: id },
      };
    },
  },
  {
    id: "fleet.setPrompt",
    label: "Set a prompt",
    connectorId: "fleet",
    scope: "write",
    description: "Rewrite an agent's system prompt, or the fleet brief when no agent is named.",
    params: [
      { name: "prompt", label: "Prompt text", multiline: true },
      { name: "agent", label: "Agent (blank for the fleet brief)", optional: true },
    ],
    describe: (p) => `Set the ${p.agent ? `${p.agent} prompt` : "fleet brief"}`,
    run: async ({ prompt, agent }) => {
      const text = (prompt ?? "").trim();
      if (!text) throw new Error("A prompt needs some text");
      const ops = fleetOps();
      if (!agent?.trim()) {
        ops.setFleetPrompt(text);
        return { summary: `Fleet brief updated (${text.length} chars)` };
      }
      const target = ops.listAgents().find((a) => a.name.toLowerCase() === agent.trim().toLowerCase());
      if (!target) throw new Error(`No agent called “${agent}”`);
      ops.updateAgent(target.id, { systemPrompt: text });
      return { summary: `${target.name}'s prompt updated (${text.length} chars)`, vars: { promptedAgent: target.name } };
    },
  },

  // ---------------------------------------------------------------- shell
  {
    id: "shell.run",
    label: "Run shell command",
    connectorId: "shell",
    scope: "write",
    description:
      "Execute a Terminal command (ls, cat, mkdir, echo, rm, mv…) against the filesystem. Only commands that change files need write access.",
    params: [{ name: "command", label: "Command", placeholder: "ls /Documents" }],
    scopeFor: ({ command }) =>
      READ_ONLY_COMMANDS.has((command ?? "").trim().split(/\s+/)[0]?.toLowerCase()) ? "read" : "write",
    describe: (p) => `Run \`${p.command || "ls"}\``,
    run: async ({ command }, meta) => {
      const line = (command ?? "").trim();
      if (!line) throw new Error("No command given");
      const [name, ...args] = tokenize(line);
      const actor = meta?.agentName ?? "agent";
      const fn = COMMANDS[name];
      if (!fn) {
        emitTerminalActivity({ id: crypto.randomUUID(), actor, command: line, error: `command not found: ${name}` });
        throw new Error(`Unknown command: ${name}`);
      }
      const result = await fn(args, { cwdId: ROOT_ID });
      // Show it in any Terminal that is open, mistakes included.
      emitTerminalActivity({
        id: crypto.randomUUID(),
        actor,
        command: line,
        output: (result.output ?? []).join("\n"),
        error: result.error,
      });
      if (result.error) throw new Error(result.error);
      const output = (result.output ?? []).join("\n");
      return {
        summary: `$ ${line} → ${output ? `${output.split("\n").length} line(s)` : "ok"}`,
        vars: { stdout: output },
        detail: output ? `$ ${line}\n${truncate(output)}` : undefined,
      };
    },
  },
];

export function getAction(id: string): ActionSpec | undefined {
  return ACTIONS.find((a) => a.id === id);
}

export function actionsByConnector(connectorId: string): ActionSpec[] {
  return ACTIONS.filter((a) => a.connectorId === connectorId);
}

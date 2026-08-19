import {
  AppWindow,
  Binoculars,
  Bug,
  Code2,
  FileSearch,
  Gauge,
  FolderTree,
  Inbox,
  Plug,
  Radar,
  ScrollText,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/** Agents persist an icon key, not a component — this map resolves it. */
export const AGENT_ICONS: Record<string, LucideIcon> = {
  radar: Radar,
  binoculars: Binoculars,
  code: Code2,
  bug: Bug,
  shield: ShieldCheck,
  scroll: ScrollText,
  search: FileSearch,
  inbox: Inbox,
  folder: FolderTree,
  window: AppWindow,
  sliders: SlidersHorizontal,
  terminal: SquareTerminal,
  plug: Plug,
  gauge: Gauge,
  wrench: Wrench,
  sparkles: Sparkles,
};

export const AGENT_ICON_KEYS = Object.keys(AGENT_ICONS);

export const DEFAULT_AGENT_ICON: LucideIcon = Sparkles;

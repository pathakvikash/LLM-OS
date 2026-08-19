"use client";

import { useState } from "react";
import { Palette, Image as ImageIcon, LayoutGrid, Sparkles, Volume2, Info } from "lucide-react";
import AppearancePane from "./panes/AppearancePane";
import WallpaperPane from "./panes/WallpaperPane";
import DockPane from "./panes/DockPane";
import SoundPane from "./panes/SoundPane";
import AboutPane from "./panes/AboutPane";
import AiPane from "./panes/AiPane";

const PANES = [
  { id: "appearance", label: "Appearance", icon: Palette, Component: AppearancePane },
  { id: "wallpaper", label: "Wallpaper", icon: ImageIcon, Component: WallpaperPane },
  { id: "dock", label: "Dock", icon: LayoutGrid, Component: DockPane },
  { id: "sound", label: "Sound", icon: Volume2, Component: SoundPane },
  { id: "ai", label: "AI", icon: Sparkles, Component: AiPane },
  { id: "about", label: "About", icon: Info, Component: AboutPane },
];

export default function SettingsApp() {
  const [activeId, setActiveId] = useState(PANES[0].id);
  const active = PANES.find((p) => p.id === activeId) ?? PANES[0];
  const ActivePane = active.Component;

  return (
    <div className="flex h-full">
      <div className="w-44 shrink-0 border-r p-2" style={{ borderColor: "var(--glass-border)" }}>
        {PANES.map((pane) => (
          <button
            key={pane.id}
            onClick={() => setActiveId(pane.id)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
            style={{
              background: activeId === pane.id ? "var(--accent-primary)" : "transparent",
              color: activeId === pane.id ? "white" : "var(--text-secondary)",
            }}
          >
            <pane.icon size={15} strokeWidth={1.75} />
            {pane.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 flex-1 overflow-auto p-5">
        <ActivePane />
      </div>
    </div>
  );
}

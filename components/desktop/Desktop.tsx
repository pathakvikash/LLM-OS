"use client";

import { useEffect } from "react";
import "@/lib/apps/install";
import { ensureSeeded } from "@/lib/fs/seed";
import { startAgentRuntime, stopAgentRuntime } from "@/lib/agents/runtime";
import Wallpaper from "@/components/desktop/Wallpaper";
import MenuBar from "@/components/menu-bar/MenuBar";
import Dock from "@/components/dock/Dock";
import WindowLayer from "@/components/window-manager/WindowLayer";
import Spotlight from "@/components/spotlight/Spotlight";
import GlobalHotkeys from "@/components/desktop/GlobalHotkeys";
import ThemeEffect from "@/components/desktop/ThemeEffect";

export default function Desktop() {
  useEffect(() => {
    ensureSeeded();
  }, []);

  // The agent scheduler is OS-level: queued and scheduled runs keep progressing
  // whether or not the Agents window is open.
  useEffect(() => {
    startAgentRuntime();
    return stopAgentRuntime;
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GlobalHotkeys />
      <ThemeEffect />
      <Wallpaper />
      <MenuBar />
      <WindowLayer />
      <Dock />
      <Spotlight />
    </div>
  );
}

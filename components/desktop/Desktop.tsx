"use client";

import "@/lib/apps/install";
import Wallpaper from "@/components/desktop/Wallpaper";
import MenuBar from "@/components/menu-bar/MenuBar";
import Dock from "@/components/dock/Dock";
import WindowLayer from "@/components/window-manager/WindowLayer";
import Spotlight from "@/components/spotlight/Spotlight";
import GlobalHotkeys from "@/components/desktop/GlobalHotkeys";

export default function Desktop() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <GlobalHotkeys />
      <Wallpaper />
      <MenuBar />
      <WindowLayer />
      <Dock />
      <Spotlight />
    </div>
  );
}

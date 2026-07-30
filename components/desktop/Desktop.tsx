"use client";

import "@/lib/apps/install";
import Wallpaper from "@/components/desktop/Wallpaper";
import MenuBar from "@/components/menu-bar/MenuBar";
import Dock from "@/components/dock/Dock";
import WindowLayer from "@/components/window-manager/WindowLayer";

export default function Desktop() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Wallpaper />
      <MenuBar />
      <WindowLayer />
      <Dock />
    </div>
  );
}

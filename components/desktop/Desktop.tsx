"use client";

import Wallpaper from "@/components/desktop/Wallpaper";
import MenuBar from "@/components/menu-bar/MenuBar";
import Dock from "@/components/dock/Dock";

export default function Desktop() {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <Wallpaper />
      <MenuBar />
      <Dock />
    </div>
  );
}

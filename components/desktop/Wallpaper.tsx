"use client";

import { useThemeStore } from "@/stores/useThemeStore";
import { getWallpaper } from "@/lib/theme/wallpapers";

export default function Wallpaper() {
  const wallpaperId = useThemeStore((s) => s.wallpaperId);
  const wallpaper = getWallpaper(wallpaperId);

  return <div className="fixed inset-0 -z-10" style={{ background: wallpaper.css }} aria-hidden />;
}

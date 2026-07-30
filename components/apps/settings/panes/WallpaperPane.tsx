"use client";

import { WALLPAPERS } from "@/lib/theme/wallpapers";
import { useThemeStore } from "@/stores/useThemeStore";

export default function WallpaperPane() {
  const wallpaperId = useThemeStore((s) => s.wallpaperId);
  const setWallpaper = useThemeStore((s) => s.setWallpaper);

  return (
    <div>
      <h2 className="mb-3 text-[13px] font-medium">Wallpaper</h2>
      <div className="grid grid-cols-3 gap-3">
        {WALLPAPERS.map((wp) => (
          <button key={wp.id} onClick={() => setWallpaper(wp.id)} className="flex flex-col gap-1">
            <div
              className="h-16 rounded-lg"
              style={{
                background: wp.css,
                outline:
                  wallpaperId === wp.id ? "2px solid var(--accent-primary)" : "1px solid var(--glass-border)",
                outlineOffset: 2,
              }}
            />
            <span className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {wp.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

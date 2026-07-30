export interface WallpaperOption {
  id: string;
  label: string;
  css: string;
}

export const WALLPAPERS: WallpaperOption[] = [
  { id: "aurora", label: "Aurora", css: "linear-gradient(135deg, #2B2D42 0%, #4A4E69 50%, #6B7280 100%)" },
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg, #3a1c71 0%, #d76d77 50%, #ffaf7b 100%)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)" },
  { id: "forest", label: "Forest", css: "linear-gradient(135deg, #134e5e 0%, #71b280 100%)" },
  { id: "graphite", label: "Graphite", css: "linear-gradient(135deg, #232526 0%, #414345 100%)" },
];

export function getWallpaper(id: string): WallpaperOption {
  return WALLPAPERS.find((w) => w.id === id) ?? WALLPAPERS[0];
}

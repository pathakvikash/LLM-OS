"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Appearance = "light" | "dark" | "auto";

interface ThemeState {
  appearance: Appearance;
  accent: string;
  wallpaperId: string;
  soundEnabled: boolean;
  setAppearance: (a: Appearance) => void;
  setAccent: (hex: string) => void;
  setWallpaper: (id: string) => void;
  setSoundEnabled: (v: boolean) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      appearance: "dark",
      accent: "#007AFF",
      wallpaperId: "aurora",
      soundEnabled: false,
      setAppearance: (appearance) => set({ appearance }),
      setAccent: (accent) => set({ accent }),
      setWallpaper: (wallpaperId) => set({ wallpaperId }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
    }),
    { name: "llmos-theme" }
  )
);

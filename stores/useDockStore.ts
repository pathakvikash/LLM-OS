"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface DockState {
  iconSize: number;
  setIconSize: (size: number) => void;
}

export const useDockStore = create<DockState>()(
  persist(
    (set) => ({
      iconSize: 56,
      setIconSize: (iconSize) => set({ iconSize }),
    }),
    { name: "llmos-dock" }
  )
);

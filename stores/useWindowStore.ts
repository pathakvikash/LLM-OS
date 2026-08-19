"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getApp } from "@/lib/apps/registry";

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface WindowState {
  id: string;
  appId: string;
  title: string;
  position: Point;
  size: Size;
  previousBounds?: { position: Point; size: Size };
  zIndex: number;
  isMinimized: boolean;
  isMaximized: boolean;
}

interface OpenWindowOptions {
  title?: string;
}

interface WindowStoreState {
  windows: Record<string, WindowState>;
  focusedWindowId: string | null;
  zCounter: number;
  hasHydrated: boolean;
  setHasHydrated: (value: boolean) => void;
  openWindow: (appId: string, opts?: OpenWindowOptions) => string | null;
  openNewWindow: (appId: string, opts?: OpenWindowOptions) => string | null;
  closeWindow: (id: string) => void;
  focusWindow: (id: string) => void;
  minimizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  toggleMaximize: (id: string) => void;
  moveWindow: (id: string, position: Point) => void;
  resizeWindow: (id: string, size: Size, position?: Point) => void;
}

function nextZIndex(state: WindowStoreState) {
  return state.zCounter + 1;
}

function centeredPosition(size: Size) {
  if (typeof window === "undefined") return { x: 120, y: 80 };
  const x = Math.max(24, Math.round((window.innerWidth - size.width) / 2));
  const y = Math.max(48, Math.round((window.innerHeight - size.height) / 3));
  return { x, y };
}

export const useWindowStore = create<WindowStoreState>()(
  persist(
    (set, get) => ({
      windows: {},
      focusedWindowId: null,
      zCounter: 0,
      hasHydrated: false,
      setHasHydrated: (value) => set({ hasHydrated: value }),

      openWindow: (appId, opts) => {
        const app = getApp(appId);
        if (!app) return null;

        // Dock/Spotlight semantics: reuse the frontmost existing window of this
        // app if one is already open, instead of always spawning a new instance.
        const existing = Object.values(get().windows)
          .filter((w) => w.appId === appId)
          .sort((a, b) => b.zIndex - a.zIndex)[0];
        if (existing) {
          if (existing.isMinimized) get().restoreWindow(existing.id);
          else if (get().focusedWindowId === existing.id) get().minimizeWindow(existing.id);
          else get().focusWindow(existing.id);
          return existing.id;
        }

        return get().openNewWindow(appId, opts);
      },

      openNewWindow: (appId, opts) => {
        const app = getApp(appId);
        if (!app) return null;

        if (app.singleton) {
          const existing = Object.values(get().windows).find((w) => w.appId === appId);
          if (existing) {
            get().focusWindow(existing.id);
            if (existing.isMinimized) get().restoreWindow(existing.id);
            return existing.id;
          }
        }

        const id = crypto.randomUUID();
        const z = nextZIndex(get());
        const win: WindowState = {
          id,
          appId,
          title: opts?.title ?? app.name,
          position: centeredPosition(app.defaultSize),
          size: app.defaultSize,
          zIndex: z,
          isMinimized: false,
          isMaximized: false,
        };
        set((state) => ({
          windows: { ...state.windows, [id]: win },
          focusedWindowId: id,
          zCounter: z,
        }));
        return id;
      },

      closeWindow: (id) => {
        set((state) => {
          const rest = { ...state.windows };
          delete rest[id];
          const focusedWindowId =
            state.focusedWindowId === id
              ? Object.values(rest).sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null
              : state.focusedWindowId;
          return { windows: rest, focusedWindowId };
        });
      },

      focusWindow: (id) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          const z = nextZIndex(state);
          return {
            windows: { ...state.windows, [id]: { ...win, zIndex: z, isMinimized: false } },
            focusedWindowId: id,
            zCounter: z,
          };
        });
      },

      minimizeWindow: (id) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          const isFocused = state.focusedWindowId === id;
          const nextFocus = isFocused
            ? Object.values(state.windows)
                .filter((w) => w.id !== id && !w.isMinimized)
                .sort((a, b) => b.zIndex - a.zIndex)[0]?.id ?? null
            : state.focusedWindowId;
          return {
            windows: { ...state.windows, [id]: { ...win, isMinimized: true } },
            focusedWindowId: nextFocus,
          };
        });
      },

      restoreWindow: (id) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          return { windows: { ...state.windows, [id]: { ...win, isMinimized: false } } };
        });
        get().focusWindow(id);
      },

      toggleMaximize: (id) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          if (win.isMaximized && win.previousBounds) {
            return {
              windows: {
                ...state.windows,
                [id]: {
                  ...win,
                  isMaximized: false,
                  position: win.previousBounds.position,
                  size: win.previousBounds.size,
                  previousBounds: undefined,
                },
              },
            };
          }
          const menuBarHeight = 28;
          const dockClearance = 96;
          const margin = 8;
          return {
            windows: {
              ...state.windows,
              [id]: {
                ...win,
                isMaximized: true,
                previousBounds: { position: win.position, size: win.size },
                position: { x: margin, y: menuBarHeight + margin },
                size: {
                  width:
                    (typeof window !== "undefined" ? window.innerWidth : 1280) - margin * 2,
                  height:
                    (typeof window !== "undefined" ? window.innerHeight : 800) -
                    menuBarHeight -
                    dockClearance,
                },
              },
            },
          };
        });
      },

      moveWindow: (id, position) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          return { windows: { ...state.windows, [id]: { ...win, position } } };
        });
      },

      resizeWindow: (id, size, position) => {
        set((state) => {
          const win = state.windows[id];
          if (!win) return state;
          return {
            windows: {
              ...state.windows,
              [id]: { ...win, size, position: position ?? win.position },
            },
          };
        });
      },
    }),
    {
      name: "llmos-windows",
      partialize: (state) => ({ windows: state.windows, zCounter: state.zCounter }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) } as WindowStoreState;
        const validWindows: Record<string, WindowState> = {};
        for (const [id, win] of Object.entries(merged.windows)) {
          if (getApp(win.appId)) validWindows[id] = win;
        }
        return { ...merged, windows: validWindows, focusedWindowId: null };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

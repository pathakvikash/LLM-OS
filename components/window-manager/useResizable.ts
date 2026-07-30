"use client";

import { useCallback, useRef } from "react";
import { useWindowStore } from "@/stores/useWindowStore";

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

const MIN_WIDTH = 280;
const MIN_HEIGHT = 160;

export function useResizable(windowId: string, minSize?: { width: number; height: number }) {
  const resizeWindow = useWindowStore((s) => s.resizeWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const dragState = useRef<{
    dir: ResizeDirection;
    startX: number;
    startY: number;
    origin: { x: number; y: number; width: number; height: number };
  } | null>(null);

  const startResize = useCallback(
    (dir: ResizeDirection) => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      const win = useWindowStore.getState().windows[windowId];
      if (!win || win.isMaximized) return;
      focusWindow(windowId);
      dragState.current = {
        dir,
        startX: e.clientX,
        startY: e.clientY,
        origin: { x: win.position.x, y: win.position.y, width: win.size.width, height: win.size.height },
      };
      (e.target as Element).setPointerCapture(e.pointerId);
    },
    [windowId, focusWindow]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const minW = minSize?.width ?? MIN_WIDTH;
      const minH = minSize?.height ?? MIN_HEIGHT;
      let { x, y, width, height } = drag.origin;

      if (drag.dir.includes("e")) width = Math.max(minW, drag.origin.width + dx);
      if (drag.dir.includes("s")) height = Math.max(minH, drag.origin.height + dy);
      if (drag.dir.includes("w")) {
        width = Math.max(minW, drag.origin.width - dx);
        x = drag.origin.x + (drag.origin.width - width);
      }
      if (drag.dir.includes("n")) {
        height = Math.max(minH, drag.origin.height - dy);
        y = drag.origin.y + (drag.origin.height - height);
      }

      resizeWindow(windowId, { width, height }, { x, y });
    },
    [windowId, resizeWindow, minSize]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture already released
    }
  }, []);

  return { startResize, onPointerMove, onPointerUp };
}

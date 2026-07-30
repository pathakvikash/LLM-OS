"use client";

import { useCallback, useRef } from "react";
import { useWindowStore } from "@/stores/useWindowStore";

const MENU_BAR_HEIGHT = 28;

export function useDraggable(windowId: string) {
  const moveWindow = useWindowStore((s) => s.moveWindow);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const dragState = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      const win = useWindowStore.getState().windows[windowId];
      if (!win || win.isMaximized) return;
      focusWindow(windowId);
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        originX: win.position.x,
        originY: win.position.y,
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
      moveWindow(windowId, {
        x: drag.originX + dx,
        y: Math.max(MENU_BAR_HEIGHT, drag.originY + dy),
      });
    },
    [windowId, moveWindow]
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    dragState.current = null;
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {
      // pointer capture already released
    }
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}

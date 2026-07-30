"use client";

import { motion } from "framer-motion";
import { useWindowStore, type WindowState } from "@/stores/useWindowStore";
import { getApp } from "@/lib/apps/registry";
import { useDraggable } from "./useDraggable";
import { useResizable, type ResizeDirection } from "./useResizable";
import TrafficLights from "./TrafficLights";

const RESIZE_HANDLES: { dir: ResizeDirection; className: string }[] = [
  { dir: "n", className: "top-0 left-2 right-2 h-1.5 cursor-ns-resize" },
  { dir: "s", className: "bottom-0 left-2 right-2 h-1.5 cursor-ns-resize" },
  { dir: "e", className: "right-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { dir: "w", className: "left-0 top-2 bottom-2 w-1.5 cursor-ew-resize" },
  { dir: "ne", className: "top-0 right-0 h-3 w-3 cursor-nesw-resize" },
  { dir: "nw", className: "top-0 left-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "se", className: "bottom-0 right-0 h-3 w-3 cursor-nwse-resize" },
  { dir: "sw", className: "bottom-0 left-0 h-3 w-3 cursor-nesw-resize" },
];

export default function Window({ win }: { win: WindowState }) {
  const app = getApp(win.appId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const focusWindow = useWindowStore((s) => s.focusWindow);
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);

  const drag = useDraggable(win.id);
  const resize = useResizable(win.id, app?.minSize);

  if (!app) return null;

  const isFocused = focusedWindowId === win.id;
  const AppComponent = app.component;

  return (
    <motion.div
      role="dialog"
      aria-label={win.title}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{
        opacity: win.isMinimized ? 0 : 1,
        scale: win.isMinimized ? 0.12 : 1,
      }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
      style={{
        position: "absolute",
        top: win.position.y,
        left: win.position.x,
        width: win.size.width,
        height: win.size.height,
        zIndex: win.zIndex,
        transformOrigin: "bottom center",
        pointerEvents: win.isMinimized ? "none" : "auto",
      }}
      onPointerDown={() => {
        if (!isFocused) focusWindow(win.id);
      }}
      onPointerMove={(e) => {
        drag.onPointerMove(e);
        resize.onPointerMove(e);
      }}
      onPointerUp={(e) => {
        drag.onPointerUp(e);
        resize.onPointerUp(e);
      }}
      className="glass-strong flex flex-col overflow-hidden rounded-(--radius) shadow-2xl"
    >
      <div
        className="flex shrink-0 items-center border-b select-none"
        style={{ borderColor: "var(--glass-border)" }}
        onPointerDown={drag.onPointerDown}
        onDoubleClick={() => toggleMaximize(win.id)}
      >
        <TrafficLights
          onClose={() => closeWindow(win.id)}
          onMinimize={() => minimizeWindow(win.id)}
          onMaximize={() => toggleMaximize(win.id)}
        />
        <span
          className="pointer-events-none flex-1 -ml-6 text-center text-[13px] font-medium"
          style={{ color: isFocused ? "var(--text-primary)" : "var(--text-muted)" }}
        >
          {win.title}
        </span>
        <div className="w-16" />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        <AppComponent windowId={win.id} />
      </div>

      {!win.isMaximized &&
        RESIZE_HANDLES.map(({ dir, className }) => (
          <div
            key={dir}
            className={`absolute ${className}`}
            onPointerDown={resize.startResize(dir)}
          />
        ))}
    </motion.div>
  );
}

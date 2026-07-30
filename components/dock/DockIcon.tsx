"use client";

import type { AppDefinition } from "@/lib/apps/registry";

interface DockIconProps {
  app: AppDefinition;
  isRunning: boolean;
  onOpen: () => void;
  size: number;
}

export default function DockIcon({ app, isRunning, onOpen, size }: DockIconProps) {
  const Icon = app.icon;
  return (
    <div className="relative flex flex-col items-center">
      <button
        title={app.name}
        aria-label={app.name}
        onClick={onOpen}
        className="flex items-center justify-center rounded-2xl transition-transform duration-150 ease-(--ease) hover:-translate-y-2 hover:scale-105 active:scale-95"
        style={{ background: "var(--glass-bg-strong)", height: size, width: size }}
      >
        <Icon size={Math.round(size * 0.5)} strokeWidth={1.5} style={{ color: "var(--text-primary)" }} />
      </button>
      <span
        className="absolute -bottom-1.5 h-1 w-1 rounded-full transition-opacity"
        style={{
          background: "var(--text-primary)",
          opacity: isRunning ? 1 : 0,
        }}
      />
    </div>
  );
}

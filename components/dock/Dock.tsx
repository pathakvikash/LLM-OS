"use client";

import { Folder, SquareTerminal, Settings } from "lucide-react";

const PLACEHOLDER_APPS = [
  { id: "finder", name: "Finder", Icon: Folder },
  { id: "terminal", name: "Terminal", Icon: SquareTerminal },
  { id: "settings", name: "Settings", Icon: Settings },
];

export default function Dock() {
  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40">
      <div
        className="glass flex items-end gap-2 px-3 py-2 rounded-(--radius-lg)"
        style={{ height: "var(--dock-height)" }}
      >
        {PLACEHOLDER_APPS.map(({ id, name, Icon }) => (
          <div
            key={id}
            title={name}
            className="flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-150 ease-[var(--ease)] hover:-translate-y-2 hover:scale-105 cursor-pointer"
            style={{ background: "var(--glass-bg-strong)" }}
          >
            <Icon size={28} strokeWidth={1.5} style={{ color: "var(--text-primary)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}

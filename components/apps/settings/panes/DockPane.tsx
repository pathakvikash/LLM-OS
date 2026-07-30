"use client";

import { useDockStore } from "@/stores/useDockStore";

export default function DockPane() {
  const iconSize = useDockStore((s) => s.iconSize);
  const setIconSize = useDockStore((s) => s.setIconSize);

  return (
    <div className="max-w-sm">
      <h2 className="mb-3 text-[13px] font-medium">Dock</h2>
      <label className="flex flex-col gap-2 text-[12px]" style={{ color: "var(--text-secondary)" }}>
        Size
        <input
          type="range"
          min={40}
          max={72}
          value={iconSize}
          onChange={(e) => setIconSize(Number(e.target.value))}
        />
      </label>
    </div>
  );
}

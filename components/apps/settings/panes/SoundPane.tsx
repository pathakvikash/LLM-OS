"use client";

import { useThemeStore } from "@/stores/useThemeStore";

export default function SoundPane() {
  const soundEnabled = useThemeStore((s) => s.soundEnabled);
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled);

  return (
    <div className="max-w-sm">
      <h2 className="mb-3 text-[13px] font-medium">Sound</h2>
      <label className="flex items-center justify-between text-[13px]">
        Play interface sounds
        <input
          type="checkbox"
          checked={soundEnabled}
          onChange={(e) => setSoundEnabled(e.target.checked)}
        />
      </label>
    </div>
  );
}

"use client";

import { useThemeStore, type Appearance } from "@/stores/useThemeStore";

const MODES: Appearance[] = ["light", "dark", "auto"];

const ACCENTS = [
  { hex: "#007AFF", label: "Blue" },
  { hex: "#5856D6", label: "Purple" },
  { hex: "#34C759", label: "Green" },
  { hex: "#FF9500", label: "Orange" },
  { hex: "#FF3B30", label: "Red" },
];

export default function AppearancePane() {
  const appearance = useThemeStore((s) => s.appearance);
  const setAppearance = useThemeStore((s) => s.setAppearance);
  const accent = useThemeStore((s) => s.accent);
  const setAccent = useThemeStore((s) => s.setAccent);

  return (
    <div className="flex max-w-sm flex-col gap-6">
      <div>
        <h2 className="mb-2 text-[13px] font-medium">Appearance</h2>
        <div className="flex gap-1 rounded-lg p-1" style={{ background: "var(--glass-bg)" }}>
          {MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => setAppearance(mode)}
              className="flex-1 rounded-md py-1.5 text-[12px] capitalize"
              style={{
                background: appearance === mode ? "var(--accent-primary)" : "transparent",
                color: appearance === mode ? "white" : "var(--text-secondary)",
              }}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-medium">Accent Color</h2>
        <div className="flex gap-2">
          {ACCENTS.map((a) => (
            <button
              key={a.hex}
              title={a.label}
              aria-label={a.label}
              onClick={() => setAccent(a.hex)}
              className="h-7 w-7 rounded-full"
              style={{
                background: a.hex,
                boxShadow: accent === a.hex ? "0 0 0 2px var(--text-primary)" : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

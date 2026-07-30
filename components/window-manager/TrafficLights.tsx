"use client";

import { X, Minus, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useThemeStore } from "@/stores/useThemeStore";
import { playClick } from "@/lib/utils/sound";

interface TrafficLightsProps {
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

const DOT_BASE =
  "group/dot flex h-3 w-3 items-center justify-center rounded-full outline-none";

export default function TrafficLights({ onClose, onMinimize, onMaximize }: TrafficLightsProps) {
  const soundEnabled = useThemeStore((s) => s.soundEnabled);

  function withSound(fn: () => void) {
    return () => {
      if (soundEnabled) playClick();
      fn();
    };
  }

  return (
    <div className="group flex items-center gap-2 px-4 py-3">
      <button
        aria-label="Close"
        onClick={withSound(onClose)}
        className={cn(DOT_BASE, "bg-[#ff5f57]")}
      >
        <X size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100" />
      </button>
      <button
        aria-label="Minimize"
        onClick={withSound(onMinimize)}
        className={cn(DOT_BASE, "bg-[#febc2e]")}
      >
        <Minus size={8} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100" />
      </button>
      <button
        aria-label="Zoom"
        onClick={withSound(onMaximize)}
        className={cn(DOT_BASE, "bg-[#28c840]")}
      >
        <Maximize2 size={7} strokeWidth={3} className="text-black/60 opacity-0 group-hover:opacity-100" />
      </button>
    </div>
  );
}

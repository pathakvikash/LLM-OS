"use client";

import { useEffect } from "react";
import { useThemeStore } from "@/stores/useThemeStore";

export default function ThemeEffect() {
  const appearance = useThemeStore((s) => s.appearance);
  const accent = useThemeStore((s) => s.accent);

  useEffect(() => {
    function applyResolvedTheme() {
      const resolved =
        appearance === "auto"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : appearance;
      document.documentElement.dataset.theme = resolved;
    }

    applyResolvedTheme();

    if (appearance === "auto") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      mq.addEventListener("change", applyResolvedTheme);
      return () => mq.removeEventListener("change", applyResolvedTheme);
    }
  }, [appearance]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent-primary", accent);
  }, [accent]);

  return null;
}

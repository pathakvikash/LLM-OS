"use client";

import { useEffect } from "react";
import { useSpotlightStore } from "@/stores/useSpotlightStore";

export default function GlobalHotkeys() {
  const toggle = useSpotlightStore((s) => s.toggle);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isSpotlightShortcut = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isSpotlightShortcut) {
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  return null;
}

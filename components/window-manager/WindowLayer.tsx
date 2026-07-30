"use client";

import { AnimatePresence } from "framer-motion";
import { useWindowStore } from "@/stores/useWindowStore";
import Window from "./Window";

export default function WindowLayer() {
  const windows = useWindowStore((s) => s.windows);
  const hasHydrated = useWindowStore((s) => s.hasHydrated);

  if (!hasHydrated) return null;

  return (
    <AnimatePresence>
      {Object.values(windows).map((win) => (
        <Window key={win.id} win={win} />
      ))}
    </AnimatePresence>
  );
}

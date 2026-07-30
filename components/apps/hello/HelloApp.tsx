"use client";

import { useState } from "react";
import type { WindowAppProps } from "@/lib/apps/registry";

export default function HelloApp({ windowId }: WindowAppProps) {
  const [count, setCount] = useState(0);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
        Window kernel smoke test — drag, resize, minimize, and maximize this
        window using the controls above.
      </p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        windowId: {windowId}
      </p>
      <button
        onClick={() => setCount((c) => c + 1)}
        className="rounded-full px-4 py-2 text-sm font-medium text-white transition-transform active:scale-95"
        style={{ background: "var(--accent-primary)" }}
      >
        Clicked {count} times
      </button>
    </div>
  );
}

"use client";

import { getDockApps } from "@/lib/apps/registry";
import { useWindowStore } from "@/stores/useWindowStore";
import DockIcon from "./DockIcon";

export default function Dock() {
  const windows = useWindowStore((s) => s.windows);
  const openWindow = useWindowStore((s) => s.openWindow);
  const apps = getDockApps();

  const runningAppIds = new Set(Object.values(windows).map((w) => w.appId));

  return (
    <div className="fixed bottom-2 left-1/2 -translate-x-1/2 z-40">
      <div
        className="glass flex items-end gap-2 px-3 py-2 rounded-(--radius-lg)"
        style={{ height: "var(--dock-height)" }}
      >
        {apps.map((app) => (
          <DockIcon
            key={app.id}
            app={app}
            isRunning={runningAppIds.has(app.id)}
            onOpen={() => openWindow(app.id)}
          />
        ))}
      </div>
    </div>
  );
}

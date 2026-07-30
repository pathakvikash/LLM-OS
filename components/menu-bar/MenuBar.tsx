"use client";

import { useEffect, useState } from "react";
import { Search, Wifi } from "lucide-react";
import { useWindowStore } from "@/stores/useWindowStore";
import { useSpotlightStore } from "@/stores/useSpotlightStore";
import { getApp, type MenuItemDefinition } from "@/lib/apps/registry";
import { emitMenuCommand } from "@/lib/commands/menuBus";
import MenuDropdown from "./MenuDropdown";
import AppleMenu from "./AppleMenu";

function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 15);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span className="tabular-nums">--:--</span>;

  return (
    <span className="tabular-nums">
      {now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}{" "}
      {now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
    </span>
  );
}

export default function MenuBar() {
  const windows = useWindowStore((s) => s.windows);
  const focusedWindowId = useWindowStore((s) => s.focusedWindowId);
  const closeWindow = useWindowStore((s) => s.closeWindow);
  const minimizeWindow = useWindowStore((s) => s.minimizeWindow);
  const toggleMaximize = useWindowStore((s) => s.toggleMaximize);
  const openSpotlight = useSpotlightStore((s) => s.open);

  const focusedWindow = focusedWindowId ? windows[focusedWindowId] : null;
  const activeApp = focusedWindow ? getApp(focusedWindow.appId) : getApp("finder");
  const menus = activeApp?.menus ?? [];

  function handleSelect(item: MenuItemDefinition) {
    if (!focusedWindow) return;
    if (item.actionType === "close") closeWindow(focusedWindow.id);
    else if (item.actionType === "minimize") minimizeWindow(focusedWindow.id);
    else if (item.actionType === "maximize") toggleMaximize(focusedWindow.id);
    else if (item.commandId) emitMenuCommand(focusedWindow.id, item.commandId);
  }

  return (
    <div
      className="glass fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 text-[13px] font-medium select-none"
      style={{ height: "var(--menu-bar-height)", color: "var(--text-primary)" }}
    >
      <div className="flex items-center gap-4">
        <AppleMenu />
        <span className="font-semibold">{activeApp?.name ?? "Finder"}</span>
        {menus.map((menu) => (
          <MenuDropdown key={menu.label} menu={menu} onSelect={handleSelect} />
        ))}
      </div>
      <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
        <Wifi size={14} />
        <button aria-label="Spotlight Search" onClick={openSpotlight} className="flex items-center">
          <Search size={14} />
        </button>
        <Clock />
      </div>
    </div>
  );
}

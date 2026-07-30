"use client";

import { useEffect, useState } from "react";
import { Command, Search, Wifi } from "lucide-react";

const STATIC_MENUS = ["File", "Edit", "View", "Go", "Window", "Help"];

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
  return (
    <div
      className="glass fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 text-[13px] font-medium select-none"
      style={{ height: "var(--menu-bar-height)", color: "var(--text-primary)" }}
    >
      <div className="flex items-center gap-4">
        <Command size={14} strokeWidth={2.25} />
        <span className="font-semibold">Finder</span>
        {STATIC_MENUS.map((label) => (
          <span key={label} className="hidden sm:inline text-[13px]" style={{ color: "var(--text-secondary)" }}>
            {label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-3" style={{ color: "var(--text-secondary)" }}>
        <Wifi size={14} />
        <Search size={14} />
        <Clock />
      </div>
    </div>
  );
}

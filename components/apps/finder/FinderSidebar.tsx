"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { Home, Folder } from "lucide-react";
import { ROOT_ID, list } from "@/lib/fs/vfs";
import { cn } from "@/lib/utils/cn";

interface FinderSidebarProps {
  cwdId: string;
  onNavigate: (id: string) => void;
}

export default function FinderSidebar({ cwdId, onNavigate }: FinderSidebarProps) {
  const topLevel = useLiveQuery(() => list(ROOT_ID), []) ?? [];
  const favorites = topLevel.filter((n) => n.type === "folder");

  return (
    <div className="flex h-full w-40 shrink-0 flex-col gap-0.5 border-r p-2" style={{ borderColor: "var(--glass-border)" }}>
      <p className="px-2 pt-1 pb-1 text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
        Favorites
      </p>
      <SidebarItem label="Home" icon={Home} active={cwdId === ROOT_ID} onClick={() => onNavigate(ROOT_ID)} />
      {favorites.map((folder) => (
        <SidebarItem
          key={folder.id}
          label={folder.name}
          icon={Folder}
          active={cwdId === folder.id}
          onClick={() => onNavigate(folder.id)}
        />
      ))}
    </div>
  );
}

function SidebarItem({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px]")}
      style={{
        background: active ? "var(--accent-primary)" : "transparent",
        color: active ? "white" : "var(--text-secondary)",
      }}
    >
      <Icon size={14} strokeWidth={1.75} />
      <span className="truncate">{label}</span>
    </button>
  );
}

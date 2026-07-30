"use client";

import { ChevronLeft, ChevronRight, FolderPlus, Grid2x2, List, Trash2 } from "lucide-react";

interface FinderToolbarProps {
  path: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onNewFolder: () => void;
  onDelete: () => void;
  canDelete: boolean;
  viewMode: "icon" | "list";
  onViewModeChange: (mode: "icon" | "list") => void;
}

export default function FinderToolbar({
  path,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onNewFolder,
  onDelete,
  canDelete,
  viewMode,
  onViewModeChange,
}: FinderToolbarProps) {
  return (
    <div
      className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
      style={{ borderColor: "var(--glass-border)" }}
    >
      <ToolbarButton onClick={onBack} disabled={!canGoBack} label="Back">
        <ChevronLeft size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onForward} disabled={!canGoForward} label="Forward">
        <ChevronRight size={16} />
      </ToolbarButton>

      <span
        className="ml-1 flex-1 truncate text-[12px]"
        style={{ color: "var(--text-secondary)" }}
      >
        {path}
      </span>

      <ToolbarButton onClick={onNewFolder} label="New Folder">
        <FolderPlus size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={onDelete} disabled={!canDelete} label="Delete">
        <Trash2 size={16} />
      </ToolbarButton>
      <div className="mx-1 h-4 w-px" style={{ background: "var(--glass-border)" }} />
      <ToolbarButton onClick={() => onViewModeChange("icon")} label="Icon view" active={viewMode === "icon"}>
        <Grid2x2 size={16} />
      </ToolbarButton>
      <ToolbarButton onClick={() => onViewModeChange("list")} label="List view" active={viewMode === "list"}>
        <List size={16} />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  children,
  onClick,
  disabled,
  active,
  label,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-md disabled:opacity-30"
      style={{ background: active ? "var(--glass-bg-strong)" : "transparent" }}
    >
      {children}
    </button>
  );
}

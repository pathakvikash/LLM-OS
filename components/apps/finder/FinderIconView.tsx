"use client";

import { useEffect, useRef, useState } from "react";
import type { FSNode } from "@/lib/fs/vfs";
import { iconForNode } from "./nodeIcon";
import { cn } from "@/lib/utils/cn";

interface FinderIconViewProps {
  items: FSNode[];
  selectedId: string | null;
  renamingId: string | null;
  onSelect: (id: string) => void;
  onOpen: (node: FSNode) => void;
  onCommitRename: (id: string, newName: string) => void;
  onCancelRename: () => void;
}

export default function FinderIconView({
  items,
  selectedId,
  renamingId,
  onSelect,
  onOpen,
  onCommitRename,
  onCancelRename,
}: FinderIconViewProps) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2 p-4">
      {items.map((item) => {
        const Icon = iconForNode(item);
        const isSelected = selectedId === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onSelect(item.id)}
            onDoubleClick={() => onOpen(item)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-lg p-2 text-center outline-none",
              isSelected && "ring-1"
            )}
            style={{
              background: isSelected ? "var(--glass-bg-strong)" : "transparent",
            }}
          >
            <Icon size={40} strokeWidth={1.25} style={{ color: "var(--text-primary)" }} />
            {renamingId === item.id ? (
              <RenameInput
                initialValue={item.name}
                onCommit={(name) => onCommitRename(item.id, name)}
                onCancel={onCancelRename}
              />
            ) : (
              <span className="line-clamp-2 max-w-[80px] text-[12px] break-words">{item.name}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function RenameInput({
  initialValue,
  onCommit,
  onCancel,
}: {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialValue);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.select();
  }, []);

  return (
    <input
      ref={ref}
      value={value}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onCommit(value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onCommit(value);
        if (e.key === "Escape") onCancel();
      }}
      className="w-[84px] rounded border bg-black/30 px-1 text-center text-[12px] outline-none"
      style={{ borderColor: "var(--accent-primary)" }}
    />
  );
}

"use client";

import type { FSNode } from "@/lib/fs/vfs";
import { iconForNode } from "./nodeIcon";
import { cn } from "@/lib/utils/cn";
import { formatBytes, formatDate } from "@/lib/utils/format";

interface FinderListViewProps {
  items: FSNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpen: (node: FSNode) => void;
}

export default function FinderListView({ items, selectedId, onSelect, onOpen }: FinderListViewProps) {
  return (
    <table className="w-full text-left text-[12px]">
      <thead>
        <tr style={{ color: "var(--text-muted)" }}>
          <th className="px-4 py-1.5 font-normal">Name</th>
          <th className="px-4 py-1.5 font-normal">Date Modified</th>
          <th className="px-4 py-1.5 font-normal">Size</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => {
          const Icon = iconForNode(item);
          const isSelected = selectedId === item.id;
          return (
            <tr
              key={item.id}
              onClick={() => onSelect(item.id)}
              onDoubleClick={() => onOpen(item)}
              className={cn("cursor-default")}
              style={{ background: isSelected ? "var(--glass-bg-strong)" : "transparent" }}
            >
              <td className="flex items-center gap-2 px-4 py-1.5">
                <Icon size={16} strokeWidth={1.5} />
                {item.name}
              </td>
              <td className="px-4 py-1.5" style={{ color: "var(--text-secondary)" }}>
                {formatDate(item.modifiedAt)}
              </td>
              <td className="px-4 py-1.5" style={{ color: "var(--text-secondary)" }}>
                {item.type === "folder" ? "--" : formatBytes(item.size)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

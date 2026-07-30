"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Command } from "lucide-react";
import { useWindowStore } from "@/stores/useWindowStore";

export default function AppleMenu() {
  const openWindow = useWindowStore((s) => s.openWindow);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center rounded px-1 py-0.5 outline-none hover:bg-white/10 data-[state=open]:bg-white/15">
          <Command size={14} strokeWidth={2.25} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="glass-strong z-50 min-w-[220px] rounded-[10px] p-1 text-[13px] shadow-2xl"
        >
          <DropdownMenu.Item
            disabled
            className="rounded-[6px] px-2 py-1.5 outline-none opacity-60"
          >
            About This LLM-OS
          </DropdownMenu.Item>
          <DropdownMenu.Separator
            className="my-1 h-px"
            style={{ background: "var(--glass-border)" }}
          />
          <DropdownMenu.Item
            onSelect={() => openWindow("settings")}
            className="rounded-[6px] px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--accent-primary)]"
          >
            System Settings…
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

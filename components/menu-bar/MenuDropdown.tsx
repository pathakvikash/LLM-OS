"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { MenuDefinition, MenuItemDefinition } from "@/lib/apps/registry";

export default function MenuDropdown({
  menu,
  onSelect,
}: {
  menu: MenuDefinition;
  onSelect: (item: MenuItemDefinition) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="rounded px-1.5 py-0.5 outline-none hover:bg-white/10 data-[state=open]:bg-white/15"
          style={{ color: "var(--text-secondary)" }}
        >
          {menu.label}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="glass-strong z-50 min-w-[200px] rounded-[10px] p-1 text-[13px] shadow-2xl"
        >
          {menu.items.map((item, i) =>
            item.separator ? (
              <DropdownMenu.Separator
                key={i}
                className="my-1 h-px"
                style={{ background: "var(--glass-border)" }}
              />
            ) : (
              <DropdownMenu.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={() => onSelect(item)}
                className="flex items-center justify-between rounded-[6px] px-2 py-1.5 outline-none data-[highlighted]:bg-[var(--accent-primary)] data-[disabled]:opacity-40"
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span style={{ color: "var(--text-muted)" }}>{item.shortcut}</span>
                )}
              </DropdownMenu.Item>
            )
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

"use client";

import { useEffect, useMemo, useState, type ComponentType } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useLiveQuery } from "dexie-react-hooks";
import Fuse from "fuse.js";
import { Folder, File as FileIcon, Search } from "lucide-react";
import { getSpotlightApps, type AppIconProps } from "@/lib/apps/registry";
import { db } from "@/lib/fs/db";
import { ROOT_ID } from "@/lib/fs/vfs";
import { useWindowStore } from "@/stores/useWindowStore";
import { useSpotlightStore } from "@/stores/useSpotlightStore";
import { useFinderTarget } from "@/stores/useFinderTarget";

interface SpotlightResult {
  id: string;
  label: string;
  kind: "app" | "folder" | "file";
  refId: string;
  parentId?: string | null;
  icon?: ComponentType<AppIconProps>;
}

export default function Spotlight() {
  const isOpen = useSpotlightStore((s) => s.isOpen);
  const close = useSpotlightStore((s) => s.close);
  const openWindow = useWindowStore((s) => s.openWindow);

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const apps = useMemo(() => getSpotlightApps(), []);
  const nodes = useLiveQuery(() => db.nodes.toArray(), []) ?? [];

  const corpus = useMemo<SpotlightResult[]>(() => {
    const appItems: SpotlightResult[] = apps.map((a) => ({
      id: `app:${a.id}`,
      label: a.name,
      kind: "app",
      refId: a.id,
      icon: a.icon,
    }));
    const nodeItems: SpotlightResult[] = nodes
      .filter((n) => n.id !== ROOT_ID)
      .map((n) => ({
        id: `node:${n.id}`,
        label: n.name,
        kind: n.type === "folder" ? "folder" : "file",
        refId: n.id,
        parentId: n.parentId,
      }));
    return [...appItems, ...nodeItems];
  }, [apps, nodes]);

  const fuse = useMemo(() => new Fuse(corpus, { keys: ["label"], threshold: 0.4 }), [corpus]);

  const results = useMemo(() => {
    if (!query.trim()) return corpus.filter((c) => c.kind === "app").slice(0, 8);
    return fuse
      .search(query)
      .map((r) => r.item)
      .slice(0, 8);
  }, [query, fuse, corpus]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, isOpen]);

  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen]);

  function launch(result: SpotlightResult) {
    if (result.kind === "app") {
      openWindow(result.refId);
    } else if (result.kind === "folder") {
      openWindow("finder");
      useFinderTarget.getState().reveal(result.refId);
    } else {
      openWindow("finder");
      useFinderTarget.getState().reveal(result.parentId ?? ROOT_ID);
    }
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      if (results[selectedIndex]) launch(results[selectedIndex]);
    }
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && close()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <Dialog.Content
              aria-describedby={undefined}
              onOpenAutoFocus={(e) => e.preventDefault()}
              asChild
            >
              <motion.div
                className="glass-strong fixed left-1/2 top-32 z-50 w-[560px] -translate-x-1/2 overflow-hidden rounded-(--radius-lg) shadow-2xl"
                initial={{ opacity: 0, scale: 0.96, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <Dialog.Title className="sr-only">Spotlight Search</Dialog.Title>
                <div
                  className="flex items-center gap-3 border-b px-4 py-3"
                  style={{ borderColor: "var(--glass-border)" }}
                >
                  <Search size={18} style={{ color: "var(--text-muted)" }} />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Spotlight Search"
                    className="flex-1 bg-transparent text-[18px] outline-none"
                  />
                </div>
                {results.length > 0 && (
                  <div className="max-h-80 overflow-auto p-2">
                    {results.map((result, i) => {
                      const Icon = result.icon ?? (result.kind === "folder" ? Folder : FileIcon);
                      const isSelected = i === selectedIndex;
                      return (
                        <button
                          key={result.id}
                          onClick={() => launch(result)}
                          onMouseEnter={() => setSelectedIndex(i)}
                          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px]"
                          style={{ background: isSelected ? "var(--accent-primary)" : "transparent" }}
                        >
                          <Icon size={18} strokeWidth={1.5} />
                          <span className="flex-1 truncate">{result.label}</span>
                          <span
                            className="text-[11px] capitalize"
                            style={{ color: isSelected ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}
                          >
                            {result.kind}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}

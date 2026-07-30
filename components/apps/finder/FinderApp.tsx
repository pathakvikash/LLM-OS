"use client";

import { useCallback, useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ROOT_ID, list, getPath, mkdir, rm, rename, writeFile, type FSNode } from "@/lib/fs/vfs";
import { ensureSeeded } from "@/lib/fs/seed";
import type { WindowAppProps } from "@/lib/apps/registry";
import { useMenuCommand } from "@/lib/commands/menuBus";
import FinderSidebar from "./FinderSidebar";
import FinderToolbar from "./FinderToolbar";
import FinderIconView from "./FinderIconView";
import FinderListView from "./FinderListView";
import FilePreview from "./FilePreview";

export default function FinderApp({ windowId }: WindowAppProps) {
  const [ready, setReady] = useState(false);
  const [history, setHistory] = useState<string[]>([ROOT_ID]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"icon" | "list">("icon");
  const [previewNode, setPreviewNode] = useState<FSNode | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const cwdId = history[historyIndex];

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  const items = useLiveQuery(() => (ready ? list(cwdId) : []), [ready, cwdId]) ?? [];
  const path = useLiveQuery(() => (ready ? getPath(cwdId) : "/"), [ready, cwdId]) ?? "/";

  const navigate = useCallback(
    (id: string) => {
      setHistory((h) => [...h.slice(0, historyIndex + 1), id]);
      setHistoryIndex((i) => i + 1);
      setSelectedId(null);
      setPreviewNode(null);
    },
    [historyIndex]
  );

  const goBack = useCallback(() => {
    setHistoryIndex((i) => Math.max(0, i - 1));
    setPreviewNode(null);
  }, []);

  const goForward = useCallback(() => {
    setHistoryIndex((i) => Math.min(history.length - 1, i + 1));
    setPreviewNode(null);
  }, [history.length]);

  const openItem = useCallback(
    (node: FSNode) => {
      if (node.type === "folder") navigate(node.id);
      else setPreviewNode(node);
    },
    [navigate]
  );

  const handleNewFolder = useCallback(async () => {
    let name = "untitled folder";
    let n = 2;
    while (items.some((i) => i.name === name)) {
      name = `untitled folder ${n++}`;
    }
    const node = await mkdir(cwdId, name);
    setSelectedId(node.id);
    setRenamingId(node.id);
  }, [cwdId, items]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    const node = items.find((i) => i.id === selectedId);
    if (!node) return;
    if (!window.confirm(`Delete "${node.name}"? This cannot be undone.`)) return;
    await rm(selectedId, { recursive: true });
    setSelectedId(null);
  }, [selectedId, items]);

  const handleCommitRename = useCallback(async (id: string, newName: string) => {
    setRenamingId(null);
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await rename(id, trimmed);
    } catch {
      // name clash or invalid — silently keep the previous name
    }
  }, []);

  useMenuCommand(
    windowId,
    useCallback(
      (commandId) => {
        if (commandId === "finder:new-folder") handleNewFolder();
        if (commandId === "finder:delete") handleDelete();
      },
      [handleNewFolder, handleDelete]
    )
  );

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const isText = file.type.startsWith("text/") || /\.(txt|md|json|js|ts|tsx|css|html|csv|log)$/i.test(file.name);
      const content = isText ? await file.text() : file;
      await writeFile(cwdId, file.name, content, file.type || undefined);
    }
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        Loading filesystem…
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <FinderSidebar cwdId={cwdId} onNavigate={navigate} />
      <div className="flex min-w-0 flex-1 flex-col">
        {previewNode ? (
          <FilePreview node={previewNode} onBack={() => setPreviewNode(null)} />
        ) : (
          <>
            <FinderToolbar
              path={path}
              canGoBack={historyIndex > 0}
              canGoForward={historyIndex < history.length - 1}
              onBack={goBack}
              onForward={goForward}
              onNewFolder={handleNewFolder}
              onDelete={handleDelete}
              canDelete={Boolean(selectedId)}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
            />
            <div
              className="min-h-0 flex-1 overflow-auto"
              style={{ background: isDragOver ? "var(--glass-bg)" : "transparent" }}
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              data-testid="finder-dropzone"
            >
              {items.length === 0 ? (
                <p className="p-6 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
                  This folder is empty. Drag files in from your desktop to add them.
                </p>
              ) : viewMode === "icon" ? (
                <FinderIconView
                  items={items}
                  selectedId={selectedId}
                  renamingId={renamingId}
                  onSelect={setSelectedId}
                  onOpen={openItem}
                  onCommitRename={handleCommitRename}
                  onCancelRename={() => setRenamingId(null)}
                />
              ) : (
                <FinderListView items={items} selectedId={selectedId} onSelect={setSelectedId} onOpen={openItem} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

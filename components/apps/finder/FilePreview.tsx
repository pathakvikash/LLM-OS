"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { FSNode } from "@/lib/fs/vfs";
import { updateContent } from "@/lib/fs/vfs";

interface FilePreviewProps {
  node: FSNode;
  onBack: () => void;
}

export default function FilePreview({ node, onBack }: FilePreviewProps) {
  const isText =
    typeof node.content === "string" ||
    node.mimeType?.startsWith("text/") ||
    /\.(txt|md|json|js|ts|tsx|css|html|csv|log)$/i.test(node.name);
  const isImage = node.mimeType?.startsWith("image/");

  // FinderApp keys this component by node.id, so remounting (not an effect)
  // resets text/dirty whenever a different file is opened.
  const [text, setText] = useState(typeof node.content === "string" ? node.content : "");
  const [dirty, setDirty] = useState(false);

  const imageUrl = useMemo(() => {
    if (isImage && node.content instanceof Blob) return URL.createObjectURL(node.content);
    return null;
  }, [isImage, node.content]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  async function save() {
    await updateContent(node.id, text);
    setDirty(false);
  }

  return (
    <div className="flex h-full flex-col">
      <div
        className="flex shrink-0 items-center gap-2 border-b px-3 py-2"
        style={{ borderColor: "var(--glass-border)" }}
      >
        <button onClick={onBack} className="flex items-center gap-1 text-[12px]" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} />
          Back
        </button>
        <span className="text-[13px] font-medium">{node.name}</span>
        {isText && (
          <button
            onClick={save}
            disabled={!dirty}
            className="ml-auto rounded-md px-3 py-1 text-[12px] font-medium text-white disabled:opacity-30"
            style={{ background: "var(--accent-primary)" }}
          >
            Save
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {isImage && imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={node.name} className="max-w-full rounded-md" />
        ) : isText ? (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDirty(true);
            }}
            className="h-full w-full resize-none bg-transparent font-mono text-[13px] outline-none"
            spellCheck={false}
          />
        ) : (
          <p className="text-[13px]" style={{ color: "var(--text-muted)" }}>
            No preview available for this file type.
          </p>
        )}
      </div>
    </div>
  );
}

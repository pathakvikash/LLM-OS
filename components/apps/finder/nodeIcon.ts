import { Folder, FileText, Image as ImageIcon, File } from "lucide-react";
import type { FSNode } from "@/lib/fs/vfs";

export function iconForNode(node: FSNode) {
  if (node.type === "folder") return Folder;
  if (node.mimeType?.startsWith("image/")) return ImageIcon;
  if (node.mimeType?.startsWith("text/") || /\.(txt|md|json|js|ts|tsx|css|html|csv|log)$/i.test(node.name)) {
    return FileText;
  }
  return File;
}

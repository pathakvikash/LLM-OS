import { db } from "./db";
import { ROOT_ID, type FSNode } from "./types";

export { ROOT_ID };
export type { FSNode };

export async function list(folderId: string): Promise<FSNode[]> {
  const items = await db.nodes.where("parentId").equals(folderId).toArray();
  return items.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export async function getNode(id: string): Promise<FSNode | undefined> {
  return db.nodes.get(id);
}

export async function getChildByName(parentId: string, name: string): Promise<FSNode | undefined> {
  const children = await db.nodes.where("parentId").equals(parentId).toArray();
  return children.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export async function getPath(id: string): Promise<string> {
  const segments: string[] = [];
  let current = await db.nodes.get(id);
  while (current && current.id !== ROOT_ID) {
    segments.unshift(current.name);
    current = current.parentId ? await db.nodes.get(current.parentId) : undefined;
  }
  return "/" + segments.join("/");
}

/** Resolves a path relative to cwdId ("/" prefix means absolute from root). Supports "." and "..". */
export async function resolvePath(cwdId: string, path: string): Promise<FSNode | undefined> {
  if (!path || path === ".") return db.nodes.get(cwdId);

  const isAbsolute = path.startsWith("/");
  const parts = path.split("/").filter(Boolean);
  let node = await db.nodes.get(isAbsolute ? ROOT_ID : cwdId);

  for (const part of parts) {
    if (!node) return undefined;
    if (part === ".") continue;
    if (part === "..") {
      node = node.parentId ? await db.nodes.get(node.parentId) : node;
      continue;
    }
    node = await getChildByName(node.id, part);
  }
  return node;
}

function uniqueName(name: string) {
  return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "untitled";
}

export async function mkdir(parentId: string, name: string): Promise<FSNode> {
  const safeName = uniqueName(name);
  const existing = await getChildByName(parentId, safeName);
  if (existing) throw new Error(`"${safeName}" already exists`);

  const now = Date.now();
  const node: FSNode = {
    id: crypto.randomUUID(),
    parentId,
    name: safeName,
    type: "folder",
    size: 0,
    createdAt: now,
    modifiedAt: now,
  };
  await db.nodes.add(node);
  return node;
}

export async function writeFile(
  parentId: string,
  name: string,
  content: string | Blob = "",
  mimeType?: string
): Promise<FSNode> {
  const safeName = uniqueName(name);
  const size = typeof content === "string" ? new Blob([content]).size : content.size;
  const existing = await getChildByName(parentId, safeName);
  const now = Date.now();

  if (existing) {
    await db.nodes.update(existing.id, {
      content,
      size,
      modifiedAt: now,
      mimeType: mimeType ?? existing.mimeType,
    });
    return (await db.nodes.get(existing.id))!;
  }

  const node: FSNode = {
    id: crypto.randomUUID(),
    parentId,
    name: safeName,
    type: "file",
    size,
    createdAt: now,
    modifiedAt: now,
    content,
    mimeType,
  };
  await db.nodes.add(node);
  return node;
}

export async function updateContent(id: string, content: string | Blob): Promise<void> {
  const size = typeof content === "string" ? new Blob([content]).size : content.size;
  await db.nodes.update(id, { content, size, modifiedAt: Date.now() });
}

export async function rename(id: string, newName: string): Promise<void> {
  const node = await db.nodes.get(id);
  if (!node) throw new Error("No such file or directory");
  const safeName = uniqueName(newName);
  if (node.parentId) {
    const clash = await getChildByName(node.parentId, safeName);
    if (clash && clash.id !== id) throw new Error(`"${safeName}" already exists`);
  }
  await db.nodes.update(id, { name: safeName, modifiedAt: Date.now() });
}

export async function mv(id: string, newParentId: string, newName?: string): Promise<void> {
  const node = await db.nodes.get(id);
  if (!node) throw new Error("No such file or directory");
  const name = newName ? uniqueName(newName) : node.name;
  const clash = await getChildByName(newParentId, name);
  if (clash && clash.id !== id) throw new Error(`"${name}" already exists`);
  await db.nodes.update(id, { parentId: newParentId, name, modifiedAt: Date.now() });
}

export async function rm(id: string, opts: { recursive?: boolean } = {}): Promise<void> {
  const node = await db.nodes.get(id);
  if (!node) return;

  if (node.type === "folder") {
    const children = await db.nodes.where("parentId").equals(id).toArray();
    if (children.length && !opts.recursive) {
      throw new Error(`"${node.name}" is not empty`);
    }
    for (const child of children) {
      await rm(child.id, { recursive: true });
    }
  }
  await db.nodes.delete(id);
}

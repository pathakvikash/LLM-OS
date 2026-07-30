import { db } from "./db";
import { ROOT_ID, type FSNode } from "./types";

const WELCOME_TEXT = `Welcome to LLM-OS.

This Finder window and the Terminal both browse the same virtual
filesystem, stored locally in your browser (IndexedDB). Nothing here
touches your real disk.

Try:
- Creating a new folder with the toolbar button
- Dragging a file in from your real desktop
- Opening Terminal and running: ls, cd Documents, cat Welcome.txt
`;

let seeding: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seeding) seeding = seed();
  return seeding;
}

async function seed(): Promise<void> {
  const root = await db.nodes.get(ROOT_ID);
  if (root) return;

  const now = Date.now();
  const documentsId = crypto.randomUUID();

  const nodes: FSNode[] = [
    { id: ROOT_ID, parentId: null, name: "Home", type: "folder", size: 0, createdAt: now, modifiedAt: now },
    { id: crypto.randomUUID(), parentId: ROOT_ID, name: "Desktop", type: "folder", size: 0, createdAt: now, modifiedAt: now },
    { id: documentsId, parentId: ROOT_ID, name: "Documents", type: "folder", size: 0, createdAt: now, modifiedAt: now },
    { id: crypto.randomUUID(), parentId: ROOT_ID, name: "Downloads", type: "folder", size: 0, createdAt: now, modifiedAt: now },
    {
      id: crypto.randomUUID(),
      parentId: documentsId,
      name: "Welcome.txt",
      type: "file",
      size: new Blob([WELCOME_TEXT]).size,
      createdAt: now,
      modifiedAt: now,
      content: WELCOME_TEXT,
      mimeType: "text/plain",
    },
  ];

  await db.nodes.bulkAdd(nodes);
}

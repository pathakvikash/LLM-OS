import Dexie, { type Table } from "dexie";
import type { FSNode } from "./types";

class VfsDatabase extends Dexie {
  nodes!: Table<FSNode, string>;

  constructor() {
    super("llmos-vfs");
    this.version(1).stores({
      nodes: "id, parentId, name",
    });
  }
}

export const db = new VfsDatabase();

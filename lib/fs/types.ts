export const ROOT_ID = "root";

export type FSNodeType = "file" | "folder";

export interface FSNode {
  id: string;
  parentId: string | null;
  name: string;
  type: FSNodeType;
  size: number;
  createdAt: number;
  modifiedAt: number;
  content?: string | Blob;
  mimeType?: string;
}

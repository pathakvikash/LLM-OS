import {
  list,
  resolvePath,
  getPath,
  getChildByName,
  mkdir as vfsMkdir,
  writeFile,
  rm as vfsRm,
  mv as vfsMv,
} from "@/lib/fs/vfs";
import type { CommandFn } from "./types";

export const ls: CommandFn = async (args, ctx) => {
  const path = args.find((a) => !a.startsWith("-")) ?? ".";
  const target = await resolvePath(ctx.cwdId, path);
  if (!target) return { error: `ls: ${path}: No such file or directory` };
  if (target.type === "file") return { output: [target.name] };

  const children = await list(target.id);
  if (children.length === 0) return { output: [] };
  return {
    output: [children.map((c) => (c.type === "folder" ? `${c.name}/` : c.name)).join("  ")],
  };
};

export const cd: CommandFn = async (args, ctx) => {
  const path = args[0] ?? "/";
  const target = await resolvePath(ctx.cwdId, path);
  if (!target) return { error: `cd: ${path}: No such file or directory` };
  if (target.type !== "folder") return { error: `cd: ${path}: not a directory` };
  return { cwdId: target.id };
};

export const pwd: CommandFn = async (_args, ctx) => {
  return { output: [await getPath(ctx.cwdId)] };
};

export const cat: CommandFn = async (args, ctx) => {
  if (!args[0]) return { error: "usage: cat <file>" };
  const target = await resolvePath(ctx.cwdId, args[0]);
  if (!target) return { error: `cat: ${args[0]}: No such file or directory` };
  if (target.type !== "file") return { error: `cat: ${args[0]}: Is a directory` };
  if (typeof target.content === "string") return { output: target.content.split("\n") };
  return { error: `cat: ${args[0]}: binary file (cannot display)` };
};

/**
 * Splits "Documents/notes.txt" into the folder to create it in and the leaf
 * name, so `mkdir` and `touch` accept a path like every other command here.
 */
async function resolveParent(
  cwdId: string,
  target: string
): Promise<{ parentId: string; name: string } | null> {
  const clean = target.replace(/\/+$/, "");
  const index = clean.lastIndexOf("/");
  if (index === -1) return { parentId: cwdId, name: clean };

  const parent = await resolvePath(cwdId, index === 0 ? "/" : clean.slice(0, index));
  if (!parent || parent.type !== "folder") return null;
  return { parentId: parent.id, name: clean.slice(index + 1) };
}

export const mkdirCmd: CommandFn = async (args, ctx) => {
  if (!args[0]) return { error: "usage: mkdir <name>" };
  const target = await resolveParent(ctx.cwdId, args[0]);
  if (!target || !target.name) return { error: `mkdir: ${args[0]}: No such file or directory` };
  try {
    await vfsMkdir(target.parentId, target.name);
    return {};
  } catch (e) {
    return { error: `mkdir: ${(e as Error).message}` };
  }
};

export const touch: CommandFn = async (args, ctx) => {
  if (!args[0]) return { error: "usage: touch <name>" };
  const target = await resolveParent(ctx.cwdId, args[0]);
  if (!target || !target.name) return { error: `touch: ${args[0]}: No such file or directory` };
  const existing = await getChildByName(target.parentId, target.name);
  if (!existing) await writeFile(target.parentId, target.name, "");
  return {};
};

export const echo: CommandFn = async (args, ctx) => {
  const redirectIdx = args.findIndex((a) => a === ">" || a === ">>");
  if (redirectIdx === -1) return { output: [args.join(" ")] };

  const text = args.slice(0, redirectIdx).join(" ");
  const filename = args[redirectIdx + 1];
  if (!filename) return { error: "echo: syntax error near unexpected token `newline'" };

  if (args[redirectIdx] === ">>") {
    const existing = await resolvePath(ctx.cwdId, filename);
    const prefix = existing && typeof existing.content === "string" ? existing.content + "\n" : "";
    await writeFile(ctx.cwdId, filename, prefix + text);
  } else {
    await writeFile(ctx.cwdId, filename, text);
  }
  return {};
};

export const rmCmd: CommandFn = async (args, ctx) => {
  const recursive = args.includes("-r") || args.includes("-rf") || args.includes("-fr");
  const targets = args.filter((a) => !a.startsWith("-"));
  if (targets.length === 0) return { error: "usage: rm [-r] <name>" };

  for (const t of targets) {
    const node = await resolvePath(ctx.cwdId, t);
    if (!node) return { error: `rm: ${t}: No such file or directory` };
    try {
      await vfsRm(node.id, { recursive });
    } catch (e) {
      return { error: `rm: ${(e as Error).message}` };
    }
  }
  return {};
};

export const mvCmd: CommandFn = async (args, ctx) => {
  if (args.length < 2) return { error: "usage: mv <source> <dest>" };
  const [srcPath, destPath] = args;
  const src = await resolvePath(ctx.cwdId, srcPath);
  if (!src) return { error: `mv: ${srcPath}: No such file or directory` };

  const destAsFolder = await resolvePath(ctx.cwdId, destPath);
  try {
    if (destAsFolder && destAsFolder.type === "folder") {
      await vfsMv(src.id, destAsFolder.id);
    } else {
      const parts = destPath.split("/");
      const newName = parts.pop()!;
      const parentPath = parts.join("/") || ".";
      const parent = await resolvePath(ctx.cwdId, parentPath);
      if (!parent) return { error: `mv: ${destPath}: No such file or directory` };
      await vfsMv(src.id, parent.id, newName);
    }
  } catch (e) {
    return { error: `mv: ${(e as Error).message}` };
  }
  return {};
};

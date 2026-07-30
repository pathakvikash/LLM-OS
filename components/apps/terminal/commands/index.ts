import { ls, cd, pwd, cat, mkdirCmd, touch, echo, rmCmd, mvCmd } from "./fs";
import { whoami, dateCmd, clearCmd, help } from "./misc";
import type { CommandFn } from "./types";

export type { CommandContext, CommandResult, CommandFn } from "./types";

export const COMMANDS: Record<string, CommandFn> = {
  ls,
  cd,
  pwd,
  cat,
  mkdir: mkdirCmd,
  touch,
  echo,
  rm: rmCmd,
  mv: mvCmd,
  whoami,
  date: dateCmd,
  clear: clearCmd,
  help,
};

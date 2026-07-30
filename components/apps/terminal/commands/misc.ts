import type { CommandFn } from "./types";

export const whoami: CommandFn = async () => ({ output: ["guest"] });

export const dateCmd: CommandFn = async () => ({ output: [new Date().toString()] });

export const clearCmd: CommandFn = async () => ({ clear: true });

export const help: CommandFn = async () => ({
  output: [
    "Available commands:",
    "  ls [path]           list directory contents",
    "  cd [path]           change directory",
    "  pwd                 print working directory",
    "  cat <file>          print file contents",
    "  mkdir <name>        create a directory",
    "  touch <name>        create an empty file",
    "  echo <text>         print text (supports > and >> redirection)",
    "  rm [-r] <name>      remove a file or directory",
    "  mv <src> <dest>     move or rename a file or directory",
    "  whoami              print the current user",
    "  date                print the current date and time",
    "  clear               clear the terminal",
    "  help                show this message",
  ],
});

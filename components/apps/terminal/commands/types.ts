export interface CommandContext {
  cwdId: string;
}

export interface CommandResult {
  output?: string[];
  error?: string;
  cwdId?: string;
  clear?: boolean;
}

export type CommandFn = (args: string[], ctx: CommandContext) => Promise<CommandResult>;

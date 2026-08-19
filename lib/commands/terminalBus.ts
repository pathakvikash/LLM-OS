"use client";

import { useEffect } from "react";

/**
 * Agent shell activity, echoed into every open Terminal window. An agent that
 * runs a command should leave the same trace a person would — otherwise the
 * work happens invisibly and the Terminal you asked it to open sits empty.
 */
export interface TerminalActivity {
  id: string;
  /** Who ran it, rendered in place of the usual prompt. */
  actor: string;
  command: string;
  output?: string;
  error?: string;
}

type Listener = (activity: TerminalActivity) => void;

const listeners = new Set<Listener>();

export function emitTerminalActivity(activity: TerminalActivity) {
  listeners.forEach((listener) => listener(activity));
}

export function useTerminalActivity(handler: Listener) {
  useEffect(() => {
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, [handler]);
}

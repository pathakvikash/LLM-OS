"use client";

import { useEffect } from "react";

type Listener = (commandId: string) => void;

const listeners = new Map<string, Set<Listener>>();

export function emitMenuCommand(windowId: string, commandId: string) {
  listeners.get(windowId)?.forEach((listener) => listener(commandId));
}

/** Subscribes an app instance to menu commands addressed to its own windowId. */
export function useMenuCommand(windowId: string, handler: Listener) {
  useEffect(() => {
    let set = listeners.get(windowId);
    if (!set) {
      set = new Set();
      listeners.set(windowId, set);
    }
    set.add(handler);
    return () => {
      set!.delete(handler);
      if (set!.size === 0) listeners.delete(windowId);
    };
  }, [windowId, handler]);
}

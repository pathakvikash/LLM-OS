"use client";

import { create } from "zustand";

interface FinderTargetState {
  pendingFolderId: string | null;
  reveal: (folderId: string) => void;
  consume: () => string | null;
}

/**
 * Lets Spotlight (or anything else) tell Finder to navigate to a folder,
 * without a race against Finder's own mount/subscribe timing: Finder reads
 * and clears this on mount/update rather than relying on an already-live listener.
 */
export const useFinderTarget = create<FinderTargetState>((set, get) => ({
  pendingFolderId: null,
  reveal: (folderId) => set({ pendingFolderId: folderId }),
  consume: () => {
    const id = get().pendingFolderId;
    set({ pendingFolderId: null });
    return id;
  },
}));

"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  DEFAULT_PROVIDER_ID,
  getProvider,
  serverListModels,
  serverProviders,
  type LlmModel,
} from "@/lib/llm";

/**
 * The operator's own model access. Everything here is optional: with no key the
 * app plans with rules exactly as it always has, and nothing in this store is
 * consulted beyond `isLlmReady`.
 */

export type LlmStatus = "unconfigured" | "checking" | "ready" | "error";

interface LlmState {
  providerId: string;
  /** One key per provider: switching providers must never reuse another's key. */
  keys: Record<string, string>;
  /** Selected models, likewise per provider. */
  chosenModels: Record<string, string>;
  /** Master switch, so a key can stay saved while the model is turned off. */
  enabled: boolean;
  models: LlmModel[];
  status: LlmStatus;
  lastError?: string;
  /** OpenRouter lists hundreds of paid models; free ones only unless asked. */
  freeModelsOnly: boolean;
  /** Off keeps the key in memory only — nothing written to disk, gone on reload. */
  rememberKey: boolean;
  /** Ask before a model-driven run changes anything. On by default. */
  confirmWrites: boolean;
  /** Stop spending past this, in USD. 0 means no cap. */
  spendCapUsd: number;
  spentUsd: number;
  /** Providers this deployment can serve from its own environment. */
  serverBacked: string[];

  setProvider: (id: string) => void;
  /** Saves the key for the provider it belongs to. */
  saveApiKey: (providerId: string, key: string) => void;
  setEnabled: (v: boolean) => void;
  setModel: (id: string) => void;
  setFreeModelsOnly: (v: boolean) => void;
  setRememberKey: (v: boolean) => void;
  setConfirmWrites: (v: boolean) => void;
  setSpendCap: (usd: number) => void;
  recordSpend: (usd: number) => void;
  resetSpend: () => void;
  /** Asks the server which providers it can serve without a browser key. */
  detectServerKeys: () => Promise<void>;
  /** Verifies access by listing models; also fills the model picker. */
  testConnection: () => Promise<boolean>;
  clearKey: () => void;
}

export const useLlmStore = create<LlmState>()(
  persist(
    (set, get) => ({
      providerId: DEFAULT_PROVIDER_ID,
      keys: {},
      chosenModels: {},
      enabled: true,
      models: [],
      status: "unconfigured",
      freeModelsOnly: true,
      rememberKey: true,
      confirmWrites: true,
      spendCapUsd: 0,
      spentUsd: 0,
      serverBacked: [],

      detectServerKeys: async () => {
        const providers = await serverProviders();
        set({ serverBacked: providers });
        // A key held by the server needs nothing typed here to become ready.
        if (providers.includes(get().providerId) && get().status !== "ready") {
          await get().testConnection();
        }
      },

      // Switching provider swaps in that provider's own key and model.
      setProvider: (providerId) =>
        set({ providerId, models: [], status: "unconfigured", lastError: undefined }),

      saveApiKey: (providerId, key) =>
        set((s) => ({
          keys: { ...s.keys, [providerId]: key.trim() },
          status: "unconfigured",
          lastError: undefined,
        })),

      setEnabled: (enabled) => set({ enabled }),
      setModel: (model) =>
        set((s) => ({ chosenModels: { ...s.chosenModels, [s.providerId]: model } })),
      setFreeModelsOnly: (freeModelsOnly) => set({ freeModelsOnly }),
      setRememberKey: (rememberKey) => set({ rememberKey }),
      setConfirmWrites: (confirmWrites) => set({ confirmWrites }),
      setSpendCap: (spendCapUsd) => set({ spendCapUsd: Math.max(0, spendCapUsd) }),
      recordSpend: (usd) => set((s) => ({ spentUsd: s.spentUsd + usd })),
      resetSpend: () => set({ spentUsd: 0 }),

      testConnection: async () => {
        const { providerId, keys, chosenModels, freeModelsOnly, serverBacked } = get();
        const apiKey = keys[providerId] ?? "";
        const viaServer = serverBacked.includes(providerId);
        if (!viaServer && !apiKey.trim()) {
          set({ status: "unconfigured", lastError: "No key saved for this provider" });
          return false;
        }
        set({ status: "checking", lastError: undefined });
        try {
          const models = viaServer
            ? await serverListModels(providerId)
            : await getProvider(providerId).listModels(apiKey);
          const offered = freeModelsOnly && models.some((m) => m.free) ? models.filter((m) => m.free) : models;
          const chosen = chosenModels[providerId];
          set({
            models,
            status: "ready",
            // Keep the chosen model if it is still on offer; otherwise take the first.
            chosenModels: {
              ...chosenModels,
              [providerId]: offered.some((m) => m.id === chosen) ? chosen : (offered[0]?.id ?? ""),
            },
          });
          return true;
        } catch (error) {
          set({ status: "error", lastError: (error as Error).message });
          return false;
        }
      },

      clearKey: () =>
        set((s) => {
          const keys = { ...s.keys };
          delete keys[s.providerId];
          return { keys, models: [], status: "unconfigured", lastError: undefined };
        }),
    }),
    {
      name: "llmos-llm",
      partialize: (state) => ({
        providerId: state.providerId,
        // The one place a key is written to disk — and only with permission.
        keys: state.rememberKey ? state.keys : {},
        rememberKey: state.rememberKey,
        chosenModels: state.chosenModels,
        enabled: state.enabled,
        models: state.models,
        freeModelsOnly: state.freeModelsOnly,
        confirmWrites: state.confirmWrites,
        spendCapUsd: state.spendCapUsd,
        spentUsd: state.spentUsd,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && state.keys?.[state.providerId]) state.status = "ready";
      },
    }
  )
);

/** The key and model in force for the selected provider. */
export function activeCredentials(): { apiKey: string; model: string } {
  const { providerId, keys, chosenModels } = useLlmStore.getState();
  return { apiKey: keys[providerId] ?? "", model: chosenModels[providerId] ?? "" };
}

/** The models offered for the current provider, honouring the free-only filter. */
export function offeredModels(): LlmModel[] {
  const { models, freeModelsOnly } = useLlmStore.getState();
  const free = models.filter((m) => m.free);
  return freeModelsOnly && free.length > 0 ? free : models;
}

/** The single switch every model path is gated on. */
export function isLlmReady(): boolean {
  const { enabled, status, spendCapUsd, spentUsd, providerId, serverBacked } = useLlmStore.getState();
  const { apiKey, model } = activeCredentials();
  const haveAccess = serverBacked.includes(providerId) || Boolean(apiKey.trim());
  if (!enabled || !haveAccess || !model || status === "error") return false;
  return spendCapUsd === 0 || spentUsd < spendCapUsd;
}

/** True when the key lives on the server and never enters this browser. */
export function usesServerKey(): boolean {
  const { providerId, serverBacked } = useLlmStore.getState();
  return serverBacked.includes(providerId);
}

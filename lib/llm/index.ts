import { anthropicProvider } from "./anthropic";
import { nvidiaProvider } from "./nvidia";
import { openRouterProvider } from "./openrouter";
import type { LlmProvider } from "./types";

export const PROVIDERS: LlmProvider[] = [openRouterProvider, nvidiaProvider, anthropicProvider];

export const DEFAULT_PROVIDER_ID = openRouterProvider.id;

export function getProvider(id: string): LlmProvider {
  return PROVIDERS.find((p) => p.id === id) ?? openRouterProvider;
}

export * from "./types";
export { actionsToTools, toolNameToActionId } from "./tools";
export { createOpenAiCompatibleProvider } from "./openaiCompatible";
export { serverProviders, refreshServerProviders, serverListModels, serverComplete } from "./serverProxy";

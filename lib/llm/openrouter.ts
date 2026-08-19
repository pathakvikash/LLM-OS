import { createOpenAiCompatibleProvider } from "./openaiCompatible";

/**
 * OpenRouter: one key, many models — including NVIDIA's Nemotron family and
 * Claude — and it allows browser requests, which makes it the gentlest choice
 * for a key the operator holds themselves.
 */
export const openRouterProvider = createOpenAiCompatibleProvider({
  id: "openrouter",
  label: "OpenRouter",
  baseUrl: "https://openrouter.ai/api/v1",
  keyUrl: "https://openrouter.ai/keys",
  keyHint: "sk-or-…",
  headers: () => ({
    // Guarded rather than assumed: this also runs server-side, behind the proxy route.
    "HTTP-Referer": globalThis.window?.location?.origin ?? "https://llm-os.local",
    "X-Title": "LLM-OS",
  }),
  readPricing: (raw) => {
    const inputPerToken = Number(raw.pricing?.prompt ?? NaN);
    const outputPerToken = Number(raw.pricing?.completion ?? NaN);
    return {
      inputPerToken: Number.isFinite(inputPerToken) ? inputPerToken : undefined,
      outputPerToken: Number.isFinite(outputPerToken) ? outputPerToken : undefined,
      // OpenRouter prices free models at zero and suffixes their id with :free.
      free: (inputPerToken === 0 && outputPerToken === 0) || raw.id.endsWith(":free"),
    };
  },
});

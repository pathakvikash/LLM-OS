import { createOpenAiCompatibleProvider } from "./openaiCompatible";

/**
 * NVIDIA's hosted endpoint for Nemotron and the other models on build.nvidia.com.
 * OpenAI-compatible, so it reuses the shared client; it reports no pricing, so
 * every model is offered rather than filtered by cost.
 */
export const nvidiaProvider = createOpenAiCompatibleProvider({
  id: "nvidia",
  label: "NVIDIA NIM",
  baseUrl: "https://integrate.api.nvidia.com/v1",
  keyUrl: "https://build.nvidia.com/",
  keyHint: "nvapi-…",
  // Nemotron first: it is what most people come here for.
  preferred: ["nemotron"],
});

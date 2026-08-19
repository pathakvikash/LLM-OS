import { LlmError, type LlmModel, type LlmProvider, type LlmRequest, type LlmTurn } from "./types";

/**
 * Anthropic's Messages API, called straight from the browser with the user's own
 * key. That needs an explicit opt-in header — without it the request is refused
 * by CORS — which is why OpenRouter is the gentler default.
 */

const BASE = "https://api.anthropic.com/v1";
const API_VERSION = "2023-06-01";

/** Shown before a key is entered; the live list replaces it. */
const KNOWN_MODELS: LlmModel[] = [
  { id: "claude-opus-5", label: "Claude Opus 5", inputPerToken: 5 / 1_000_000, outputPerToken: 25 / 1_000_000 },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", inputPerToken: 3 / 1_000_000, outputPerToken: 15 / 1_000_000 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", inputPerToken: 1 / 1_000_000, outputPerToken: 5 / 1_000_000 },
];

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

function toWire(messages: LlmTurn[]) {
  return messages.map((turn) => {
    if (turn.role === "user") return { role: "user", content: turn.content };
    if (turn.role === "assistant") {
      const blocks: ContentBlock[] = [];
      if (turn.content) blocks.push({ type: "text", text: turn.content });
      for (const call of turn.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: call.input });
      }
      return { role: "assistant", content: blocks };
    }
    // Tool results go back as a user turn, one block per result.
    return {
      role: "user",
      content: turn.results.map((result) => ({
        type: "tool_result",
        tool_use_id: result.id,
        content: result.content,
        ...(result.isError ? { is_error: true } : {}),
      })),
    };
  });
}

async function call<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": API_VERSION,
        // Required to call the API directly from a browser.
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  } catch (error) {
    throw new LlmError(
      `Could not reach Anthropic from the browser (${(error as Error).message}). If this is a CORS refusal, use OpenRouter instead, or run this app behind your own server.`
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new LlmError(
      response.status === 401
        ? "Anthropic rejected that key."
        : `Anthropic returned ${response.status}: ${body.slice(0, 200) || response.statusText}`,
      response.status
    );
  }
  return (await response.json()) as T;
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  label: "Anthropic",
  keyUrl: "https://console.anthropic.com/settings/keys",
  keyHint: "sk-ant-…",

  async listModels(apiKey) {
    try {
      const data = await call<{ data: { id: string; display_name?: string }[] }>("/models?limit=100", apiKey);
      const live = data.data.map<LlmModel>((model) => {
        const known = KNOWN_MODELS.find((k) => k.id === model.id);
        return {
          id: model.id,
          label: model.display_name ?? model.id,
          inputPerToken: known?.inputPerToken,
          outputPerToken: known?.outputPerToken,
          free: false,
        };
      });
      return live.length > 0 ? live : KNOWN_MODELS;
    } catch {
      // A models listing is a convenience; the known ids still work.
      return KNOWN_MODELS;
    }
  },

  async complete(request: LlmRequest, apiKey) {
    const body = {
      model: request.model,
      system: request.system,
      messages: toWire(request.messages),
      // Not lowballed: a truncated plan is worse than a slow one.
      max_tokens: request.maxTokens ?? 16000,
      ...(request.tools?.length
        ? {
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.parameters,
            })),
          }
        : {}),
    };

    const data = await call<{
      content: ContentBlock[];
      stop_reason?: string;
      usage?: { input_tokens?: number; output_tokens?: number };
    }>("/messages", apiKey, { method: "POST", body: JSON.stringify(body), signal: request.signal });

    const text = data.content
      .filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("\n")
      .trim();

    return {
      text,
      toolCalls: data.content
        .filter((block) => block.type === "tool_use")
        .map((block) => ({ id: block.id ?? crypto.randomUUID(), name: block.name ?? "", input: block.input ?? {} })),
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      stopReason: data.stop_reason ?? "end_turn",
    };
  },
};

import { LlmError, type LlmModel, type LlmProvider, type LlmRequest, type LlmTurn } from "./types";

/**
 * One implementation for every provider that speaks the OpenAI chat shape —
 * OpenRouter, NVIDIA NIM, and anything else you point at a base URL. Adding a
 * provider is a config entry, not another client.
 */

export interface OpenAiCompatibleConfig {
  id: string;
  label: string;
  baseUrl: string;
  keyUrl: string;
  keyHint: string;
  /** Sent on every request, for providers that want attribution. */
  headers?: () => Record<string, string>;
  /** Provider-specific reading of what a model costs. */
  readPricing?: (raw: RawModel) => Pick<LlmModel, "inputPerToken" | "outputPerToken" | "free">;
  /** Models listed first in the picker, matched by substring. */
  preferred?: string[];
  maxTokens?: number;
}

export interface RawModel {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
}

interface WireMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[];
}

interface OpenAiToolCall {
  id: string;
  function: { name: string; arguments: string };
}

function toWire(messages: LlmTurn[]): WireMessage[] {
  return messages.flatMap<WireMessage>((turn) => {
    if (turn.role === "user") return [{ role: "user", content: turn.content }];
    if (turn.role === "assistant") {
      return [
        {
          role: "assistant",
          content: turn.content || null,
          ...(turn.toolCalls?.length
            ? {
                tool_calls: turn.toolCalls.map((call) => ({
                  id: call.id,
                  type: "function",
                  function: { name: call.name, arguments: JSON.stringify(call.input) },
                })),
              }
            : {}),
        },
      ];
    }
    return turn.results.map((result) => ({
      role: "tool",
      tool_call_id: result.id,
      content: result.content,
    }));
  });
}

function parseArguments(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function createOpenAiCompatibleProvider(config: OpenAiCompatibleConfig): LlmProvider {
  async function call<T>(path: string, apiKey: string, init?: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetch(`${config.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...config.headers?.(),
          ...init?.headers,
        },
      });
    } catch (error) {
      throw new LlmError(
        `Could not reach ${config.label} (${(error as Error).message}). If the browser refused it as a cross-origin request, set a server-side key instead.`
      );
    }

    if (!response.ok) {
      const body = await response.text();
      throw new LlmError(
        response.status === 401
          ? `${config.label} rejected that key.`
          : `${config.label} returned ${response.status}: ${body.slice(0, 200) || response.statusText}`,
        response.status
      );
    }
    return (await response.json()) as T;
  }

  return {
    id: config.id,
    label: config.label,
    keyUrl: config.keyUrl,
    keyHint: config.keyHint,

    async listModels(apiKey) {
      const data = await call<{ data: RawModel[] }>("/models", apiKey);
      const models = data.data.map<LlmModel>((model) => ({
        id: model.id,
        label: model.name ?? model.id,
        contextWindow: model.context_length,
        ...(config.readPricing?.(model) ?? {}),
      }));

      const rank = (model: LlmModel) =>
        config.preferred?.findIndex((hint) => model.id.toLowerCase().includes(hint.toLowerCase())) ?? -1;
      return models.sort((a, b) => {
        // Preferred models float to the top, everything else stays alphabetical.
        const [ra, rb] = [rank(a), rank(b)];
        if (ra !== rb) return (ra === -1 ? 99 : ra) - (rb === -1 ? 99 : rb);
        return a.label.localeCompare(b.label);
      });
    },

    async complete(request: LlmRequest, apiKey) {
      const body = {
        model: request.model,
        messages: [{ role: "system", content: request.system }, ...toWire(request.messages)],
        max_tokens: request.maxTokens ?? config.maxTokens ?? 8000,
        ...(request.tools?.length
          ? {
              tools: request.tools.map((tool) => ({
                type: "function",
                function: { name: tool.name, description: tool.description, parameters: tool.parameters },
              })),
            }
          : {}),
      };

      const data = await call<{
        choices: { message: { content?: string; tool_calls?: OpenAiToolCall[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      }>("/chat/completions", apiKey, { method: "POST", body: JSON.stringify(body), signal: request.signal });

      const choice = data.choices?.[0];
      if (!choice) throw new LlmError(`${config.label} returned no choices`);

      return {
        text: choice.message.content ?? "",
        toolCalls: (choice.message.tool_calls ?? []).map((call) => ({
          id: call.id,
          name: call.function.name,
          input: parseArguments(call.function.arguments),
        })),
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
        stopReason: choice.finish_reason ?? "stop",
      };
    },
  };
}

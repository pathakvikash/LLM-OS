/**
 * A provider-neutral shape for talking to a model. Everything above this file
 * works the same whether the key belongs to OpenRouter, Anthropic, or something
 * added later — and the app runs with no provider at all.
 */

export interface LlmModel {
  id: string;
  label: string;
  /** USD per input/output token, when the provider tells us. */
  inputPerToken?: number;
  outputPerToken?: number;
  contextWindow?: number;
  /** Costs nothing to call, where the provider says so. */
  free?: boolean;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResult {
  id: string;
  content: string;
  isError?: boolean;
}

export type LlmTurn =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string; toolCalls?: LlmToolCall[] }
  | { role: "tool"; results: LlmToolResult[] };

export interface LlmTool {
  name: string;
  description: string;
  /** JSON Schema for the tool's arguments. */
  parameters: {
    type: "object";
    properties: Record<string, { type: "string"; description: string }>;
    required: string[];
    additionalProperties: false;
  };
}

export interface LlmRequest {
  model: string;
  system: string;
  messages: LlmTurn[];
  tools?: LlmTool[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  /** Provider's own stop reason, for logging. */
  stopReason: string;
}

export interface LlmProvider {
  id: string;
  label: string;
  /** Where the user gets a key, shown in Settings. */
  keyUrl: string;
  keyHint: string;
  listModels(apiKey: string): Promise<LlmModel[]>;
  complete(request: LlmRequest, apiKey: string): Promise<LlmResponse>;
}

/** Thrown with a message worth showing the operator verbatim. */
export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = "LlmError";
  }
}

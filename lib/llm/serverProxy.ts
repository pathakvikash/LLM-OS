import type { LlmModel, LlmRequest, LlmResponse } from "./types";
import { LlmError } from "./types";

/**
 * Talks to this app's own /api/llm route, which holds the key in its
 * environment. The browser sends no credential and receives none.
 */

let availability: Promise<string[]> | null = null;

/** Provider ids this deployment can serve without a browser-held key. */
export function serverProviders(): Promise<string[]> {
  if (!availability) {
    availability = fetch("/api/llm")
      .then((response) => (response.ok ? response.json() : { providers: [] }))
      .then((data: { providers?: string[] }) => data.providers ?? [])
      .catch(() => []);
  }
  return availability;
}

/** Forgets the cached answer, e.g. after a deploy changes its environment. */
export function refreshServerProviders() {
  availability = null;
}

async function post<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new LlmError(data.error ?? `Server route returned ${response.status}`, response.status);
  return data;
}

export async function serverListModels(providerId: string): Promise<LlmModel[]> {
  const { models } = await post<{ models: LlmModel[] }>({ providerId, action: "models" });
  return models;
}

export async function serverComplete(providerId: string, request: LlmRequest): Promise<LlmResponse> {
  // AbortSignal cannot cross the wire; the caller still controls the run itself.
  const { signal, ...rest } = request;
  void signal;
  const { response } = await post<{ response: LlmResponse }>({
    providerId,
    action: "complete",
    request: rest,
  });
  return response;
}

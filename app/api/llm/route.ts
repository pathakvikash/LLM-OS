import { NextResponse } from "next/server";
import { getProvider } from "@/lib/llm";
import type { LlmRequest } from "@/lib/llm";

/**
 * The secure way to hold a key: set it in the server's environment and it never
 * reaches the browser at all. Requests are proxied here, the key is attached
 * server-side, and the response goes back without it.
 *
 * Entirely optional. With no environment key this route reports itself
 * unavailable and the app falls back to a key the operator types in — which is
 * their own key in their own browser, the usual bring-your-own-key trade.
 */

const ENV_KEYS: Record<string, string | undefined> = {
  openrouter: process.env.OPENROUTER_API_KEY,
  nvidia: process.env.NVIDIA_API_KEY,
  anthropic: process.env.ANTHROPIC_API_KEY,
};

function serverKey(providerId: string): string | undefined {
  return ENV_KEYS[providerId]?.trim() || undefined;
}

/** Which providers this deployment can serve without the browser holding a key. */
export async function GET() {
  return NextResponse.json({
    providers: Object.keys(ENV_KEYS).filter((id) => serverKey(id)),
  });
}

export async function POST(request: Request) {
  let body: { providerId?: string; action?: "models" | "complete"; request?: LlmRequest };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed request" }, { status: 400 });
  }

  const providerId = body.providerId ?? "";
  const key = serverKey(providerId);
  if (!key) {
    return NextResponse.json(
      { error: `No server-side key configured for ${providerId || "that provider"}` },
      { status: 501 }
    );
  }

  const provider = getProvider(providerId);
  try {
    if (body.action === "models") {
      return NextResponse.json({ models: await provider.listModels(key) });
    }
    if (body.action === "complete" && body.request) {
      // The client never sends a key on this path, and none is echoed back.
      return NextResponse.json({ response: await provider.complete(body.request, key) });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 502 });
  }
}

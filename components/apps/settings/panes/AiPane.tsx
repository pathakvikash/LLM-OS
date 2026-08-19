"use client";

import { useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { PROVIDERS, getProvider } from "@/lib/llm";
import { useLlmStore } from "@/stores/useLlmStore";
import { formatUsd } from "@/lib/utils/format";

/**
 * Bring-your-own-key. With nothing entered the desktop behaves exactly as it
 * ships; a key turns the agents' planning over to the model. Each provider
 * keeps its own key, and the draft below is only committed when saved.
 */
/** The key field for one provider. Remounted per provider, so no stale draft. */
function KeyForm({
  providerId,
  savedKey,
  status,
  rememberKey,
}: {
  providerId: string;
  savedKey: string;
  status: string;
  rememberKey: boolean;
}) {
  const [draft, setDraft] = useState(savedKey);
  const [revealed, setRevealed] = useState(false);
  const provider = getProvider(providerId);
  const dirty = draft.trim() !== savedKey;

  const border = { borderColor: "var(--glass-border)" };
  const inputStyle = {
    ...border,
    background: "color-mix(in srgb, var(--glass-bg) 60%, transparent)",
    color: "var(--text-primary)",
  };

  async function save() {
    useLlmStore.getState().saveApiKey(providerId, draft);
    await useLlmStore.getState().testConnection();
  }

  return (
    <>
      <label className="mt-3 block">
        <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
          {provider.label} API key
        </span>
        <div className="mt-1.5 flex gap-1.5">
          <input
            type={revealed ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && dirty && draft.trim()) void save();
            }}
            placeholder={provider.keyHint}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-md border px-2.5 py-1.5 font-mono text-[12px] outline-none"
            style={inputStyle}
          />
          <button onClick={() => setRevealed((v) => !v)} className="rounded-md border px-2 text-[11px]" style={border}>
            {revealed ? "Hide" : "Show"}
          </button>
        </div>
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          onClick={() => void save()}
          disabled={!dirty || !draft.trim() || status === "checking"}
          className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-40"
          style={{ background: "var(--accent-primary)" }}
        >
          {status === "checking" ? "Saving…" : dirty ? "Save key" : "Saved"}
        </button>
        {savedKey && !dirty && (
          <button
            onClick={() => void useLlmStore.getState().testConnection()}
            className="rounded-md border px-2.5 py-1.5 text-[12px]"
            style={border}
          >
            Re-check
          </button>
        )}
        {dirty && savedKey && (
          <button onClick={() => setDraft(savedKey)} className="rounded-md border px-2.5 py-1.5 text-[12px]" style={border}>
            Cancel
          </button>
        )}
        {savedKey && (
          <button
            onClick={() => {
              useLlmStore.getState().clearKey();
              setDraft("");
            }}
            className="rounded-md border px-2.5 py-1.5 text-[12px]"
            style={{ ...border, color: "var(--danger)" }}
          >
            Remove
          </button>
        )}
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] hover:underline"
          style={{ color: "var(--text-muted)" }}
        >
          Get a key <ExternalLink size={10} />
        </a>
      </div>

      <label className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
        <input
          type="checkbox"
          checked={rememberKey}
          onChange={(e) => useLlmStore.getState().setRememberKey(e.target.checked)}
          className="h-3.5 w-3.5 accent-(--accent-primary)"
        />
        Remember on this device
        <span style={{ color: "var(--text-muted)" }}>
          {rememberKey ? "— saved in this browser's localStorage" : "— kept in memory only, gone when you reload"}
        </span>
      </label>
    </>
  );
}

export default function AiPane() {
  const providerId = useLlmStore((s) => s.providerId);
  const keys = useLlmStore((s) => s.keys);
  const chosenModels = useLlmStore((s) => s.chosenModels);
  const enabled = useLlmStore((s) => s.enabled);
  const models = useLlmStore((s) => s.models);
  const freeModelsOnly = useLlmStore((s) => s.freeModelsOnly);
  const status = useLlmStore((s) => s.status);
  const lastError = useLlmStore((s) => s.lastError);
  const confirmWrites = useLlmStore((s) => s.confirmWrites);
  const spendCapUsd = useLlmStore((s) => s.spendCapUsd);
  const spentUsd = useLlmStore((s) => s.spentUsd);
  const serverBacked = useLlmStore((s) => s.serverBacked);
  const rememberKey = useLlmStore((s) => s.rememberKey);

  const provider = getProvider(providerId);
  const savedKey = keys[providerId] ?? "";
  const model = chosenModels[providerId] ?? "";
  const viaServer = serverBacked.includes(providerId);

  const offered = freeModelsOnly && models.some((m) => m.free) ? models.filter((m) => m.free) : models;

  const border = { borderColor: "var(--glass-border)" };
  const inputStyle = {
    ...border,
    background: "color-mix(in srgb, var(--glass-bg) 60%, transparent)",
    color: "var(--text-primary)",
  };

  return (
    <div className="max-w-[560px] space-y-5">
      <section>
        <h3 className="text-[13px] font-semibold">Model access</h3>
        <p className="mt-1 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          Agents plan with built-in rules by default. Add an API key and they plan with a model instead,
          calling the same actions under the same connector permissions.
        </p>

        <div className="mt-3 flex gap-1.5">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              onClick={() => useLlmStore.getState().setProvider(p.id)}
              className="rounded-md border px-2.5 py-1.5 text-[12px]"
              style={{
                borderColor: p.id === providerId ? "var(--accent-primary)" : "var(--glass-border)",
                background:
                  p.id === providerId ? "color-mix(in srgb, var(--accent-primary) 16%, transparent)" : "transparent",
              }}
            >
              {p.label}
              {keys[p.id] ? " ·" : ""}
            </button>
          ))}
        </div>

        {viaServer ? (
          <div
            className="mt-3 flex items-start gap-2 rounded-(--radius-sm) border p-2.5"
            style={{
              borderColor: "color-mix(in srgb, var(--success) 40%, transparent)",
              background: "color-mix(in srgb, var(--success) 10%, transparent)",
            }}
          >
            <ShieldCheck size={14} style={{ color: "var(--success)" }} />
            <div className="text-[11px]">
              <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                Key held by the server
              </div>
              <div style={{ color: "var(--text-secondary)" }}>
                This deployment supplies {provider.label} credentials from its own environment. Nothing is
                stored in your browser and no key is sent from it.
              </div>
            </div>
          </div>
        ) : (
          // Keyed by provider: switching gives a fresh field with that provider's key.
          <KeyForm
            key={providerId}
            providerId={providerId}
            savedKey={savedKey}
            status={status}
            rememberKey={rememberKey}
          />
        )}

        <div className="mt-2 flex items-center gap-1.5 text-[11px]">
          {status === "checking" && <Loader2 size={12} className="animate-spin" />}
          {status === "ready" && <CheckCircle2 size={12} style={{ color: "var(--success)" }} />}
          {status === "error" && <CircleAlert size={12} style={{ color: "var(--danger)" }} />}
          <span
            style={{
              color:
                status === "ready" ? "var(--success)" : status === "error" ? "var(--danger)" : "var(--text-muted)",
            }}
          >
            {status === "ready"
              ? `Connected — ${offered.length} model${offered.length === 1 ? "" : "s"} available`
              : status === "error"
                ? lastError
                : "Not connected. Agents are planning with rules."}
          </span>
        </div>
      </section>

      {models.length > 0 && (
        <section className="rounded-(--radius-sm) border p-3" style={border}>
          <label className="block">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Model
            </span>
            <select
              value={model}
              onChange={(e) => useLlmStore.getState().setModel(e.target.value)}
              className="mt-1.5 w-full rounded-md border px-2.5 py-1.5 text-[12px] outline-none"
              style={inputStyle}
            >
              {offered.map((m) => (
                <option key={m.id} value={m.id} style={{ color: "black" }}>
                  {m.label}
                  {m.free ? " — free" : ""}
                </option>
              ))}
            </select>
          </label>

          {models.some((m) => m.free) && (
            <label className="mt-2 flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              <input
                type="checkbox"
                checked={freeModelsOnly}
                onChange={(e) => useLlmStore.getState().setFreeModelsOnly(e.target.checked)}
                className="h-3.5 w-3.5 accent-(--accent-primary)"
              />
              Free models only ({models.filter((m) => m.free).length} of {models.length})
            </label>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-[12px] font-medium">Use the model</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Off keeps the key saved and falls back to rule-based planning.
              </div>
            </div>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => useLlmStore.getState().setEnabled(e.target.checked)}
              className="h-4 w-4 accent-(--accent-primary)"
            />
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div>
              <div className="text-[12px] font-medium">Ask before it changes anything</div>
              <div className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Model-driven writes wait for your approval in the chat.
              </div>
            </div>
            <input
              type="checkbox"
              checked={confirmWrites}
              onChange={(e) => useLlmStore.getState().setConfirmWrites(e.target.checked)}
              className="h-4 w-4 accent-(--accent-primary)"
            />
          </div>

          <label className="mt-3 block">
            <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
              Spend cap
            </span>
            <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
              {spendCapUsd === 0 ? "no cap" : formatUsd(spendCapUsd)} · spent {formatUsd(spentUsd)}
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="range"
                min={0}
                max={20}
                step={0.5}
                value={spendCapUsd}
                onChange={(e) => useLlmStore.getState().setSpendCap(Number(e.target.value))}
                className="w-full accent-(--accent-primary)"
              />
              <button
                onClick={() => useLlmStore.getState().resetSpend()}
                className="shrink-0 rounded-md border px-2 py-1 text-[11px]"
                style={border}
              >
                Reset
              </button>
            </div>
          </label>
        </section>
      )}

      <section className="rounded-(--radius-sm) border p-3" style={border}>
        <h3 className="flex items-center gap-1.5 text-[12px] font-semibold">
          <ShieldCheck size={13} /> How the key is handled
        </h3>
        <ul className="mt-1.5 space-y-1 text-[11px] leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          <li>
            ·{" "}
            {viaServer
              ? "This deployment holds the key. Requests from this browser carry no credential at all."
              : `Requests go straight to ${provider.label} with the key in an authorization header — visible in your own devtools, as any direct API call is.`}
          </li>
          <li>
            ·{" "}
            {viaServer
              ? "Nothing is written to this browser."
              : rememberKey
                ? "The key is saved in this browser's localStorage, readable by anything with access to this machine and origin. Encrypting it here would only move the problem, so this app does not pretend to."
                : "The key is held in memory only for this session and is never written to disk."}
          </li>
          <li>· It is sent only to {provider.label}, never to another host, and never appears in prompts, run records, or exports.</li>
          <li>
            · To keep the key out of the browser entirely, set <code>OPENROUTER_API_KEY</code>,{" "}
            <code>NVIDIA_API_KEY</code>, or <code>ANTHROPIC_API_KEY</code> in the server environment. Calls are
            then proxied through this app and the browser never receives or sends one.
          </li>
        </ul>
      </section>
    </div>
  );
}

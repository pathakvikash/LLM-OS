"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ROOT_ID, getPath } from "@/lib/fs/vfs";
import { ensureSeeded } from "@/lib/fs/seed";
import { COMMANDS } from "./commands";
import type { WindowAppProps } from "@/lib/apps/registry";
import { useMenuCommand } from "@/lib/commands/menuBus";
import { useTerminalActivity } from "@/lib/commands/terminalBus";

interface Line {
  id: string;
  type: "input" | "output" | "error";
  text: string;
}

function tokenize(line: string): string[] {
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(line))) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

export default function TerminalApp({ windowId }: WindowAppProps) {
  const [ready, setReady] = useState(false);
  const [cwdId, setCwdId] = useState(ROOT_ID);
  const [promptPath, setPromptPath] = useState("/");
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    getPath(cwdId).then(setPromptPath);
  }, [ready, cwdId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  useMenuCommand(
    windowId,
    useCallback((commandId: string) => {
      if (commandId === "terminal:clear") setLines([]);
    }, [])
  );

  function pushLine(type: Line["type"], text: string) {
    setLines((prev) => [...prev, { id: crypto.randomUUID(), type, text }]);
  }

  // Commands an agent runs land here too, so its work is visible in the shell.
  useTerminalActivity(
    useCallback((activity) => {
      setLines((prev) => [
        ...prev,
        { id: `${activity.id}-in`, type: "input" as const, text: `${activity.actor}@llm-os ~ % ${activity.command}` },
        ...(activity.output
          ? activity.output
              .split("\n")
              .map((text, i) => ({ id: `${activity.id}-out-${i}`, type: "output" as const, text }))
          : []),
        ...(activity.error
          ? [{ id: `${activity.id}-err`, type: "error" as const, text: activity.error }]
          : []),
      ]);
    }, [])
  );

  function promptLabel(pathOverride?: string) {
    const p = pathOverride ?? promptPath;
    const shortPath = p === "/" ? "~" : `~${p}`;
    return `guest@llm-os ${shortPath} %`;
  }

  async function runCommand(raw: string) {
    pushLine("input", `${promptLabel()} ${raw}`);
    const trimmed = raw.trim();
    if (!trimmed) return;

    setHistory((h) => [...h, raw]);
    setHistoryIndex(null);

    const [cmd, ...args] = tokenize(trimmed);
    const fn = COMMANDS[cmd];
    if (!fn) {
      pushLine("error", `command not found: ${cmd}`);
      return;
    }

    try {
      const result = await fn(args, { cwdId });
      if (result.clear) {
        setLines([]);
        return;
      }
      if (result.cwdId) setCwdId(result.cwdId);
      result.output?.forEach((line) => pushLine("output", line));
      if (result.error) pushLine("error", result.error);
    } catch (e) {
      pushLine("error", (e as Error).message);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const value = input;
      setInput("");
      runCommand(value);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      setInput(history[nextIndex]);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex === null) return;
      const nextIndex = historyIndex + 1;
      if (nextIndex >= history.length) {
        setHistoryIndex(null);
        setInput("");
      } else {
        setHistoryIndex(nextIndex);
        setInput(history[nextIndex]);
      }
    }
  }

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-[13px]" style={{ color: "var(--text-muted)" }}>
        Loading shell…
      </div>
    );
  }

  return (
    <div
      className="flex h-full flex-col font-mono text-[13px]"
      style={{ background: "rgba(10, 10, 14, 0.55)" }}
      onClick={() => inputRef.current?.focus()}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto px-3 py-2">
        <p style={{ color: "var(--text-muted)" }}>LLM-OS Terminal — type &quot;help&quot; to get started.</p>
        {lines.map((line) => (
          <pre
            key={line.id}
            className="whitespace-pre-wrap break-words"
            style={{
              color:
                line.type === "error"
                  ? "var(--danger)"
                  : line.type === "input"
                    ? "var(--text-primary)"
                    : "var(--text-secondary)",
            }}
          >
            {line.text}
          </pre>
        ))}
        <div className="flex items-center gap-2">
          <span style={{ color: "var(--success)" }}>{promptLabel()}</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            className="flex-1 bg-transparent outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      </div>
    </div>
  );
}

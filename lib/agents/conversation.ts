import { CONNECTOR_SPECS } from "./connectors";
import { isActive } from "./engine";
import type { AgentDefinition, AgentRun, Connector, Skill } from "./types";

/**
 * The conversational half of the chat. Anything that is not a work request —
 * a greeting, a question about the desktop, "what can you do" — is answered
 * here from real state, so talking to the fleet never dead-ends in an error.
 */

export interface ConversationContext {
  agents: AgentDefinition[];
  skills: Skill[];
  connectors: Connector[];
  runs: AgentRun[];
  appNames: string[];
  openWindows: string[];
  now: number;
}

const EXAMPLES = "“open Terminal and run ls” · “tidy my documents” · “switch to light mode”";

const GREETING = /^(hi|hey|hello|yo|howdy|sup|good (?:morning|afternoon|evening))\b/i;
const THANKS = /^(thanks|thank you|ty|cheers|nice|great|perfect|awesome|lovely|cool)\b/i;
const HELP = /^(help|\?|what can you do|what do you do|who are you|capabilities|commands|options)\b/i;
/** Informational questions only — never an imperative like "open …". */
const QUESTION = /^(what|which|who|how|where|when|is|are|do|does|can|tell me|show me the (?:status|list))\b/i;

function enabledAgents(ctx: ConversationContext) {
  return ctx.agents.filter((a) => a.enabled);
}

export function helpText(ctx: ConversationContext): string {
  const roster = enabledAgents(ctx).map((agent) => {
    const names = ctx.skills.filter((s) => s.enabled && agent.skills.includes(s.id)).map((s) => s.name);
    return `• ${agent.name} — ${names.join(", ") || "no skills granted"}`;
  });
  if (roster.length === 0) return "No agents are enabled. Turn one on in the Agents tab.";
  return ["I route your request to whichever agent fits.", ...roster, `Try: ${EXAMPLES}`].join("\n");
}

/** The reply when a request is understood as work but nothing can carry it. */
export function unknownReply(ctx: ConversationContext): string {
  const usable = ctx.skills.filter((s) => s.enabled && enabledAgents(ctx).some((a) => a.skills.includes(s.id)));
  if (usable.length === 0) return "No enabled agent holds a skill right now — grant one in the Agents tab.";
  const names = usable.slice(0, 4).map((s) => s.name).join(", ");
  return `I don't have a skill for that yet. I can do ${names}${usable.length > 4 ? ", and more" : ""} — try ${EXAMPLES}, or say “help”.`;
}

/**
 * Answers conversation from live state. Returns null when the message is work
 * for an agent, so the orchestrator can route it instead.
 */
type Answer = (ctx: ConversationContext) => string;

/** An informational question and the state that answers it. */
interface Topic {
  matches: RegExp;
  answer: Answer;
}

/**
 * Questions about this desktop, in priority order. A table keeps each topic to
 * its pattern and its answer, so adding one is an entry rather than another
 * branch in a chain.
 */
const TOPICS: Topic[] = [
  {
    matches: /\b(apps?|applications?|programs?)\b/,
    answer: (ctx) =>
      `Installed: ${ctx.appNames.join(", ")}.\nOpen right now: ${ctx.openWindows.join(", ") || "nothing"}.`,
  },
  {
    matches: /\b(windows?)\b|\b(open|running|up)\b.*\b(windows?|apps?)\b/,
    answer: (ctx) =>
      ctx.openWindows.length > 0
        ? `Open windows: ${ctx.openWindows.join(", ")}.`
        : "No windows are open right now.",
  },
  {
    matches: /\bagents?\b/,
    answer: (ctx) =>
      enabledAgents(ctx)
        .map((agent) => {
          const names = ctx.skills.filter((s) => agent.skills.includes(s.id)).map((s) => s.name);
          return `• ${agent.name} (${agent.model}) — ${names.join(", ") || "no skills"}`;
        })
        .join("\n"),
  },
  {
    matches: /\bskills?\b/,
    answer: (ctx) =>
      ctx.skills
        .filter((s) => s.enabled)
        .map((s) => `• ${s.name} — ${s.triggers.slice(0, 4).join(", ")}`)
        .join("\n"),
  },
  {
    matches: /\b(connectors?|permissions?|access)\b/,
    answer: (ctx) =>
      CONNECTOR_SPECS.map((spec) => {
        const state = ctx.connectors.find((c) => c.id === spec.id);
        const access = !state?.connected ? "disconnected" : state.allowWrite ? "read + write" : "read only";
        return `• ${spec.label} — ${access}`;
      }).join("\n"),
  },
  {
    matches: /\b(runs?|status|busy|going)\b/,
    answer: (ctx) => {
      const count = (status: string) => ctx.runs.filter((r) => r.status === status).length;
      const last = ctx.runs.find((r) => !isActive(r));
      const tail = last ? ` Last: ${last.agentName} — ${last.skillName} (${last.status}).` : "";
      return `${count("running")} running, ${count("queued")} queued, ${count("succeeded")} succeeded, ${count("failed")} failed.${tail}`;
    },
  },
  { matches: /\b(time|date|clock)\b/, answer: (ctx) => new Date(ctx.now).toLocaleString() },
  {
    matches: /\b(stored?|storage|saved?|data|database|disk|files? live)\b/,
    answer: () =>
      "Everything lives in this browser: the filesystem is an IndexedDB database (llmos-vfs), and agents, skills, runs, and settings are in localStorage. Nothing touches your real disk.",
  },
];

/** Openers that are conversation rather than work, in priority order. */
const OPENERS: { matches: RegExp; answer: Answer }[] = [
  { matches: HELP, answer: helpText },
  {
    matches: GREETING,
    answer: (ctx) => {
      const names = enabledAgents(ctx).map((a) => a.name);
      return `Hi. ${names.length} agent${names.length === 1 ? "" : "s"} on duty (${names.join(", ")}). Ask for something like ${EXAMPLES}, or say “help” for the roster.`;
    },
  },
  { matches: THANKS, answer: () => "Any time." },
];

/**
 * Answers conversation from live state. Returns null when the message is work
 * for an agent, so the orchestrator can route it instead.
 */
export function converse(message: string, ctx: ConversationContext): string | null {
  const text = message.trim();
  const opener = OPENERS.find((o) => o.matches.test(text));
  if (opener) return opener.answer(ctx);

  // Everything below answers a question about this desktop, never an order.
  if (!QUESTION.test(text) && !/^list\b/i.test(text)) return null;

  const lower = text.toLowerCase();
  return TOPICS.find((topic) => topic.matches.test(lower))?.answer(ctx) ?? null;
}

/** Strips a leading greeting so "hi, open Terminal" still gets the work done. */
export function stripPleasantries(message: string): string {
  return message
    .replace(/^(hi|hey|hello|yo|howdy|good (?:morning|afternoon|evening))\b[\s,.!]*/i, "")
    .replace(/^(please|can you|could you|would you|i want you to|i'd like you to)\b[\s,.!]*/i, "")
    .trim();
}

export type RunStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type StepStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type TriggerKind = "manual" | "schedule" | "retry";

export type EventLevel = "system" | "plan" | "tool" | "output" | "error";

/** Every action needs read or write access to exactly one connector. */
export type Scope = "read" | "write";

export interface Connector {
  id: string;
  /** Granted at all — a disconnected connector fails every action that needs it. */
  connected: boolean;
  /** Write actions are refused unless this is on, even when connected. */
  allowWrite: boolean;
  calls: number;
  lastUsedAt?: number;
}

export interface SkillStep {
  actionId: string;
  /** Values may contain {{var}} placeholders resolved from the run context. */
  params: Record<string, string>;
  /** Skip instead of failing when a placeholder resolves to nothing. */
  optional?: boolean;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  iconKey: string;
  /** Keywords matched against a task to pick the skill that runs it. */
  triggers: string[];
  steps: SkillStep[];
  enabled: boolean;
  builtin?: boolean;
  createdAt: number;
}

export interface RunStep {
  id: string;
  name: string;
  actionId: string;
  params: Record<string, string>;
  /** Skip instead of failing when a placeholder resolves to nothing. */
  optional?: boolean;
  /** Clause-scoped values that win over the run's vars for this step only. */
  varOverrides?: Record<string, string>;
  status: StepStatus;
  /** Deliberation time before the action fires; drives the progress meter. */
  durationMs: number;
  startedAt?: number;
  endedAt?: number;
  /** One-line summary of what the action actually did. */
  result?: string;
  error?: string;
}

export interface RunEvent {
  id: string;
  ts: number;
  level: EventLevel;
  message: string;
}

export interface AgentRun {
  id: string;
  agentId: string;
  /** Denormalised so a run stays readable after its agent is edited or deleted. */
  agentName: string;
  agentColor: string;
  agentIconKey: string;
  model: string;
  task: string;
  /** Primary skill (the first one planned); retries reuse it. */
  skillId: string;
  /** Display name — "Open workspace → Shell task" when a task needed both. */
  skillName: string;
  /** Every skill in the plan, for per-skill usage stats. */
  skillIds: string[];
  /** Entities pulled out of the task at plan time; step params interpolate these. */
  vars: Record<string, string>;
  /** The composed brief this run was planned against — fleet + agent + grants. */
  systemPrompt: string;
  status: RunStatus;
  trigger: TriggerKind;
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  steps: RunStep[];
  events: RunEvent[];
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  output?: string;
  error?: string;
  /** Small facts a finished run leaves behind, so a follow-up can say "it". */
  outputVars?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  role: "user" | "system";
  text: string;
  ts: number;
  /** Runs the orchestrator dispatched for this message, in order. */
  runIds?: string[];
}

export interface ChatSession {
  id: string;
  /** Auto-named from the first message; renameable. */
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface AgentSchedule {
  enabled: boolean;
  everyMinutes: number;
  task: string;
  lastRunAt?: number;
}

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  /** Key into AGENT_ICONS — components can't be persisted, keys can. */
  iconKey: string;
  color: string;
  model: string;
  systemPrompt: string;
  /** Skill ids this agent is allowed to run. */
  skills: string[];
  /**
   * "skills" runs pre-written recipes matched by trigger words.
   * "interpreter" reads the instruction itself and composes the actions.
   */
  planner?: "skills" | "interpreter";
  maxSteps: number;
  /** Deliberation pace: how long the agent pauses before each action. */
  avgStepMs: number;
  enabled: boolean;
  schedule: AgentSchedule;
  createdAt: number;
}

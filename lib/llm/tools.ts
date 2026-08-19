import { ACTIONS } from "@/lib/agents/actions";
import type { LlmTool } from "./types";

/**
 * The action registry, expressed as tools a model can call. There is one source
 * of truth for what an agent can do — adding an action makes it available to the
 * rule interpreter and to the model at the same time.
 */
export function actionsToTools(): LlmTool[] {
  return ACTIONS.map((action) => ({
    // Providers disagree about dots in tool names; underscores are safe everywhere.
    name: action.id.replace(/\./g, "__"),
    description: `${action.description} (needs ${action.scope} access to the ${action.connectorId} connector)`,
    parameters: {
      type: "object" as const,
      properties: Object.fromEntries(
        action.params.map((param) => [
          param.name,
          { type: "string" as const, description: param.placeholder ? `${param.label} — e.g. ${param.placeholder}` : param.label },
        ])
      ),
      required: action.params.filter((p) => !p.optional).map((p) => p.name),
      additionalProperties: false as const,
    },
  }));
}

export function toolNameToActionId(name: string): string {
  return name.replace(/__/g, ".");
}

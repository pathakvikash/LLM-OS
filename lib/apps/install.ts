import { registerApp } from "@/lib/apps/registry";
import { finderAppDefinition } from "@/components/apps/finder/definition";
import { terminalAppDefinition } from "@/components/apps/terminal/definition";
import { settingsAppDefinition } from "@/components/apps/settings/definition";
import { helloAppDefinition } from "@/components/apps/hello/definition";

registerApp(finderAppDefinition);
registerApp(terminalAppDefinition);
registerApp(settingsAppDefinition);
registerApp(helloAppDefinition);

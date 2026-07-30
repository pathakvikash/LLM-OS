import { SquareTerminal } from "lucide-react";
import type { AppDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import ComingSoon from "@/components/apps/shared/ComingSoon";

function TerminalPlaceholder() {
  return <ComingSoon name="Terminal" icon={SquareTerminal} />;
}

export const terminalAppDefinition: AppDefinition = {
  id: "terminal",
  name: "Terminal",
  icon: SquareTerminal,
  component: TerminalPlaceholder,
  defaultSize: { width: 620, height: 400 },
  minSize: { width: 360, height: 240 },
  menus: withDefaultMenus(),
  showInDock: true,
  showInSpotlight: true,
};

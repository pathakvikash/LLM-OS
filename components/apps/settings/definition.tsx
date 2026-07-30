import { Settings as SettingsIcon } from "lucide-react";
import type { AppDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import ComingSoon from "@/components/apps/shared/ComingSoon";

function SettingsPlaceholder() {
  return <ComingSoon name="Settings" icon={SettingsIcon} />;
}

export const settingsAppDefinition: AppDefinition = {
  id: "settings",
  name: "Settings",
  icon: SettingsIcon,
  component: SettingsPlaceholder,
  defaultSize: { width: 640, height: 440 },
  minSize: { width: 480, height: 360 },
  singleton: true,
  menus: withDefaultMenus(),
  showInDock: true,
  showInSpotlight: true,
};

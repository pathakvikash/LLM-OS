import { Folder } from "lucide-react";
import type { AppDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import ComingSoon from "@/components/apps/shared/ComingSoon";

function FinderPlaceholder() {
  return <ComingSoon name="Finder" icon={Folder} />;
}

export const finderAppDefinition: AppDefinition = {
  id: "finder",
  name: "Finder",
  icon: Folder,
  component: FinderPlaceholder,
  defaultSize: { width: 720, height: 480 },
  minSize: { width: 420, height: 300 },
  singleton: true,
  menus: withDefaultMenus(),
  showInDock: true,
  showInSpotlight: true,
};

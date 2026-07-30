import { Sparkles } from "lucide-react";
import type { AppDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import HelloApp from "./HelloApp";

export const helloAppDefinition: AppDefinition = {
  id: "hello",
  name: "Hello",
  icon: Sparkles,
  component: HelloApp,
  defaultSize: { width: 420, height: 280 },
  minSize: { width: 320, height: 220 },
  menus: withDefaultMenus(),
  showInDock: true,
  showInSpotlight: true,
};

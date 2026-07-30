import { Folder } from "lucide-react";
import type { AppDefinition, MenuDefinition } from "@/lib/apps/registry";
import { withDefaultMenus } from "@/lib/apps/registry";
import FinderApp from "./FinderApp";

const FILE_MENU: MenuDefinition = {
  label: "File",
  items: [
    { label: "New Folder", shortcut: "⇧⌘N", commandId: "finder:new-folder" },
    { label: "Delete", shortcut: "⌫", commandId: "finder:delete" },
  ],
};

export const finderAppDefinition: AppDefinition = {
  id: "finder",
  name: "Finder",
  icon: Folder,
  component: FinderApp,
  defaultSize: { width: 760, height: 500 },
  minSize: { width: 460, height: 320 },
  singleton: true,
  menus: withDefaultMenus([FILE_MENU]),
  showInDock: true,
  showInSpotlight: true,
};

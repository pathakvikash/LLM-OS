import type { ComponentType } from "react";
import type { AppIconProps } from "@/lib/apps/registry";

export default function ComingSoon({
  name,
  icon: Icon,
}: {
  name: string;
  icon: ComponentType<AppIconProps>;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <Icon size={40} strokeWidth={1.25} style={{ color: "var(--text-secondary)" }} />
      <p className="text-sm font-medium">{name}</p>
      <p className="text-xs" style={{ color: "var(--text-muted)" }}>
        Coming online in a later build phase.
      </p>
    </div>
  );
}

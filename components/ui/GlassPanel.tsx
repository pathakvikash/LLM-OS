import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  strong?: boolean;
  rounded?: "sm" | "md" | "lg";
}

const roundedClass = {
  sm: "rounded-(--radius-sm)",
  md: "rounded-(--radius)",
  lg: "rounded-(--radius-lg)",
};

export default function GlassPanel({
  strong,
  rounded = "md",
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(strong ? "glass-strong" : "glass", roundedClass[rounded], className)}
      {...props}
    >
      {children}
    </div>
  );
}

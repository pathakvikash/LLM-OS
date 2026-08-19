"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Ban, Check, CircleAlert, Clock, LoaderCircle, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AGENT_ICON_KEYS, AGENT_ICONS, DEFAULT_AGENT_ICON } from "@/lib/agents/icons";
import type { RunStatus, StepStatus } from "@/lib/agents/types";

/** Ticks while something is in flight so meters and elapsed times stay live. */
export function useNow(active: boolean, intervalMs = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return now;
}

/** Renders an agent's icon from its persisted key, so callers never build a component mid-render. */
export function AgentGlyph({
  iconKey,
  color,
  size = 15,
  className,
  style,
}: {
  iconKey: string;
  color?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = AGENT_ICONS[iconKey] ?? DEFAULT_AGENT_ICON;
  return <Icon size={size} strokeWidth={1.75} className={className} style={{ color, ...style }} />;
}

export const STATUS_META: Record<
  RunStatus,
  { label: string; color: string; icon: typeof Check; spin?: boolean }
> = {
  queued: { label: "Queued", color: "var(--text-muted)", icon: Clock },
  running: { label: "Running", color: "var(--accent-primary)", icon: LoaderCircle, spin: true },
  succeeded: { label: "Succeeded", color: "var(--success)", icon: Check },
  failed: { label: "Failed", color: "var(--danger)", icon: CircleAlert },
  cancelled: { label: "Cancelled", color: "var(--warning)", icon: Ban },
};

/** Status is never carried by colour alone — every badge ships an icon and a word. */
export function StatusBadge({ status, compact }: { status: RunStatus; compact?: boolean }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium"
      style={{
        color: meta.color,
        background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
      }}
    >
      <Icon size={11} strokeWidth={2.25} className={meta.spin ? "animate-spin" : undefined} />
      {!compact && meta.label}
    </span>
  );
}

export function StepDot({ status }: { status: StepStatus }) {
  if (status === "running") {
    return <LoaderCircle size={13} strokeWidth={2.25} className="animate-spin" style={{ color: "var(--accent-primary)" }} />;
  }
  if (status === "done") return <Check size={13} strokeWidth={2.5} style={{ color: "var(--success)" }} />;
  if (status === "failed") return <X size={13} strokeWidth={2.5} style={{ color: "var(--danger)" }} />;
  return (
    <span
      className="block h-[7px] w-[7px] rounded-full"
      style={{
        background: status === "skipped" ? "transparent" : "var(--text-muted)",
        border: status === "skipped" ? "1px solid var(--text-muted)" : undefined,
        opacity: 0.6,
      }}
    />
  );
}

export function Meter({
  value,
  tone = "var(--accent-primary)",
  height = 4,
}: {
  value: number;
  tone?: string;
  height?: number;
}) {
  return (
    <div
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: `color-mix(in srgb, ${tone} 18%, transparent)` }}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width] duration-200 ease-linear"
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%`, background: tone }}
      />
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div
      className="rounded-(--radius-sm) border px-3 py-2.5"
      style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg)" }}
    >
      <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] leading-none font-semibold" style={{ color: tone ?? "var(--text-primary)" }}>
        {value}
      </div>
      {hint && (
        <div className="mt-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

export function Chip({
  children,
  tone,
  onClick,
  active,
  title,
}: {
  children: ReactNode;
  tone?: string;
  onClick?: () => void;
  active?: boolean;
  title?: string;
}) {
  const color = tone ?? "var(--text-secondary)";
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[11px] whitespace-nowrap",
        onClick && "transition-colors hover:opacity-90"
      )}
      style={{
        color: active ? "var(--text-primary)" : color,
        borderColor: active ? "transparent" : "var(--glass-border)",
        background: active ? `color-mix(in srgb, ${tone ?? "var(--accent-primary)"} 26%, transparent)` : "transparent",
      }}
    >
      {children}
    </Tag>
  );
}

type ButtonVariant = "primary" | "ghost" | "danger";

export function Button({
  children,
  onClick,
  variant = "ghost",
  disabled,
  title,
  type = "button",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const style: React.CSSProperties =
    variant === "primary"
      ? { background: "var(--accent-primary)", color: "white" }
      : variant === "danger"
        ? { background: "color-mix(in srgb, var(--danger) 16%, transparent)", color: "var(--danger)" }
        : { background: "var(--glass-bg)", color: "var(--text-secondary)", border: "1px solid var(--glass-border)" };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium",
        "transition-transform active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100",
        className
      )}
      style={style}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      {hint && (
        <span className="ml-1.5 text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </span>
      )}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border px-2.5 py-1.5 text-[13px] outline-none focus:border-(--accent-primary)";

export const inputStyle: React.CSSProperties = {
  borderColor: "var(--glass-border)",
  background: "color-mix(in srgb, var(--glass-bg) 60%, transparent)",
  color: "var(--text-primary)",
};

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="relative h-[18px] w-[32px] shrink-0 rounded-full transition-colors"
      style={{ background: checked ? "var(--success)" : "color-mix(in srgb, var(--text-muted) 40%, transparent)" }}
    >
      <span
        className="absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white transition-[left] duration-150"
        style={{ left: checked ? 16 : 2 }}
      />
    </button>
  );
}

/** In-window modal: stays inside the app frame instead of covering the desktop. */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 520,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.35)" }}>
      <div
        className="glass-strong flex max-h-full w-full flex-col overflow-hidden rounded-(--radius)"
        style={{ maxWidth: width }}
      >
        <div
          className="flex items-start justify-between gap-3 border-b px-4 py-3"
          style={{ borderColor: "var(--glass-border)" }}
        >
          <div className="min-w-0">
            <div className="text-[13px] font-semibold">{title}</div>
            {subtitle && (
              <div className="mt-0.5 truncate text-[11px]" style={{ color: "var(--text-muted)" }}>
                {subtitle}
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:opacity-70">
            <X size={14} style={{ color: "var(--text-secondary)" }} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">{children}</div>
        {footer && (
          <div
            className="flex items-center justify-end gap-2 border-t px-4 py-3"
            style={{ borderColor: "var(--glass-border)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** The bordered glass panel every list row and settings block is built on. */
export function Card({
  children,
  className,
  tone,
  dimmed,
}: {
  children: ReactNode;
  className?: string;
  /** Border colour, for a panel that needs to signal state. */
  tone?: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={cn("rounded-(--radius-sm) border p-3", className)}
      style={{
        borderColor: tone ?? "var(--glass-border)",
        background: "var(--glass-bg)",
        opacity: dimmed ? 0.55 : 1,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Delete that asks first, in place. Owning the pending state here keeps every
 * list from repeating the same confirmingId dance.
 */
export function ConfirmDelete({
  onConfirm,
  title,
  label = "Delete",
}: {
  onConfirm: () => void;
  title?: string;
  label?: string;
}) {
  const [pending, setPending] = useState(false);
  if (!pending) {
    return (
      <Button variant="danger" onClick={() => setPending(true)} title={title}>
        <Trash2 size={12} />
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <Button onClick={() => setPending(false)}>Keep</Button>
      <Button
        variant="danger"
        onClick={() => {
          setPending(false);
          onConfirm();
        }}
      >
        {label}
      </Button>
    </span>
  );
}

/** The shared icon grid used wherever something gets an identity. */
export function IconPicker({
  value,
  onChange,
  tone = "var(--accent-primary)",
}: {
  value: string;
  onChange: (key: string) => void;
  tone?: string;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {AGENT_ICON_KEYS.map((key) => {
        const selected = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            aria-label={key}
            className="rounded-md border p-1.5"
            style={{
              borderColor: selected ? tone : "var(--glass-border)",
              background: selected ? `color-mix(in srgb, ${tone} 16%, transparent)` : "transparent",
            }}
          >
            <AgentGlyph iconKey={key} size={14} color={selected ? tone : "var(--text-secondary)"} />
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <div style={{ color: "var(--text-muted)" }}>{icon}</div>
      <div className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {title}
      </div>
      {hint && (
        <div className="max-w-[38ch] text-[11px]" style={{ color: "var(--text-muted)" }}>
          {hint}
        </div>
      )}
    </div>
  );
}

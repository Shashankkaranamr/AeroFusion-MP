import type { HTMLAttributes } from "react";
import { categoryForPm, type AqiCategory } from "@/lib/aqi";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "primary" | "accent" | "warn" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-sunken text-fg-muted border-border",
  primary: "bg-primary-soft text-primary border-transparent",
  accent: "bg-accent-soft text-accent border-transparent",
  warn: "bg-amber-500/12 text-amber-700 dark:text-amber-300 border-transparent",
  danger: "bg-red-500/12 text-red-700 dark:text-red-300 border-transparent",
};

export function Badge({ tone = "neutral", className, ...rest }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
}

export function AqiBadge({
  pm,
  category,
  size = "sm",
  className,
}: {
  pm?: number;
  category?: AqiCategory;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const cat = category ?? categoryForPm(pm ?? 0);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        size === "xs" && "px-2 py-0.5 text-[10px]",
        size === "sm" && "px-2.5 py-0.5 text-[11px]",
        size === "md" && "px-3 py-1 text-xs",
        className,
      )}
      style={{
        color: `color-mix(in oklab, ${cat.ink} 85%, var(--fg) 15%)`,
        background: `color-mix(in oklab, ${cat.color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${cat.color} 28%, transparent)`,
      }}
    >
      <span className="size-1.5 rounded-full" style={{ background: cat.color }} />
      {cat.label}
    </span>
  );
}

export function Dot({ color, pulse, className }: { color: string; pulse?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2", className)}>
      {pulse && (
        <span className="absolute inset-0 rounded-full animate-pulse-ring" style={{ background: color }} />
      )}
      <span className="relative inline-flex size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

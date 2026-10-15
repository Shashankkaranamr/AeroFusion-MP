"use client";

import NumberFlow from "@number-flow/react";
import { Slider as RSlider, Switch as RSwitch, Tooltip as RTooltip } from "radix-ui";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ─────────────── Animated number ─────────────── */

export function AnimatedNumber({
  value,
  digits = 0,
  className,
  prefix,
  suffix,
}: {
  value: number;
  digits?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <NumberFlow
      value={Number.isFinite(value) ? value : 0}
      format={{ maximumFractionDigits: digits, minimumFractionDigits: digits }}
      locales="en-IN"
      prefix={prefix}
      suffix={suffix}
      className={cn("tabular", className)}
      willChange
    />
  );
}

/* ─────────────── Skeleton ─────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

/* ─────────────── Tooltip ─────────────── */

export function Tip({
  content,
  children,
  side = "top",
  className,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  return (
    <RTooltip.Root delayDuration={150}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content
          side={side}
          sideOffset={8}
          className={cn(
            "glass-pop z-[100] max-w-xs rounded-2xl px-3 py-2 text-xs leading-relaxed text-fg",
            "data-[state=delayed-open]:animate-in data-[state=closed]:animate-out",
            className,
          )}
        >
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

/* ─────────────── Slider ─────────────── */

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  color,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  color?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const zeroPct = ((0 - min) / (max - min)) * 100;
  const valPct = ((value - min) / (max - min)) * 100;
  const left = Math.min(zeroPct, valPct);
  const width = Math.abs(valPct - zeroPct);
  const c = color ?? "var(--primary)";
  return (
    <RSlider.Root
      value={[value]}
      onValueChange={(v) => onChange(v[0])}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      className={cn("relative flex h-6 w-full touch-none select-none items-center", className)}
    >
      <RSlider.Track className="relative h-[5px] w-full grow overflow-hidden rounded-full bg-surface-sunken shadow-[inset_0_1px_1px_rgb(var(--shadow-rgb)/0.08)]">
        {min < 0 ? (
          <span
            className="absolute inset-y-0 rounded-full transition-[left,width] duration-75"
            style={{ left: `${left}%`, width: `${width}%`, background: c }}
          />
        ) : (
          <RSlider.Range className="absolute h-full rounded-full" style={{ background: c }} />
        )}
        {min < 0 && <span className="absolute inset-y-0 w-px bg-border-strong" style={{ left: `${zeroPct}%` }} />}
      </RSlider.Track>
      <RSlider.Thumb className="block h-[22px] w-[30px] rounded-full bg-white shadow-[0_0.5px_0_rgba(0,0,0,0.04),0_3px_10px_rgba(0,0,0,0.16),0_0_0_0.5px_rgba(0,0,0,0.06)] transition-transform duration-200 ease-out hover:scale-105 focus-visible:scale-110 focus-visible:outline-none active:scale-[1.12]" />
    </RSlider.Root>
  );
}

/* ─────────────── Switch ─────────────── */

export function Switch({
  checked,
  onChange,
  color,
  "aria-label": ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  color?: string;
  "aria-label"?: string;
}) {
  return (
    <RSwitch.Root
      checked={checked}
      onCheckedChange={onChange}
      aria-label={ariaLabel}
      className="relative h-[24px] w-[42px] shrink-0 cursor-pointer rounded-full bg-[rgba(120,120,128,0.24)] transition-colors duration-300 dark:bg-[rgba(120,120,128,0.36)]"
      style={checked ? { background: color ?? "var(--primary)" } : undefined}
    >
      <RSwitch.Thumb className="block size-[20px] translate-x-[2px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform data-[state=checked]:translate-x-[20px]" />
    </RSwitch.Root>
  );
}

/* ─────────────── Misc ─────────────── */

export function Delta({ value, invert = true, className }: { value: number; invert?: boolean; className?: string }) {
  // For pollution, going down is good → green.
  const good = invert ? value < 0 : value > 0;
  const arrow = value > 0 ? "↑" : value < 0 ? "↓" : "→";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular",
        Math.abs(value) < 0.5
          ? "bg-surface-sunken text-fg-muted"
          : good
            ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
            : "bg-rose-500/12 text-rose-700 dark:text-rose-300",
        className,
      )}
    >
      {arrow} {Math.abs(value).toFixed(0)}%
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md bg-surface-sunken px-1.5 font-sans text-[10px] font-semibold text-fg-muted">
      {children}
    </kbd>
  );
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("text-[10.5px] font-semibold uppercase tracking-[0.14em] text-fg-subtle", className)}>{children}</div>
  );
}

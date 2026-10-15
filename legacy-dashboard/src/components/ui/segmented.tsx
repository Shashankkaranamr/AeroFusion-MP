"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
}

const SPRING = { type: "spring", stiffness: 520, damping: 38, mass: 0.9 } as const;

/**
 * Apple-style segmented control: a recessed glass track with a bright glass "lens" thumb
 * that slides between segments.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  variant = "surface",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: "sm" | "md";
  className?: string;
  /** "primary" tints the thumb label with the accent colour. */
  variant?: "surface" | "primary";
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn(
        "relative inline-flex items-center gap-0.5 rounded-full p-[3px] shadow-[inset_0_1px_2px_rgb(var(--shadow-rgb)/0.08)]",
        className,
      )}
      style={{ background: "var(--seg-track)" }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 rounded-full font-semibold transition-colors duration-300",
              size === "sm" ? "px-3 py-1 text-[11px]" : "px-4 py-1.5 text-xs",
              active ? (variant === "primary" ? "text-primary" : "text-fg") : "text-fg-muted hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className="glass-strong absolute inset-0 -z-10 rounded-full" transition={SPRING} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Larger floating glass tab strip used under page titles. */
export function PillTabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("glass inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full p-1.5 scrollbar-none", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-0 shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors duration-300",
              active ? "text-fg" : "text-fg-muted hover:text-fg",
            )}
          >
            {active && <motion.span layoutId={`pill-${id}`} className="glass-strong absolute inset-0 -z-10 rounded-full" transition={SPRING} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

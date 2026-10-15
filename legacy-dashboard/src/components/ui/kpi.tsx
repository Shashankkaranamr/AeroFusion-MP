"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";
import { AnimatedNumber, Skeleton } from "./primitives";
import { Tilt } from "./tilt";

export function Kpi({
  icon,
  label,
  value,
  digits = 0,
  unit,
  sub,
  footer,
  tint = "var(--primary)",
  loading,
  className,
  children,
}: {
  icon?: ReactNode;
  label: ReactNode;
  value?: number | string;
  digits?: number;
  unit?: ReactNode;
  sub?: ReactNode;
  footer?: ReactNode;
  tint?: string;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <Tilt
      className="h-full"
      rotateAmplitude={8}
      scaleOnHover={1.03}
      radius="28px"
    >
      <Card
        className={cn("group h-full overflow-hidden !p-4 sm:!p-5", className)}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-[0.14] blur-3xl transition-opacity duration-500 group-hover:opacity-30"
          style={{ background: tint }}
        />
        <div className="relative flex items-start gap-3.5">
          {icon && (
            <div
              className="grid size-11 shrink-0 place-items-center rounded-full [&_svg]:size-5"
              style={{
                color: tint,
                background: `linear-gradient(180deg, color-mix(in oklab, ${tint} 20%, transparent), color-mix(in oklab, ${tint} 9%, transparent))`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.45), inset 0 0 0 0.5px color-mix(in oklab, ${tint} 25%, transparent)`,
              }}
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-fg-muted">
              {label}
            </div>
            {loading || value === undefined ? (
              <Skeleton className="mt-2 h-8 w-24" />
            ) : (
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[28px] font-semibold leading-none tracking-[-0.03em] text-fg">
                  {typeof value === "number" ? (
                    <AnimatedNumber value={value} digits={digits} />
                  ) : (
                    value
                  )}
                </span>
                {unit && (
                  <span className="text-xs font-medium text-fg-muted">
                    {unit}
                  </span>
                )}
              </div>
            )}
            {sub && (
              <div className="mt-1.5 truncate text-xs text-fg-muted">{sub}</div>
            )}
            {footer && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-fg-muted">
                {footer}
              </div>
            )}
          </div>
        </div>
        {children}
      </Card>
    </Tilt>
  );
}

"use client";

import { useCallback, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  spotlight?: boolean;
  padded?: boolean;
}

export function Card({ className, spotlight = true, padded = true, onMouseMove, children, ...rest }: CardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const handleMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current;
      if (el && spotlight) {
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${e.clientX - r.left}px`);
        el.style.setProperty("--my", `${e.clientY - r.top}px`);
      }
      onMouseMove?.(e);
    },
    [onMouseMove, spotlight],
  );
  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn("card", spotlight && "spotlight", padded && "p-5 sm:p-6", className)}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("relative mb-4 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && (
          <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">{icon}</div>
        )}
        <div className="min-w-0">
          <h3 className="font-display text-[15px] font-semibold leading-tight tracking-[-0.015em] text-fg sm:text-[17px]">{title}</h3>
          {subtitle && <p className="mt-1 text-xs leading-relaxed text-fg-muted sm:text-[13px]">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="relative shrink-0">{action}</div>}
    </div>
  );
}

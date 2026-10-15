"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TipRow {
  label: ReactNode;
  value: ReactNode;
  color?: string;
  dashed?: boolean;
}

export function ChartTip({ title, rows, footer, className }: { title?: ReactNode; rows: TipRow[]; footer?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "glass-pop min-w-[170px] rounded-[18px] px-3.5 py-2.5 text-xs",
        className,
      )}
    >
      {title && <div className="mb-1.5 font-display text-[12px] font-semibold text-fg">{title}</div>}
      <div className="space-y-1">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-fg-muted">
              {r.color && (
                <span
                  className="inline-block h-[3px] w-3 rounded-full"
                  style={{
                    background: r.dashed ? `repeating-linear-gradient(90deg, ${r.color} 0 3px, transparent 3px 5px)` : r.color,
                  }}
                />
              )}
              {r.label}
            </span>
            <span className="font-semibold tabular text-fg">{r.value}</span>
          </div>
        ))}
      </div>
      {footer && <div className="mt-2 border-t border-border pt-1.5 text-[11px] text-fg-muted">{footer}</div>}
    </div>
  );
}

export function Legend({ items, className }: { items: { label: string; color: string; dashed?: boolean; band?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-fg-muted", className)}>
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          {i.band ? (
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: i.color, opacity: 0.35 }} />
          ) : (
            <span
              className="inline-block h-[3px] w-4 rounded-full"
              style={{
                background: i.dashed ? `repeating-linear-gradient(90deg, ${i.color} 0 4px, transparent 4px 7px)` : i.color,
              }}
            />
          )}
          {i.label}
        </span>
      ))}
    </div>
  );
}

export const CHART = {
  primary: "var(--primary)",
  accent: "var(--accent)",
  fg: "var(--fg)",
  muted: "var(--fg-subtle)",
  grid: "var(--grid-line)",
  axis: { fontSize: 11, fill: "var(--fg-subtle)" },
};

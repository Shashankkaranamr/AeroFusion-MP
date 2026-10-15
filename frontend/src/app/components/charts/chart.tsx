import { createContext, useContext, useId, type CSSProperties, type ReactNode } from "react";
import { ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

/**
 * The chart container from the 21st.dev dashboard (shadcn/chart), trimmed to what we use: a config
 * maps each series to a label and a colour, exposed as --color-<key> so marks and the tooltip
 * agree. Axis text is mono and quiet; gridlines are hairlines (HIG › Charting data: let the data be
 * the brightest thing).
 */
export type ChartConfig = Record<string, { label: string; color: string; unit?: string }>;

const Ctx = createContext<ChartConfig>({});
export const useChartConfig = () => useContext(Ctx);

export function ChartContainer({ config, className, children, label }: { config: ChartConfig; className?: string; children: ReactNode; label: string }) {
  const id = useId().replace(/:/g, "");
  const vars = Object.fromEntries(Object.entries(config).map(([k, v]) => [`--color-${k}`, v.color])) as CSSProperties;
  return (
    <Ctx.Provider value={config}>
      <div
        data-chart={id}
        role="img"
        aria-label={label}
        style={vars}
        className={cn(
          "relative w-full text-[11px]",
          "[&_.recharts-cartesian-axis-tick_text]:fill-[var(--ink-3)] [&_.recharts-cartesian-axis-tick_text]:font-mono",
          "[&_.recharts-cartesian-grid_line]:stroke-[var(--line)] [&_.recharts-reference-line_line]:stroke-[var(--line-2)]",
          "[&_.recharts-surface]:outline-none [&_.recharts-layer]:outline-none [&_.recharts-sector]:outline-none",
          "[&_.recharts-tooltip-cursor]:stroke-[var(--line-2)] [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-[var(--press)]",
          className,
        )}
      >
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Ctx.Provider>
  );
}

interface TipItem {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
  payload?: Record<string, unknown>;
}

/** Tooltip body: glass, a mono label, then one row per series with its colour key. */
export function ChartTooltipContent({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hide = [],
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string | number;
  labelFormatter?: (label: string | number, payload: TipItem[]) => ReactNode;
  valueFormatter?: (v: number, key: string) => string;
  hide?: string[];
}) {
  const config = useChartConfig();
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined && !hide.includes(String(p.dataKey)));
  return (
    <div className="min-w-44 bg-surface-2 px-3 py-2.5 text-[12px] shadow-[inset_0_0_0_1px_var(--line-2),0_18px_40px_-18px_rgb(var(--shadow-rgb)/0.9)]">
      {label !== undefined && <div className="tag mb-1.5 text-ink-2">{labelFormatter ? labelFormatter(label, payload) : label}</div>}
      <div className="grid gap-1">
        {rows.map((p) => {
          const key = String(p.dataKey);
          const c = config[key];
          const v = Array.isArray(p.value) ? p.value.join("–") : typeof p.value === "number" ? (valueFormatter ? valueFormatter(p.value, key) : Math.round(p.value).toLocaleString("en-IN")) : p.value;
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="h-2.5 w-[3px] shrink-0" style={{ background: c?.color ?? p.color }} />
              <span className="text-ink-2">{c?.label ?? p.name}</span>
              <span className="mono ml-auto pl-3 font-medium text-ink">
                {v}
                {c?.unit && <span className="ml-1 text-ink-3">{c.unit}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** A small legend row under a chart: colour key + label. Never colour alone — the label is the key. */
export function ChartLegend({ items, className }: { items: { label: string; color: string; dashed?: boolean }[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-2", className)}>
      {items.map((it) => (
        <span key={it.label} className="inline-flex items-center gap-1.5">
          <span className={cn("h-px w-5", it.dashed && "bg-transparent")} style={it.dashed ? { borderTop: `1px dashed ${it.color}` } : { background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/** Axis tick props shared by every chart. */
export const axis = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  fontSize: 11,
} as const;

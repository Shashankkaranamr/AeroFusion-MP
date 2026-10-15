"use client";

import { useState, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Sector } from "recharts";
import { cn } from "@/lib/utils";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
  sub?: string;
}

export function Donut({
  data,
  center,
  size = 190,
  thickness = 22,
  className,
}: {
  data: DonutSlice[];
  center?: ReactNode;
  size?: number;
  thickness?: number;
  className?: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <div className={cn("flex flex-col items-center gap-4 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius={size / 2 - thickness}
              outerRadius={size / 2 - 4}
              paddingAngle={2}
              cornerRadius={6}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              onMouseEnter={(_, i) => setActive(i)}
              onMouseLeave={() => setActive(null)}
              isAnimationActive
              animationDuration={1000}
              shape={(props: unknown) => {
                const { key: _key, ...p } = props as Parameters<typeof Sector>[0] & { index?: number; key?: string };
                void _key;
                const isActive = p.index === active;
                return <Sector {...p} outerRadius={(p.outerRadius as number) + (isActive ? 5 : 0)} />;
              }}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} opacity={active === null || data[active]?.key === d.key ? 1 : 0.45} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          {active !== null ? (
            <div>
              <div className="font-display text-2xl font-bold text-fg tabular">{data[active].value}</div>
              <div className="text-[11px] text-fg-muted">{data[active].label}</div>
            </div>
          ) : (
            center
          )}
        </div>
      </div>
      <div className="w-full flex-1 space-y-1.5">
        {data.map((d, i) => (
          <div
            key={d.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn("flex items-center gap-2.5 rounded-lg px-2 py-1 text-xs transition", active === i && "bg-surface-sunken")}
          >
            <span className="size-2.5 rounded-[4px]" style={{ background: d.color }} />
            <span className="flex-1 text-fg-muted">
              {d.label}
              {d.sub && <span className="ml-1 text-fg-subtle">{d.sub}</span>}
            </span>
            <span className="font-semibold tabular text-fg">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

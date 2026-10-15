"use client";

import { geoMercator, geoPath } from "d3-geo";
import { motion } from "motion/react";
import { useMemo, type ReactNode } from "react";
import { INDIA_OUTLINE, INDIA_STATES } from "@/lib/geo/india";
import { cn } from "@/lib/utils";

export interface MiniPoint {
  id: string;
  lat: number;
  lon: number;
  color: string;
  r?: number;
  pulse?: boolean;
  opacity?: number;
}

/** Lightweight static India map (SVG only) for thumbnails, cards and the landing page. */
export function MiniIndia({
  points = [],
  width = 320,
  height = 360,
  states = true,
  fill = "var(--map-land)",
  stroke = "var(--map-stroke)",
  outline = "var(--primary)",
  grid,
  className,
  children,
  animate = true,
}: {
  points?: MiniPoint[];
  width?: number;
  height?: number;
  states?: boolean;
  fill?: string;
  stroke?: string;
  outline?: string;
  /** Draw a lat/lon grid with this step (°), e.g. the ConvLSTM raster. */
  grid?: number;
  className?: string;
  children?: (project: (lon: number, lat: number) => [number, number]) => ReactNode;
  animate?: boolean;
}) {
  const geo = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [6, 6],
        [width - 6, height - 6],
      ],
      INDIA_OUTLINE,
    );
    const path = geoPath(projection).digits(1);
    return {
      projection,
      outline: path(INDIA_OUTLINE) ?? "",
      states: INDIA_STATES.features.map((f) => ({ name: f.properties.name, d: path(f) ?? "" })),
    };
  }, [width, height]);

  // Round so server- and client-side float maths produce identical markup (no hydration mismatch).
  const project = (lon: number, lat: number): [number, number] => {
    const p = geo.projection([lon, lat]) ?? [0, 0];
    return [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
  };
  const clipId = `mini-clip-${width}-${height}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={cn("h-auto w-full", className)} aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <path d={geo.outline} />
        </clipPath>
      </defs>
      <path d={geo.outline} fill={fill} />
      {states && geo.states.map((s) => <path key={s.name} d={s.d} fill="none" stroke={stroke} strokeWidth={0.6} />)}
      {grid && (
        <g clipPath={`url(#${clipId})`} stroke="var(--primary)" strokeOpacity={0.28} strokeWidth={0.6}>
          {Array.from({ length: Math.ceil(32 / grid) + 1 }, (_, i) => {
            const lon = 67 + i * grid;
            const [x1, y1] = project(lon, 37.5);
            const [x2, y2] = project(lon, 6);
            return <line key={`v${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
          {Array.from({ length: Math.ceil(32 / grid) + 1 }, (_, i) => {
            const lat = 6 + i * grid;
            const [x1, y1] = project(67, lat);
            const [x2, y2] = project(98, lat);
            return <line key={`h${i}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
          })}
        </g>
      )}
      <path d={geo.outline} fill="none" stroke={outline} strokeOpacity={0.6} strokeWidth={1.2} />
      {points.map((p, i) => {
        const [x, y] = project(p.lon, p.lat);
        return (
          <g key={p.id}>
            {p.pulse && (
              <circle cx={x} cy={y} r={(p.r ?? 3) * 2} fill={p.color} opacity={0.3}>
                <animate attributeName="r" values={`${p.r ?? 3};${(p.r ?? 3) * 3.4};${p.r ?? 3}`} dur="2.6s" begin={`${(i % 7) * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.45;0;0.45" dur="2.6s" begin={`${(i % 7) * 0.3}s`} repeatCount="indefinite" />
              </circle>
            )}
            {animate ? (
              <motion.circle
                cx={x}
                cy={y}
                r={p.r ?? 3}
                fill={p.color}
                opacity={p.opacity ?? 1}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: Math.min(1.2, i * 0.004), type: "spring", stiffness: 300, damping: 18 }}
                style={{ transformBox: "fill-box", transformOrigin: "center" }}
              />
            ) : (
              <circle cx={x} cy={y} r={p.r ?? 3} fill={p.color} opacity={p.opacity ?? 1} />
            )}
          </g>
        );
      })}
      {children?.(project)}
    </svg>
  );
}

import { useMemo, useState } from "react";
import { geoMercator, geoPath } from "d3-geo";
import type { LiveSnapshot } from "@/lib/api";
import { categoryForPm } from "@/lib/aqi";
import { INDIA_OUTLINE, INDIA_STATES } from "@/lib/geo/india";
import { windGraph } from "@/lib/live";
import { cn } from "@/lib/utils";

/**
 * The wind-driven city graph: who blows on whom right now. An edge i→j is strong when j is near i
 * and the wind at i points at j (lib/live.ts › windGraph). Drawn as hairlines whose dashes flow
 * downwind; hovering a city keeps only its links.
 */
export function WindGraph({ snap, className }: { snap: LiveSnapshot; className?: string }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 520;
  const H = 560;
  const { path, project, edges } = useMemo(() => {
    const proj = geoMercator().fitExtent(
      [
        [12, 12],
        [W - 12, H - 12],
      ],
      INDIA_OUTLINE,
    );
    return { path: geoPath(proj), project: (lon: number, lat: number) => proj([lon, lat]) ?? [0, 0], edges: windGraph(snap.cities).edges.slice(0, 70) };
  }, [snap]);
  const maxW = Math.max(...edges.map((e) => e.w), 0.01);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label={`Wind links between cities: ${edges.length} strongest shown`}>
      <g fill="none">
        {INDIA_STATES.features.map((f, i) => (
          <path key={i} d={path(f) ?? ""} stroke="var(--line)" strokeWidth={0.6} />
        ))}
        {INDIA_OUTLINE.features.map((f, i) => (
          <path key={`o${i}`} d={path(f) ?? ""} stroke="var(--line-2)" strokeWidth={1} fill="var(--press)" />
        ))}
      </g>
      <g>
        {edges.map((e, i) => {
          const [x1, y1] = project(e.from.lon, e.from.lat);
          const [x2, y2] = project(e.to.lon, e.to.lat);
          const on = !hover || hover === e.from.slug || hover === e.to.slug;
          // a gentle arc, so two-way links don't overlap
          const mx = (x1 + x2) / 2 - (y2 - y1) * 0.18;
          const my = (y1 + y2) / 2 + (x2 - x1) * 0.18;
          return (
            <path
              key={i}
              d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`}
              fill="none"
              stroke={hover && on ? "var(--ember)" : "var(--ink)"}
              strokeOpacity={on ? 0.2 + (e.w / maxW) * 0.65 : 0.04}
              strokeWidth={0.6 + (e.w / maxW) * 1.6}
              strokeDasharray="3 5"
              className="motion-safe:animate-[flow_1.6s_linear_infinite]"
            />
          );
        })}
      </g>
      <g>
        {snap.cities.map((c) => {
          const [x, y] = project(c.lon, c.lat);
          const on = !hover || hover === c.slug;
          return (
            <g key={c.slug} onPointerEnter={() => setHover(c.slug)} onPointerLeave={() => setHover(null)} className="cursor-default">
              <circle cx={x} cy={y} r={12} fill="transparent" />
              <circle cx={x} cy={y} r={hover === c.slug ? 6 : 4} fill={c.pm25 == null ? "var(--ink-3)" : categoryForPm(c.pm25).color} stroke="var(--surface)" strokeWidth={1.5} opacity={on ? 1 : 0.35} />
              {hover === c.slug && (
                <text x={x + 9} y={y - 8} fill="var(--ink)" fontSize={12} fontFamily="var(--font-body)">
                  {c.name}
                </text>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}

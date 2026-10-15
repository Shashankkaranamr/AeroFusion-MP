"use client";

import { motion } from "motion/react";
import { useId } from "react";

/** Lightweight SVG sparkline with gradient fill and draw-on animation. */
export function Sparkline({
  values,
  color = "var(--primary)",
  width = 120,
  height = 32,
  fill = true,
  strokeWidth = 1.8,
  className,
  dot = true,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
  className?: string;
  dot?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return <svg width={width} height={height} className={className} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * (width - pad * 2) + pad,
    height - pad - ((v - min) / span) * (height - pad * 2),
  ]);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L${pts[pts.length - 1][0]},${height} L${pts[0][0]},${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} aria-hidden>
      <defs>
        <linearGradient id={`sl-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity={0.28} />
          <stop offset="1" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fill && <motion.path d={area} fill={`url(#sl-${id})`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      />
      {dot && <circle cx={last[0]} cy={last[1]} r={2.6} fill={color} stroke="var(--surface-solid)" strokeWidth={1.5} />}
    </svg>
  );
}
